<?php

use App\Services\P2\Persistence\InAppHandler;
use App\Services\P2\Persistence\ReferenceData;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedAuditRecorder;
use App\Services\P2\Persistence\TypedOutboxWriter;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Bootstrap\LoadConfiguration;
use Illuminate\Http\Request;

// Local integration harness only; never an application entrypoint or deploy artifact.
if (getenv('P2_TEST_HTTP') !== '1' || ! str_starts_with((string) getenv('DB_DATABASE'), 'p2_test_')) {
    http_response_code(404);
    exit;
}
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->afterBootstrapping(LoadConfiguration::class, function ($app) {
    // Local HTTP must exercise real CSRF, not Laravel's testing-environment bypass.
    $app->instance('env', 'local');
    config(['app.env' => 'local', 'app.debug' => false, 'session.driver' => 'file', 'session.secure' => false,
        'identity.enabled' => true, 'integration.p2_enabled' => true, 'integration.dispatch_enabled' => false,
        'integration.store_adapter' => RelationalStore::class,
        'integration.reference_adapter' => ReferenceData::class,
        'integration.audit_adapter' => TypedAuditRecorder::class,
        'integration.outbox_adapter' => TypedOutboxWriter::class,
        'integration.notification_adapter' => InAppHandler::class,
        'cache.default' => 'array', 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false]);
});
$kernel = $app->make(Kernel::class);
$request = Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
