<?php

use App\Jobs\DeliverLocalRecoveryCode;
use App\Models\Facility;
use App\Models\Household;
use App\Models\TanodMembership;
use App\Models\User;
use App\Services\Identity\PasswordRecovery;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE') ||
    ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('Administration fixtures require confirmed disposable MySQL8.4.');
}
$mode = $argv[1] ?? '';
$id = $argv[2] ?? '';
if ($mode === 'prepare') {
    $captain = $db->table('users')->where('id', $id)->where('is_captain', true)->where('email', 'like', 'operational-qa-%@example.invalid')->first();
    if (! $captain) {
        throw new LogicException('Use an owned fictional Captain fixture.');
    }
    $home = Household::forceCreate(['barangay_id' => $captain->barangay_id, 'address' => '8 Mabini Street']);
    $tanod = User::forceCreate(['barangay_id' => $captain->barangay_id, 'household_id' => $home->id, 'full_name' => 'Fictional QA fixed Tanod',
        'email' => 'administration-qa-'.bin2hex(random_bytes(12)).'@example.invalid', 'password' => Hash::make(bin2hex(random_bytes(24))),
        'is_resident' => false, 'is_captain' => false, 'account_status' => 'Active']);
    TanodMembership::forceCreate(['user_id' => $tanod->id, 'barangay_id' => $captain->barangay_id, 'active' => true, 'joined_at' => now('UTC')]);
    $foreign = $db->table('users')->where('barangay_id', '!=', $captain->barangay_id)->where('email', 'like', 'operational-qa-%@example.invalid')->orderByDesc('id')->first();
    if (! $foreign) {
        throw new LogicException('The separate owned foreign scope fixture is required.');
    }
    $shared = Facility::forceCreate(['managed_by_barangay_id' => $foreign->barangay_id, 'visibility' => 'shared',
        'name' => 'Fictional shared referral hospital', 'type' => 'Hospital', 'address' => 'Fictional district street', 'contact' => '(02) 8000-0000', 'active' => true]);
    // This artwork is valid only for the first Sampaguita fixture in a fresh
    // browser schema. Never relabel a different scope to make map tests pass.
    if ($captain->barangay_id === 1) {
        $db->table('barangays')->where('id', 1)->where('name', 'Barangay Sampaguita')->update(['map_scope' => 'sampaguita']);
    }
    echo json_encode(['tanod_id' => $tanod->id, 'shared_facility_id' => $shared->id, 'map_available' => $captain->barangay_id === 1], JSON_THROW_ON_ERROR);
    exit;
}
if ($mode === 'elapse-verification') {
    $row = $db->table('verifications')->join('users', 'users.id', '=', 'verifications.resident_id')->where('verifications.id', $id)
        ->where('review_status', 'Pending')->where('users.email', 'like', 'administration-qa-%@example.invalid')->first(['verifications.id']);
    if (! $row) {
        throw new LogicException('Only an owned pending application may simulate elapsed time.');
    }
    // Simulate time passage only. The original reader/decision service, rather
    // than this fixture, must perform and record the actual expiry transition.
    $db->table('verifications')->where('id', $row->id)->update(['deadline_at' => now('UTC')->subSecond()]);
    echo json_encode(['elapsed' => true], JSON_THROW_ON_ERROR);
    exit;
}
if ($mode === 'deliver-recovery') {
    $row = $db->table('password_recovery_challenges')->join('users', 'users.id', '=', 'password_recovery_challenges.user_id')
        ->where('password_recovery_challenges.id', $id)->where('users.email', 'like', 'administration-qa-%@example.invalid')->first(['password_recovery_challenges.id']);
    if (! $row) {
        throw new LogicException('Only an owned fictional challenge may reach the loopback sink.');
    }
    foreach ($db->table('jobs')->where('queue', 'p1-recovery')->orderByDesc('id')->get() as $queued) {
        $payload = json_decode($queued->payload, true, flags: JSON_THROW_ON_ERROR);
        $job = unserialize(app(Encrypter::class)->decrypt($payload['data']['command']), ['allowed_classes' => [DeliverLocalRecoveryCode::class]]);
        if ($job instanceof DeliverLocalRecoveryCode && (new ReflectionProperty($job, 'challenge'))->getValue($job) === $row->id) {
            $job->handle(app(PasswordRecovery::class));
            echo json_encode(['delivered_to_fictional_loopback_sink' => true], JSON_THROW_ON_ERROR);
            exit;
        }
    }
    throw new LogicException('The actual encrypted recovery job was not queued.');
}
throw new LogicException('Unknown private administration fixture command.');
