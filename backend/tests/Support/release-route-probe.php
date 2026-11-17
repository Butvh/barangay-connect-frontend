<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

if (getenv('DB_TEST_DISPOSABLE') !== '1' || ! str_starts_with((string) getenv('DB_DATABASE'), 'bc_dba_p1_') ||
    getenv('DB_DATABASE') !== getenv('DB_TEST_DATABASE')) {
    throw new LogicException('Confirmed disposable probe required.');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$request = Request::create('/api/v1/alerts', 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json']);
$response = $kernel->handle($request);
$body = json_decode($response->getContent(), true);
echo json_encode(['status' => $response->getStatusCode(), 'message' => $body['message'] ?? ''], JSON_THROW_ON_ERROR);
$kernel->terminate($request, $response);
