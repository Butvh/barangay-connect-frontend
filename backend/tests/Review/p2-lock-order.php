<?php

use App\Contracts\P2\ReferenceData;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\PersonnelAppointment;
use App\Models\User;
use App\Models\Verification;
use App\Providers\P2ServiceProvider;
use App\Services\Incidents\IncidentService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

/** Manual owner-review gate, separate from PHPUnit: actual unmodified P2 services, not guard doubles. */
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$connection = DB::connection();
if (! app()->environment('testing') || getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with($connection->getDatabaseName(), 'p2_test_') || $connection->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new RuntimeException('Explicit disposable P2 review database required.');
}
$version = DB::selectOne('SELECT VERSION() AS v')->v;
if (! str_starts_with($version, '8.4.') || str_contains($version, 'MariaDB') || DB::transactionLevel() !== 0) {
    throw new RuntimeException('Committed genuine MySQL8.4 connection required.');
}
require __DIR__.'/../P2/bindings.php';
$app->register(P2ServiceProvider::class);
config(['identity.enabled' => true, 'hashing.bcrypt.rounds' => 4, 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false]);
$scope = Barangay::forceCreate(['name' => 'Fictional DBA lock review']);
$home = Household::forceCreate(['barangay_id' => $scope->id, 'address' => 'Fictional DBA district']);
$createUser = function (string $role) use ($scope, $home) {
    $user = User::forceCreate(['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Fictional lock review '.$role,
        'email' => bin2hex(random_bytes(10)).'@example.invalid', 'password' => bin2hex(random_bytes(24)), 'account_status' => 'Active', 'is_captain' => $role === 'captain', 'is_resident' => $role === 'resident']);
    if ($role === 'resident') {
        Verification::forceCreate(['resident_id' => $user->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
    } elseif ($role === 'responder') {
        PersonnelAppointment::forceCreate(['user_id' => $user->id, 'barangay_id' => $scope->id, 'role' => $role, 'source' => 'external', 'status' => 'Active']);
    }

    return $user;
};
$resident = $createUser('resident');
$captain = $createUser('captain');
$responder = $createUser('responder');
$refs = $app->make(ReferenceData::class);
$service = $app->make(IncidentService::class);
$alert = $service->create($refs->actorFor($resident->id), [], 'dba-lock-review-sos');
$trace = [];
$tracing = true;
DB::listen(function ($query) use (&$trace, &$tracing) {
    if (! $tracing || ! str_contains(strtolower($query->sql), 'for update')) {
        return;
    }
    foreach (['users', 'emergency_alerts'] as $table) {
        if (str_contains($query->sql, 'from `'.$table.'`')) {
            $count = preg_match('/where `id` in \(([^)]+)\)/', $query->sql, $matches) ? substr_count($matches[1], '?') : 1;
            $trace[] = ['table' => $table, 'ids' => array_values(array_filter(array_slice($query->bindings, 0, $count), fn ($id) => is_int($id) && $id > 0))];
        }
    }
});
$service->assign($refs->actorFor($captain->id), $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
$tracing = false;
$seenPeople = [];
$afterIncident = false;
$late = [];
foreach ($trace as $entry) {
    if ($entry['table'] === 'emergency_alerts') {
        $afterIncident = true;
    } else {
        foreach ($entry['ids'] as $id) {
            if ($afterIncident && ! isset($seenPeople[$id])) {
                $late[$id] = true;
            }
            $seenPeople[$id] = true;
        }
    }
}
$waits = fn () => (int) DB::selectOne("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock_waits'")->Value;
$before = $waits();
$barrier = tempnam(sys_get_temp_dir(), 'dba-p2-lock-');
unlink($barrier);
$workers = [];
$results = [];
try {
    foreach (['response' => $responder->id, 'details' => $resident->id] as $mode => $actor) {
        $process = proc_open([PHP_BINARY, __DIR__.'/p2-lock-worker.php', $mode, (string) $actor, (string) $alert['id'], $barrier], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (! is_resource($process)) {
            throw new RuntimeException('review_worker_unavailable');
        }
        fclose($pipes[0]);
        $workers[] = [$process, $pipes];
    }
    $until = microtime(true) + 15;
    while (true) {
        clearstatcache();
        if (is_file($barrier.'.response.ready') && is_file($barrier.'.details.ready')) {
            break;
        }
        if (microtime(true) > $until) {
            throw new RuntimeException('review_worker_readiness_timeout');
        }
        usleep(1000);
    }
    touch($barrier.'.start');
    foreach ($workers as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        if ($error !== '') {
            throw new RuntimeException('review_worker_runtime_failed');
        }
        $results[] = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
    }
} finally {
    foreach ($workers as [$process, $pipes]) {
        foreach ($pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        if (proc_get_status($process)['running']) {
            proc_terminate($process);
        }
        proc_close($process);
    }
    foreach (glob($barrier.'*') as $file) {
        unlink($file);
    }
}
$delta = $waits() - $before;
$committed = count(array_filter($results, fn ($result) => $result['committed']));
$report = ['mysql' => $version, 'actual_service' => IncidentService::class, 'late_user_ids' => array_keys($late), 'lock_trace' => $trace,
    'concurrent_race' => 'actual responder completion versus actual resident details; common start barrier, no forced service schedule', 'innodb_row_lock_waits_delta' => $delta, 'worker_results' => $results,
    'response_rows' => DB::table('alert_responses')->where('alert_id', $alert['id'])->count(), 'victim_count' => DB::table('emergency_alerts')->where('id', $alert['id'])->value('victim_count'),
    'lock_order_accepted' => ! $late && $committed === 2];
echo json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL;
exit($report['lock_order_accepted'] ? 0 : 2);
