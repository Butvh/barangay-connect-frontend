<?php

use App\Services\P2\Persistence\RelationalStore;
use Illuminate\Contracts\Console\Kernel;

// Run from a disposable P1+DBA+P2 composition, never against a shared database.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! str_starts_with((string) config('database.connections.mysql.database'), 'p2_test_')) {
    throw new RuntimeException('Use an isolated p2_test_ database.');
}
if (! class_exists(RelationalStore::class)) {
    throw new RuntimeException('Missing real P2 relational adapter.');
}
try {
    require __DIR__.'/sql-cases.php';
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error).': '.$error->getMessage().PHP_EOL.$error->getTraceAsString().PHP_EOL);
    exit(1);
}
