<?php

use App\Contracts\P2\ReferenceData;
use App\Providers\IntegrationServiceProvider;
use App\Services\Civic\CivicService;
use App\Services\P2\Problem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
try {
    $database = DB::connection()->getDatabaseName();
    if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with($database, 'bc_dba_p1_') || $database !== getenv('DB_TEST_DATABASE')) {
        throw new LogicException('Fresh isolated MySQL profile required.');
    }
    config(['integration.test_bindings' => true, 'identity.enabled' => true]);
    (new IntegrationServiceProvider($app))->register();
    DB::statement('SET SESSION innodb_lock_wait_timeout = 5');
    $actor = app(ReferenceData::class)->actorFor((int) $argv[1]);
    touch($argv[6]);
    $deadline = microtime(true) + 15;
    while (! is_file($argv[5])) {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Worker barrier timed out.');
        }
        usleep(1000);
    }
    $service = app(CivicService::class);
    $method = match ($argv[3]) {
        'review' => 'reviewFeedback',
        'archive' => 'archiveFeedback',
        default => throw new LogicException('Unsupported worker command.'),
    };
    $result = $service->$method($actor, (int) $argv[2], ['expected_revision' => 0], $argv[4]);
    echo json_encode(['id' => $result['id']], JSON_THROW_ON_ERROR);
} catch (Problem $error) {
    echo json_encode(['error' => $error->errorCode], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage());
    exit(1);
}
