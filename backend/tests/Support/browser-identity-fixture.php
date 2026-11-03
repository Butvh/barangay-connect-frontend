<?php

use App\Models\Barangay;
use App\Models\CapacityGuard;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

// Test-only CLI. Refuses every database except the explicitly confirmed disposable combined schema.
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
$name = $db->getDatabaseName();
if (getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($name, 'bc_dba_p1_') || $name !== getenv('DB_TEST_DATABASE') ||
    ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('Browser fixtures require the disposable genuine MySQL job.');
}
if (($argv[1] ?? '') === 'revoke') {
    $id = filter_var($argv[2] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    $db->transaction(function () use ($db, $id) {
        if (! $id) {
            throw new LogicException('Missing fixture ID.');
        }
        CapacityGuard::lockPeople([$id]);
        $user = $db->table('users')->where('id', $id)->where('email', 'like', 'browser-qa-%@example.invalid')->lockForUpdate()->first();
        if (! $user) {
            throw new LogicException('Not an owned browser fixture.');
        }
        $db->table('users')->where('id', $id)->increment('auth_version');
    });
    exit;
}
$scope = Barangay::forceCreate(['name' => 'Fictional browser QA barangay'])->id;
$result = [];
foreach (['captain', 'resident'] as $role) {
    $password = 'Qa'.bin2hex(random_bytes(24)).'7';
    $email = 'browser-qa-'.bin2hex(random_bytes(12)).'@example.invalid';
    $user = User::forceCreate(['barangay_id' => $scope, 'full_name' => 'Fictional browser '.$role,
        'email' => $email, 'password' => Hash::make($password),
        'is_resident' => true, 'is_captain' => $role === 'captain', 'account_status' => 'Active'])->fresh();
    $result[$role] = ['id' => $user->id, 'barangay_id' => $scope, 'email' => $email, 'password' => $password];
}
// Consumed in the Node process's memory only; never printed by the test runner or uploaded as an artifact.
echo json_encode($result, JSON_THROW_ON_ERROR);
