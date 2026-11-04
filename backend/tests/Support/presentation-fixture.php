<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

// CLI only; creates a NEW explicitly confirmed disposable schema, never drops/resets data.
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
$name = $db->getDatabaseName();
if (PHP_SAPI !== 'cli' || ! $app->environment('testing') || getenv('P1_PRESENTATION_DISPOSABLE') !== '1' ||
    getenv('DB_TEST_DISPOSABLE') !== '1' || ! preg_match('/^bc_dba_p1_presentation_[a-z0-9_]+$/D', $name) ||
    $name !== getenv('DB_TEST_DATABASE') || ! in_array(config('database.connections.mysql.host'), ['127.0.0.1', 'localhost'], true)) {
    throw new LogicException('A confirmed new local disposable presentation schema is required.');
}
// Do not connect to a possibly preexisting selected schema to create it.
$settings = config('database.connections.mysql');
$settings['database'] = null;
config(['database.connections.presentation_setup' => $settings]);
$setup = DB::connection('presentation_setup');
if (! str_starts_with($setup->selectOne('SELECT VERSION() AS v')->v, '8.4.')) {
    throw new LogicException('Use genuine MySQL8.4.');
}
$setup->statement('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
echo 'Created fresh disposable schema.'.PHP_EOL;
