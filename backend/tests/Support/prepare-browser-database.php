<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$connection = DB::connection('mysql');
$name = $connection->getDatabaseName();
$target = $argv[1] ?? '';
if (! $app->environment('testing') || getenv('DB_TEST_DISPOSABLE') !== '1' || getenv('P1_COMBINED_TESTS') !== '1' ||
    ! str_starts_with($name, 'bc_dba_p1_') || $name !== getenv('DB_TEST_DATABASE') ||
    ! in_array($target, ['bc_dba_p1_admin_browser', 'bc_dba_p1_photo_browser', 'bc_dba_p1_civic_ci'], true) ||
    ! str_starts_with($connection->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('Only confirmed ephemeral browser schemas may be prepared.');
}
// Refuse a preexisting target. Never drop, truncate or migrate a shared schema.
$connection->statement('CREATE DATABASE `'.$target.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
echo 'Prepared fresh disposable browser schema '.$target.PHP_EOL;
