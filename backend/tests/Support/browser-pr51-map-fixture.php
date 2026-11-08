<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE') ||
    ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('PR51 map fixtures require confirmed disposable MySQL8.4.');
}
$userId = filter_var($argv[1] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$scope = match ($argv[2] ?? '') {
    'supported' => 'sampaguita', 'unknown' => 'unknown-artwork', 'missing' => null,
    default => throw new LogicException('Use an explicit fictional coverage mode.'),
};
$user = $db->table('users')->where('id', $userId)->where('email', 'like', 'operational-qa-%@example.invalid')->first();
if (! $user || ! $db->table('barangays')->where('id', $user->barangay_id)->where('name', 'Barangay Sampaguita')->exists()) {
    throw new LogicException('Not an owned fictional operational fixture.');
}
$db->table('barangays')->where('id', $user->barangay_id)->update(['map_scope' => $scope]);
echo json_encode(['barangay_id' => $user->barangay_id, 'map_scope' => $scope], JSON_THROW_ON_ERROR);
