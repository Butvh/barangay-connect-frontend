<?php

use App\Contracts\P2\ReferenceData;
use App\Providers\P2ServiceProvider;
use App\Services\Incidents\IncidentService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with(DB::connection()->getDatabaseName(), 'p2_test_') || DB::connection()->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new RuntimeException('Disposable P2 review database required.');
}
require __DIR__.'/../P2/bindings.php';
$app->register(P2ServiceProvider::class);
[$script, $mode, $actorId, $incidentId, $barrier] = $argv;
$actor = $app->make(ReferenceData::class)->actorFor((int) $actorId);
touch($barrier.'.'.$mode.'.ready');
$until = microtime(true) + 15;
try {
    while (true) {
        clearstatcache(true, $barrier.'.start');
        if (is_file($barrier.'.start')) {
            break;
        }
        if (microtime(true) > $until) {
            throw new RuntimeException('review_barrier_timeout');
        }
        usleep(1000);
    }
    $service = $app->make(IncidentService::class);
    $result = $mode === 'response'
        ? $service->response($actor, (int) $incidentId, ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false], 'dba-lock-review-response')
        : $service->details($actor, (int) $incidentId, ['victim_count' => 0]);
    echo json_encode(['mode' => $mode, 'committed' => true, 'incident_id' => $result['id']], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    echo json_encode(['mode' => $mode, 'committed' => false, 'error_class' => get_class($error), 'failure_code' => $error->getMessage() === 'review_barrier_timeout' ? 'review_barrier_timeout' : 'service_failed'], JSON_THROW_ON_ERROR);
    exit(2);
}
