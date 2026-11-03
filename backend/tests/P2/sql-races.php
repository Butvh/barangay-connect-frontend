<?php

use App\Contracts\P2\Store;
use App\Models\PersonnelAppointment;
use App\Models\User;
use App\Models\Verification;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;

/** Independent processes call actual P2 services, sharing only a disposable DB/barrier. */
function raceP2(array $jobs): array
{
    $barrier = tempnam(sys_get_temp_dir(), 'p2-domain-race-');
    unlink($barrier);
    $workers = [];
    try {
        foreach ($jobs as $i => [$actor, $mode, $payload]) {
            $ready = $barrier.'.'.$i;
            $process = proc_open([PHP_BINARY, __DIR__.'/sql-worker.php', (string) $actor, $barrier, $mode, json_encode($payload, JSON_THROW_ON_ERROR), $ready], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            verify(is_resource($process), 'Domain worker could not start.');
            fclose($pipes[0]);
            $workers[] = [$process, $pipes, $ready];
        }
        $deadline = microtime(true) + 15;
        while (array_filter($workers, fn ($w) => ! is_file($w[2]))) {
            verify(microtime(true) < $deadline, 'Domain worker readiness timed out.');
            usleep(1000);
        }
        touch($barrier);
        $results = [];
        foreach ($workers as [$process, $pipes]) {
            $output = stream_get_contents($pipes[1]);
            $error = stream_get_contents($pipes[2]);
            verify($error === '', 'Domain worker failed: '.$error);
            $results[] = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
        }

        return $results;
    } finally {
        foreach ($workers as [$process, $pipes, $ready]) {
            foreach ($pipes as $pipe) {
                if (is_resource($pipe)) {
                    fclose($pipe);
                }
            }
            if (proc_get_status($process)['running']) {
                proc_terminate($process);
            }
            proc_close($process);
            if (is_file($ready)) {
                unlink($ready);
            }
        }
        if (is_file($barrier)) {
            unlink($barrier);
        }
    }
}

$racePerson = function (string $role) use ($scope, $home, $refs) {
    $u = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Race '.$role, 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_resident' => $role === 'resident']);
    if ($role === 'resident') {
        saveModel(Verification::class, ['resident_id' => $u->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
    } else {
        saveModel(PersonnelAppointment::class, ['user_id' => $u->id, 'barangay_id' => $scope->id, 'role' => $role, 'source' => 'external', 'status' => 'Active']);
    }

    return $refs->actorFor($u->id);
};
$raceOfficial = $racePerson('secretary');
$raceResponder = $racePerson('responder');
$raceOther = $racePerson('responder');
$raceAlerts = [];
for ($i = 0; $i < 5; $i++) {
    $raceAlerts[] = $incidents->create($racePerson('resident'), [], 'race-sos-'.$i);
}
$incidents->assign($captain, $raceAlerts[0]['id'], ['personnel_id' => $raceResponder->id, 'expected_revision' => 0], true);

caseTest('Two officials competing across incidents cannot exceed the responder last slot', function () use ($captain, $raceOfficial, $raceResponder, $raceAlerts) {
    $jobs = [];
    foreach ([$captain, $raceOfficial] as $i => $official) {
        $jobs[] = [$official->id, 'assign', ['alert_id' => $raceAlerts[$i + 1]['id'], 'personnel_id' => $raceResponder->id, 'revision' => 0]];
    }
    $results = raceP2($jobs);
    verify(count(array_filter($results, fn ($r) => isset($r['id']))) === 1, 'Last-slot race did not admit exactly one assignment.');
    verify(count(array_filter($results, fn ($r) => ($r['error'] ?? null) === 'CAPACITY')) === 1, 'Capacity loser was not rejected.');
    verify(DB::table('alert_assignments')->where(['user_id' => $raceResponder->id, 'status' => 'active'])->count() === 2, 'Concurrent dispatch exceeded limit2.');
});
caseTest('Same-incident competing acknowledgments retain one assignment and reject stale revision', function () use ($captain, $raceOfficial, $raceOther, $raceAlerts, $racePerson) {
    $second = $racePerson('responder');
    $results = raceP2([
        [$captain->id, 'assign', ['alert_id' => $raceAlerts[3]['id'], 'personnel_id' => $raceOther->id, 'revision' => 0]],
        [$raceOfficial->id, 'assign', ['alert_id' => $raceAlerts[3]['id'], 'personnel_id' => $second->id, 'revision' => 0]],
    ]);
    verify(count(array_filter($results, fn ($r) => isset($r['id']))) === 1 && count(array_filter($results, fn ($r) => ($r['error'] ?? null) === 'CONFLICT')) === 1, 'Same-incident winner/stale loser incorrect.');
    verify(DB::table('alert_assignments')->where('alert_id', $raceAlerts[3]['id'])->count() === 1, 'Duplicate assignment survived.');
});
caseTest('Concurrent completion and competing dispatch preserve capacity and explicit resolution', function () use ($raceOfficial, $raceResponder, $raceAlerts) {
    $results = raceP2([
        [$raceResponder->id, 'response', ['alert_id' => $raceAlerts[0]['id']]],
        [$raceOfficial->id, 'assign', ['alert_id' => $raceAlerts[4]['id'], 'personnel_id' => $raceResponder->id, 'revision' => 0]],
    ]);
    verify(isset($results[0]['id']), 'Assigned responder completion failed.');
    verify(isset($results[1]['id']) || ($results[1]['error'] ?? null) === 'CAPACITY', 'Unexpected competing assignment result.');
    $active = DB::table('alert_assignments')->where(['user_id' => $raceResponder->id, 'status' => 'active'])->count();
    verify($active >= 1 && $active <= 2, 'Capacity release/competition violated limit2.');
    verify(DB::table('emergency_alerts')->where('id', $raceAlerts[0]['id'])->value('status') === 'Responding', 'Completion automatically resolved.');
});
caseTest('Generation changed after request capture is rejected inside the actual mutation lock', function () use ($racePerson, $incidents) {
    $observed = $racePerson('resident');
    DB::table('users')->where('id', $observed->id)->increment('auth_version');
    try {
        $incidents->create($observed, [], 'revoked-mid-request');
        throw new RuntimeException('Captured stale generation was accepted.');
    } catch (ApiProblem $error) {
        verify($error->status === 401, 'Expected generation revocation401.');
    }
    verify(DB::table('emergency_alerts')->where('resident_id', $observed->id)->count() === 0, 'Revoked request persisted an SOS.');
});
caseTest('Candidate eligibility uses a current appointment read despite an older transaction snapshot', function () use ($racePerson, $refs, $captain) {
    $person = $racePerson('responder');
    config(['database.connections.p2_second' => config('database.connections.mysql')]);
    DB::transaction(function () use ($person, $refs, $captain) {
        // Establish a repeatable-read snapshot before another connection changes eligibility.
        DB::table('personnel_appointments')->where('user_id', $person->id)->first();
        DB::connection('p2_second')->table('personnel_appointments')->where('user_id', $person->id)->update(['status' => 'Inactive']);
        $current = app(Store::class)->transaction(['person:'.$captain->id, 'person:'.$person->id], fn () => $refs->forActor($captain)->eligiblePerson($person->id, $person->barangayId));
        verify($current['role'] !== 'responder' || ($current['personnel_status'] ?? null) !== 'Active', 'Stale appointment remained dispatch-eligible.');
    });
    DB::purge('p2_second');
});
