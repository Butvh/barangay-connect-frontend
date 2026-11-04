<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Bootstrap\LoadConfiguration;
use Illuminate\Http\Request;

// Disposable loopback harness only, excluded from both public artifacts.
if (getenv('P1_OPERATIONAL_BROWSER') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with((string) getenv('DB_DATABASE'), 'bc_dba_p1_') || getenv('DB_DATABASE') !== getenv('DB_TEST_DATABASE')) {
    http_response_code(404);
    exit;
}
$public = dirname(__DIR__, 2).'/public';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (is_string($path) && preg_match('~^/frontend/[a-zA-Z0-9_./-]+$~D', $path) && ! str_contains($path, '..') && is_file($public.$path)) {
    return false;
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->afterBootstrapping(LoadConfiguration::class, function ($app): void {
    $app->instance('env', 'local'); // Exercise real CSRF rather than the testing bypass.
    config(['app.env' => 'local', 'app.debug' => false, 'session.driver' => 'file', 'session.secure' => false,
        'identity.enabled' => true, 'integration.p2_enabled' => true, 'integration.test_bindings' => true,
        'integration.dispatch_enabled' => false, 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false]);
});
$kernel = $app->make(Kernel::class);
$request = Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
