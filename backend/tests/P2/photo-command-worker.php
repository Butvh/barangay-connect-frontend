<?php

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Models\User;
use App\Providers\IntegrationServiceProvider;
use App\Services\Audit\AuditRecorder;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\IncidentPhotoPolicy;
use App\Services\P2\Problem;
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
    throw new LogicException('Requires the confirmed disposable MySQL composition.');
}
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
config(['identity.enabled' => true, 'integration.test_bindings' => true]);
(new IntegrationServiceProvider($app))->register();
echo "ready\n";
flush();
try {
    $observed = EffectiveIdentity::fromUser(User::with('appointment')->findOrFail($input['user_id']));
    if (! $observed || ! $observed->matches($input['observed'])) {
        throw new ApiProblem('AUTH', 401, 'Original observation changed.');
    }
    $photos = new PrivateIncidentPhotos(app(Store::class), app(IncidentPhotoPolicy::class), new IdentityReferences,
        new SourceReferences, new PhotoInspector, new PrivatePhotoObjects);
    $service = new IncidentService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class),
        app(OutboxWriter::class), static fn () => gmdate('Y-m-d\TH:i:s\Z'), $photos);
    $result = $service->details(new Actor($observed->id, $observed->barangayId, $observed->role, $observed),
        $input['incident_id'], ['upload_ids' => $input['upload_ids'], 'expected_revision' => $input['expected_revision']], $input['intent']);
    echo json_encode(['ok' => true, 'revision' => $result['assignment_revision']], JSON_THROW_ON_ERROR);
} catch (ApiProblem|Problem $error) {
    echo json_encode(['ok' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR);
}
