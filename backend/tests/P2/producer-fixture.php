<?php

/** Explicit disposable acceptance fixture: actual sources/consent; never dispatches or sends. */
use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Models\Barangay;
use App\Models\Household;
use App\Models\OutboxEvent;
use App\Models\User;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\TypedAuditRecorder;
use App\Services\P2\Persistence\TypedOutboxWriter;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection('mysql');
$name = $db->getDatabaseName();
if (! $app->environment('testing') || getenv('P2_SOURCE_FIXTURE') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1' ||
    ! preg_match('/^bc_dba_p[12]_[A-Za-z0-9_]+$/D', $name) || $name !== getenv('DB_TEST_DATABASE') ||
    $db->transactionLevel() !== 0 || ! str_starts_with($db->selectOne('SELECT VERSION() AS v')->v, '8.4.') ||
    config('messaging.sms.enabled') || config('messaging.make.enabled') || config('integration.dispatch_enabled')) {
    throw new LogicException('Requires confirmed private MySQL8.4; delivery/Make/dispatch must remain disabled.');
}
$case = $argv[1] ?? '';
if (! in_array($case, ['positive', 'missing', 'revoked', 'wrong_purpose'], true)) {
    throw new InvalidArgumentException('Use positive, missing, revoked or wrong_purpose.');
}
config(['identity.enabled' => true, 'integration.test_bindings' => true]);
(new IntegrationServiceProvider($app))->register();
$scope = Barangay::forceCreate(['name' => 'Fictional P2 producer acceptance '.$case])->id;
$home = Household::forceCreate(['barangay_id' => $scope, 'address' => 'Fictional acceptance street', 'map_x' => 0, 'map_y' => 0]);
$makeUser = static fn (string $role) => User::forceCreate(['barangay_id' => $scope, 'household_id' => $home->id,
    'full_name' => 'Fictional acceptance '.$role, 'email' => bin2hex(random_bytes(12)).'@example.invalid',
    'password' => Hash::make(bin2hex(random_bytes(24))), 'is_resident' => true, 'is_captain' => $role === 'captain',
    'account_status' => 'Active', 'contact_number' => '09171234567']);
$resident = $makeUser('resident');
$captain = $makeUser('captain');
Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $scope, 'review_status' => 'Approved']);
$actor = static function (User $user): Actor {
    $identity = EffectiveIdentity::fromUser($user->fresh());

    return new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
};
$consent = new CurrentSmsConsent(app(Store::class), new IdentityReferences, new TypedAuditRecorder);
$change = static function (User $user, string $purpose, string $state) use ($consent, $actor): void {
    $identity = $actor($user)->observedIdentity();
    $current = $consent->read($identity, $purpose);
    $consent->change($identity, $purpose, ['state' => $state, 'expected_revision' => $current['revision'],
        'policy_version' => CurrentSmsConsent::POLICY, 'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]]);
};
if (in_array($case, ['positive', 'revoked'], true)) {
    $change($captain, 'incident_review', 'granted');
    $change($resident, 'barangay_announcements', 'granted');
    if ($case === 'revoked') {
        $change($captain, 'incident_review', 'revoked');
        $change($resident, 'barangay_announcements', 'revoked');
    }
} elseif ($case === 'wrong_purpose') {
    $change($captain, 'barangay_announcements', 'granted');
}
$clock = static fn () => gmdate('Y-m-d\TH:i:s\Z');
$outbox = new OutboxWriter(app(Store::class), $clock, new TypedOutboxWriter(allowSmsIntent: true));
$incidentService = new IncidentService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class), $outbox, $clock, null, $consent);
$civicService = new CivicService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class), $outbox, $clock, $consent);
$incident = $incidentService->create($actor($resident), [], 'fixture-sos-intent');
$notice = $civicService->publish($actor($captain), ['title' => 'Fictional acceptance advisory', 'content' => 'Review this fictional notice.'], 'fixture-publication-intent');
$events = [];
foreach (['incident.created.v2' => $incident['id'], 'announcement.published.v2' => $notice['id']] as $type => $id) {
    $event = OutboxEvent::where('type', $type)->where('barangay_id', $scope)->where('resource_id', $id)->sole();
    $events[] = ['event_id' => $event->event_id, 'type' => $type, 'resource_id' => $id,
        'in_app' => $event->recipients->where('in_app', true)->count(), 'sms' => $event->recipients->where('sms', true)->count()];
}
echo json_encode(['case' => $case, 'database' => $name, 'scope' => $scope, 'events' => $events,
    'delivery_invoked' => false, 'real_messages' => 0], JSON_THROW_ON_ERROR).PHP_EOL;
