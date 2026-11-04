<?php

use App\Models\User;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new LogicException('Current authority workers require the confirmed disposable composition.');
}
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
config(['identity.enabled' => true, 'integration.test_bindings' => true, 'integration.consent_test_bindings' => true]);
(new IntegrationServiceProvider($app))->register();
$service = app(CurrentSmsConsent::class);
echo "ready\n";
flush();
try {
    $user = User::with('appointment')->findOrFail($input['user_id']);
    $observed = EffectiveIdentity::fromUser($user);
    if (! $observed || ! $observed->matches($input['observed'])) {
        throw new ApiProblem('AUTH', 401, 'Original observation changed.');
    }
    if ($input['mode'] === 'reserve') {
        $result = $service->withCurrentEligibility($observed, 'incident_review', function () use ($db, $input): bool {
            if (! preg_match('/^p1_consent_[a-f0-9]+$/D', $input['gate'])) {
                throw new LogicException('Invalid test gate.');
            }
            echo "gate\n";
            flush();
            if ((int) $db->selectOne('SELECT GET_LOCK(?,10) AS held', [$input['gate']])->held !== 1) {
                throw new RuntimeException('Test SQL gate timeout.');
            }
            $db->selectOne('SELECT RELEASE_LOCK(?)', [$input['gate']]);

            return true; // SQL-only reservation boundary; no external transport.
        });
    } else {
        $result = $service->change($observed, 'incident_review', ['state' => $input['mode'], 'expected_revision' => $input['revision'],
            'policy_version' => CurrentSmsConsent::POLICY, 'template_version' => 'alert-review.v1']);
    }
    echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR);
} catch (ApiProblem $error) {
    echo json_encode(['ok' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR);
}
