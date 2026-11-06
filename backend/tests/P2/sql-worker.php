<?php

use App\Contracts\P2\ReferenceData;
use App\Providers\P2ServiceProvider;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Problem;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
try {
    if (! str_starts_with((string) config('database.connections.mysql.database'), 'p2_test_')) {
        throw new RuntimeException('Isolated database required.');
    }
    require __DIR__.'/bindings.php';
    $app->register(P2ServiceProvider::class);
    $barrier = $argv[2];
    $actor = $app->make(ReferenceData::class)->actorFor((int) $argv[1]);
    if (isset($argv[5])) {
        touch($argv[5]);
    }
    $deadline = microtime(true) + 20;
    while (! is_file($barrier)) {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Barrier timeout.');
        }
        usleep(1000);
    }
    $service = $app->make(IncidentService::class);
    $input = isset($argv[4]) ? json_decode($argv[4], true, flags: JSON_THROW_ON_ERROR) : [];
    $result = match ($argv[3] ?? 'create') {
        'assign' => $service->assign($actor, $input['alert_id'], ['personnel_id' => $input['personnel_id'], 'expected_revision' => $input['revision']], true),
        'response' => $service->response($actor, $input['alert_id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false], 'race-response'),
        'create' => $service->create($actor, ['alert_type' => 'Other'], 'independent-process-intent'),
        default => throw new LogicException('Unsupported test-worker action.'),
    };
    echo json_encode(['id' => $result['id']], JSON_THROW_ON_ERROR);
} catch (Problem $error) {
    echo json_encode(['error' => $error->errorCode], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage());
    exit(1);
}
