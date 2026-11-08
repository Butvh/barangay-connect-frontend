<?php

use App\Contracts\P2\Store;
use App\Models\User;
use App\Providers\IntegrationServiceProvider;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Services\P2\Problem;
use App\Services\Photos\PhotoCleanup;
use App\Services\Photos\PhotoInspector;
use App\Services\Photos\PrivateIncidentPhotos;
use App\Services\Photos\PrivatePhotoObjects;
use App\Support\ApiProblem;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
if (! $app->environment('testing') || getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! str_starts_with($db->getDatabaseName(), 'bc_dba_p1_') || $db->getDatabaseName() !== getenv('DB_TEST_DATABASE')) {
    throw new LogicException('Photo workers require the confirmed disposable composition.');
}
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
config(['identity.enabled' => true, 'integration.test_bindings' => true]);
(new IntegrationServiceProvider($app))->register();
$objects = new PrivatePhotoObjects;
$store = app(Store::class);
echo "ready\n";
flush();
try {
    if ($input['mode'] === 'cleanup') {
        $cleanup = new PhotoCleanup($objects);
        $claim = $cleanup->claim($input['photo_id']);
        if ($claim) {
            $objects->remove($claim->object_key);
        }
        $result = ['claimed' => $claim !== null, 'finalized' => $claim ? $cleanup->finalize((int) $claim->id, $claim->cleanup_token, true) : false];
    } else {
        $user = User::with('appointment')->findOrFail($input['user_id']);
        $observed = EffectiveIdentity::fromUser($user);
        if (! $observed || ! $observed->matches($input['observed'])) {
            throw new ApiProblem('AUTH', 401, 'Original observation changed.');
        }
        $service = new PrivateIncidentPhotos($store, app(IncidentPhotoPolicy::class), new IdentityReferences,
            new SourceReferences, new PhotoInspector, $objects);
        $id = $store->transaction(['person:'.$observed->id, 'incident:'.$input['incident_id']], function () use ($service, $input, $observed): int {
            $id = $service->attach($observed, $input['upload_id'], $input['incident_id'], $input['expected_revision']);
            app(IncidentService::class)->details(new Actor($observed->id, $observed->barangayId, $observed->role, $observed), $input['incident_id'],
                ['description' => 'Real concurrent photo source write', 'expected_revision' => $input['expected_revision']], $input['intent']);

            return $id;
        });
        $result = ['attached' => $id];
    }
    echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR);
} catch (ApiProblem|Problem $error) {
    echo json_encode(['ok' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR);
}
