<?php

// Deterministic peer for the actual assignment-vs-resident-details regression.
use App\Contracts\P2\ReferenceData;
use App\Providers\P2ServiceProvider;
use App\Services\Incidents\IncidentService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
try {
    if (! str_starts_with((string) config('database.connections.mysql.database'), 'p2_test_')) {
        throw new RuntimeException('Isolated database required.');
    }
    require __DIR__.'/bindings.php';
    $app->register(P2ServiceProvider::class);
    DB::statement('SET SESSION innodb_lock_wait_timeout = 8');
    $paused = false;
    DB::listen(function ($query) use (&$paused, $argv) {
        file_put_contents($argv[4].'.trace', $query->sql.' '.json_encode($query->bindings).PHP_EOL, FILE_APPEND);
        if ($paused || ! str_contains($query->sql, 'from `emergency_alerts`') || ! str_contains($query->sql, 'for update')) {
            return;
        }
        $paused = true;
        touch($argv[4].'.held');
        $deadline = microtime(true) + 15;
        while (! is_file($argv[4].'.release')) {
            if (microtime(true) > $deadline) {
                throw new RuntimeException('Lock barrier timed out.');
            }
            usleep(1000);
        }
    });
    $actor = $app->make(ReferenceData::class)->actorFor((int) $argv[1]);
    // One attempt exposes lock inversions; automatic deadlock retries must not hide them.
    $result = DB::transaction(fn () => $app->make(IncidentService::class)->assign($actor, (int) $argv[2], ['personnel_id' => (int) $argv[3], 'expected_revision' => 0], true), 1);
    echo json_encode(['id' => $result['id']], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    echo json_encode(['error' => $error->getMessage()], JSON_THROW_ON_ERROR);
    exit(1);
}
