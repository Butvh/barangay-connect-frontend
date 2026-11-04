<?php

use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\PasswordRecovery;
use App\Support\ApiProblem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new LogicException('Administration workers require the confirmed disposable composition.');
}
$input = json_decode(stream_get_contents(STDIN, 16384), true, flags: JSON_THROW_ON_ERROR);
config(['identity.enabled' => true, 'integration.test_bindings' => true, 'integration.admin_test_bindings' => true, 'identity.local_recovery_mail' => true]);
(new IntegrationServiceProvider($app))->register();
echo 'ready:'.$db->selectOne('SELECT CONNECTION_ID() AS id')->id."\n";
flush();
try {
    app(PasswordRecovery::class)->verify($input);
    echo json_encode(['verified' => true], JSON_THROW_ON_ERROR); // Never print the reset authorization or code.
} catch (ApiProblem $error) {
    echo json_encode(['verified' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR);
}
