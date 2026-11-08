<?php

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Http\Controllers\P2\RevisionController;
use App\Models\Barangay;
use App\Models\DeliveryReceipt;
use App\Models\Facility;
use App\Models\Household;
use App\Models\Notification;
use App\Models\OutboxEvent;
use App\Models\PersonnelAppointment;
use App\Models\TanodMembership;
use App\Models\User;
use App\Models\Verification;
use App\Providers\P2ServiceProvider;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\NotificationService;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\RelationalStore;
use App\Services\P2\Persistence\TypedOutboxWriter;
use App\Services\P2\Problem;
use App\Services\Reports\ReportService;
use App\Support\ApiProblem;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

function verify(bool $ok, string $message): void
{
    if (! $ok) {
        throw new RuntimeException($message);
    }
}
function saveModel(string $class, array $attributes)
{
    $model = new $class;
    $model->forceFill($attributes)->save();

    return $model;
}
function expectsProblem(Closure $work, string $code): void
{
    try {
        $work();
    } catch (Problem $error) {
        verify($error->errorCode === $code, 'Wrong rejection: '.$error->errorCode);

        return;
    }
    throw new RuntimeException('Expected '.$code);
}
function caseTest(string $name, Closure $work): void
{
    $work();
    echo 'PASS '.$name.PHP_EOL;
}

$version = DB::selectOne('SELECT VERSION() AS version')->version;
verify(str_starts_with($version, '8.4.') && ! str_contains($version, 'MariaDB'), 'Genuine MySQL 8.4 required.');
verify(DB::table('users')->count() === 0, 'Use a fresh isolated test database; existing rows are not erased.');
config(['identity.enabled' => true, 'hashing.bcrypt.rounds' => 4, 'messaging.sms.enabled' => false, 'messaging.make.enabled' => false, 'session.driver' => 'array', 'cache.default' => 'array']);
require __DIR__.'/bindings.php';
$selectedStore = new RelationalStore;
$app->instance(Store::class, $selectedStore);
$app->register(P2ServiceProvider::class);
caseTest('P2 provider preserves foundation-selected implementation bindings', function () use ($app, $selectedStore) {
    verify($app->make(Store::class) === $selectedStore, 'P2 replaced the foundation-selected Store binding.');
});
caseTest('Civic evidence hashes only the current database despite another accessible schema', function () {
    require_once __DIR__.'/civic-evidence.php';
    $connection = DB::connection();
    $database = $connection->getDatabaseName();
    verify(getenv('DB_TEST_DISPOSABLE') === '1' && getenv('DB_TEST_DATABASE') === $database &&
        in_array($connection->getConfig('host'), ['127.0.0.1', 'localhost', '::1'], true) &&
        preg_match('/^p2_test_[a-zA-Z0-9_]+$/D', $database) === 1, 'Use a confirmed disposable local observer target.');
    $foreign = substr($database, 0, 40).'_observer_'.bin2hex(random_bytes(6));
    $connection->statement('CREATE DATABASE `'.$foreign.'`'); // New name must not already exist.
    try {
        $connection->statement('CREATE TABLE `'.$foreign.'`.`p2_observer_foreign_only` (`id` bigint primary key)');
        $connection->statement('INSERT INTO `'.$foreign.'`.`p2_observer_foreign_only` VALUES (1)');
        $before = civicDatabaseState();
        verify(! array_key_exists('p2_observer_foreign_only', $before), 'Observer included another schema.');
        $connection->statement('INSERT INTO `'.$foreign.'`.`p2_observer_foreign_only` VALUES (2)');
        verify(civicDatabaseState() === $before, 'Foreign rows changed the current database evidence.');
        verify(isset($before['users'], $before['community_feedback'], $before['private_photo_objects']), 'Current table/object coverage was lost.');
    } finally {
        $connection->statement('DROP DATABASE `'.$foreign.'`'); // Only this invocation created this name.
    }
});
$scope = saveModel(Barangay::class, ['name' => 'P2 isolated fixture']);
$home = saveModel(Household::class, ['barangay_id' => $scope->id, 'address' => 'Fixture Road', 'map_x' => 23, 'map_y' => 45]);
$users = [];
foreach (['resident', 'captain', 'secretary', 'responder', 'rescuer', 'resident', 'responder'] as $index => $role) {
    $u = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Fixture '.$index, 'email' => 'fixture'.$index.'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_resident' => $role === 'resident', 'is_captain' => $role === 'captain']);
    if (in_array($role, ['secretary', 'responder', 'rescuer'])) {
        saveModel(PersonnelAppointment::class, ['user_id' => $u->id, 'barangay_id' => $scope->id, 'role' => $role, 'source' => 'external', 'status' => 'Active']);
    }
    $users[] = $u;
}
saveModel(Verification::class, ['resident_id' => $users[0]->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
$refs = $app->make(ReferenceData::class);
$store = $app->make(Store::class);
$incidents = $app->make(IncidentService::class);
$civic = $app->make(CivicService::class);
$resident = $refs->actorFor($users[0]->id);
$captain = $refs->actorFor($users[1]->id);
$secretary = $refs->actorFor($users[2]->id);
$alert = null;

caseTest('MySQL durable SOS, hashed retry key and no pointer columns', function () use ($incidents, $resident, &$alert) {
    $alert = $incidents->create($resident, ['alert_type' => 'Flood', 'victim_count' => null], 'sql-sos-intent');
    $retry = $incidents->create($resident, ['alert_type' => 'Flood', 'victim_count' => null], 'sql-sos-intent');
    verify($retry['id'] === $alert['id'] && DB::table('emergency_alerts')->count() === 1, 'Duplicate SOS.');
    verify($alert['assigned_responder_id'] === null && $alert['map_x'] === 23.0, 'Bad DTO.');
    verify(DB::table('idempotency_requests')->value('key_digest') === hash_hmac('sha256', $resident->id.'|alerts.create|sql-sos-intent', config('app.key')), 'Raw key storage.');
    verify(DB::table('incident_status_history')->value('sequence') === 1, 'History sequence missing.');
    verify(DB::table('activity_logs')->count() === 1 && DB::table('outbox_events')->count() === 1, 'Missing atomic evidence.');
});
caseTest('Unverified user and forged tenant denied by current reference data', function () use ($incidents, $refs, $users, $resident) {
    expectsProblem(fn () => $incidents->create($refs->actorFor($users[5]->id), [], 'unverified-key'), 'FORBIDDEN');
    expectsProblem(fn () => $incidents->create(new Actor($resident->id, 9999, 'resident'), [], 'forged-scope'), 'AUTH');
});
caseTest('Manual assignment, transfer assessment reset, rescue snapshot and explicit resolution use SQL', function () use ($incidents, $secretary, $captain, $refs, $users, $scope, &$alert) {
    $alert = $incidents->assign($secretary, $alert['id'], ['personnel_id' => $users[3]->id, 'expected_revision' => 0], true);
    expectsProblem(fn () => $incidents->assign($secretary, $alert['id'], ['personnel_id' => $users[3]->id, 'expected_revision' => 0], true), 'CONFLICT');
    $alert = $incidents->response($refs->actorFor($users[3]->id), $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true], 'response-first');
    $assignment = DB::table('alert_assignments')->where('alert_id', $alert['id'])->where('role', 'responder')->first();
    $alert = $incidents->changeAssignment($captain, $assignment->id, ['personnel_id' => $users[6]->id, 'reason' => 'Fixture transfer', 'expected_revision' => $alert['assignment_revision']], true);
    expectsProblem(fn () => $incidents->assign($secretary, $alert['id'], ['role' => 'rescuer', 'personnel_id' => $users[4]->id, 'expected_revision' => $alert['assignment_revision']]), 'INVALID_STATE');
    expectsProblem(fn () => $incidents->response($refs->actorFor($users[3]->id), $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true], 'former-response'), 'FORBIDDEN');
    $alert = $incidents->response($refs->actorFor($users[6]->id), $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true], 'response-current');
    $alert = $incidents->assign($secretary, $alert['id'], ['role' => 'rescuer', 'personnel_id' => $users[4]->id, 'expected_revision' => $alert['assignment_revision']]);
    $facility = saveModel(Facility::class, ['managed_by_barangay_id' => $scope->id, 'name' => 'SQL Shelter', 'type' => 'Evacuation Center', 'address' => 'Shelter Road', 'active' => true]);
    $alert = $incidents->rescue($refs->actorFor($users[4]->id), $alert['id'], ['facility_id' => $facility->id, 'rescue_status' => 'Completed'], 'rescue-current');
    verify($alert['status'] === 'Rescue in progress' && DB::table('alert_assignments')->where('status', 'active')->count() === 0, 'Completion resolved automatically or retained capacity.');
    $facility->forceFill(['name' => 'Changed shelter'])->save();
    $alert = $incidents->resolve($captain, $alert['id'], ['expected_revision' => $alert['assignment_revision']]);
    verify($alert['status'] === 'Resolved' && $alert['rescues'][0]['facility']['name'] === 'SQL Shelter', 'Destination snapshot or resolution wrong.');
});
caseTest('No-rescue Completed branch still requires explicit official resolution', function () use ($incidents, $resident, $secretary, $captain, $refs, $users) {
    $r = $incidents->create($resident, [], 'no-rescue-sos');
    $r = $incidents->assign($secretary, $r['id'], ['personnel_id' => $users[3]->id, 'expected_revision' => 0], true);
    $r = $incidents->response($refs->actorFor($users[3]->id), $r['id'], ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false], 'no-rescue-response');
    verify($r['status'] === 'Responding', 'Response completion resolved alert.');
    $r = $incidents->resolve($captain, $r['id'], ['expected_revision' => $r['assignment_revision']]);
    verify($r['status'] === 'Resolved', 'No-rescue explicit resolution failed.');
});
caseTest('Typed outbox rejects malformed P1 snapshots atomically and keeps SMS disabled', function () use ($scope, $users) {
    $writer = new TypedOutboxWriter;
    $before = DB::table('outbox_events')->count();
    try {
        DB::transaction(fn () => $writer->record(EventId::generate(), 'security.updated.v2', $scope->id, $users[0]->id, [], new DateTimeImmutable));
        throw new RuntimeException('Malformed security snapshot was accepted.');
    } catch (InvalidArgumentException) {
    }
    verify(DB::table('outbox_events')->count() === $before, 'Malformed source event survived rollback.');
    verify(DB::table('outbox_recipients')->where('sms', true)->count() === 0, 'SMS implicitly enabled.');
});
caseTest('Feedback persists typed nullable data and independent operational statuses', function () use ($civic, $resident, $captain) {
    $complaint = $civic->submitFeedback($resident, ['type' => 'complaint', 'category' => 'Drainage', 'description' => 'Fixture concern'], 'feedback-fixture');
    $general = $civic->submitFeedback($resident, ['type' => 'general', 'rating' => 4, 'comment' => 'Fixture feedback'], 'general-fixture');
    verify($complaint['comment'] === null && $general['status'] === null && $general['rating'] === 4, 'Feedback kind mapping wrong.');
    $resolved = $civic->resolveFeedback($captain, $complaint['id'], ['expected_revision' => $complaint['revision']]);
    verify($resolved['status'] === 'Resolved', 'Complaint resolution failed.');
});
caseTest('Injected writer failure rolls back SQL state, history, audit and command outcome', function () use ($app, $store, $refs, $scope, $home) {
    $u = saveModel(User::class, ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Rollback fixture', 'email' => 'rollback@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_resident' => true]);
    saveModel(Verification::class, ['resident_id' => $u->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
    $before = array_map(fn ($t) => DB::table($t)->count(), ['emergency_alerts', 'incident_status_history', 'activity_logs', 'idempotency_requests', 'outbox_events']);
    $clock = fn () => gmdate(DATE_ATOM);
    $fault = new class implements OutboxWriter
    {
        public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
        {
            throw new RuntimeException('injected-storage-failure');
        }
    };
    $service = new IncidentService($store, $refs, $app->make(AuditRecorder::class), new App\Services\Messaging\OutboxWriter($store, $clock, $fault), $clock);
    try {
        $service->create($refs->actorFor($u->id), [], 'rollback-fixture');
        throw new RuntimeException('Fault missing.');
    } catch (RuntimeException $e) {
        verify($e->getMessage() === 'injected-storage-failure', 'Unexpected rollback failure: '.$e->getMessage());
    }
    $after = array_map(fn ($t) => DB::table($t)->count(), ['emergency_alerts', 'incident_status_history', 'activity_logs', 'idempotency_requests', 'outbox_events']);
    verify($before === $after, 'Partial SQL write escaped rollback.');
});
caseTest('Publish/edit/archive stores actual author columns and immutable snapshot history', function () use ($civic, $captain) {
    $item = $civic->publish($captain, ['title' => 'Fixture advisory', 'content' => 'Isolated content'], 'publish-fixture');
    verify($item['author']['id'] === $captain->id && DB::table('announcements')->value('author_role') === 'captain', 'Author mapping wrong.');
    $edited = $civic->edit($captain, $item['id'], ['expected_revision' => 1, 'title' => 'Edited advisory']);
    $archived = $civic->archive($captain, $item['id'], ['expected_revision' => $edited['revision']]);
    verify($archived['archived_by'] === $captain->id && count($archived['history']) === 3, 'Archive history mapping wrong.');
});
caseTest('DBA v2 dispatcher persists event-time notifications exactly once without provider sends', function () use ($app) {
    $dispatcher = $app->make(OutboxDispatcher::class);
    while ($dispatcher->dispatchOne()) {
    }
    verify(Notification::count() > 2 && DeliveryReceipt::where('state', 'complete')->count() === Notification::count(), 'In-app receipts incomplete.');
    verify(OutboxEvent::whereNull('dispatched_at')->count() === 0 && OutboxEvent::whereNotNull('blocked_at')->count() === 0, 'Blocked or incomplete event.');
    $first = Notification::query()->where('resource_type', 'incident')->orderBy('id')->first();
    verify($first->event_status === 'Pending', 'Delayed delivery substituted later source status.');
    $count = Notification::count();
    $dispatcher->dispatchOne();
    verify(Notification::count() === $count && DB::table('sms_deliveries')->count() === 0 && DB::table('make_dispatches')->count() === 0, 'Duplicate/provider intent.');
});
caseTest('SQL notification mutations and source revocation preserve recipient privacy', function () use ($app, $captain, $secretary, $users) {
    $service = $app->make(NotificationService::class);
    $rows = $service->list($secretary);
    verify(count($rows) > 0, 'No authorized notification.');
    verify(is_string($rows[0]['event_id']) && Str::isUuid($rows[0]['event_id']), 'Notification event UUID was corrupted.');
    $id = $rows[0]['id'];
    expectsProblem(fn () => $service->get($captain, $id), 'NOT_FOUND');
    verify($service->setRead($secretary, $id, true)['is_read'] === true, 'Read failed.');
    verify($service->setRead($secretary, $id, false)['is_read'] === false, 'Unread failed.');
    $service->markAllRead($secretary);
    $service->clearRead($secretary);
    verify($service->list($secretary) === [], 'Clear read failed.');
    $users[2]->forceFill(['account_status' => 'Inactive'])->save();
    try {
        $service->list($secretary);
        throw new RuntimeException('Revoked account read succeeded.');
    } catch (ApiProblem $e) {
        verify($e->getCode() === 0, 'Unexpected revocation exception.');
    }
});
caseTest('Real P1 HTTP denies anonymous access in the SQL composition', function () use ($app) {
    verify(Schema::hasColumn('users', 'auth_version'), 'Actual owner security generation is missing.');
    $kernel = $app->make(Kernel::class);
    $response = $kernel->handle(Request::create('/api/v1/alerts', 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json']));
    verify($response->getStatusCode() === 401, 'Expected guest 401; received '.$response->getStatusCode().'.');
});
$revisionController = $app->make(RevisionController::class);
$residentRequest = Request::create('/api/v1/revisions/alerts');
$residentRequest->setUserResolver(fn () => $users[0]);
$residentRequest->attributes->set('effective_identity', EffectiveIdentity::fromUser($users[0]->fresh()));
$beforeNearby = $revisionController->show($residentRequest, 'alerts')->getData(true)['data']['revision'];
caseTest('Independent processes serialize same-resident SOS through real guards and idempotency', function () use ($users, $scope) {
    saveModel(Verification::class, ['resident_id' => $users[5]->id, 'barangay_id' => $scope->id, 'review_status' => 'Approved']);
    $barrier = tempnam(sys_get_temp_dir(), 'p2-race-');
    unlink($barrier);
    $workers = [];
    try {
        for ($i = 0; $i < 2; $i++) {
            $pipes = [];
            $process = proc_open([PHP_BINARY, __DIR__.'/sql-worker.php', (string) $users[5]->id, $barrier], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            verify(is_resource($process), 'Unable to start SQL race worker.');
            fclose($pipes[0]);
            $workers[] = [$process, $pipes];
        }
        touch($barrier);
        $ids = [];
        foreach ($workers as [$process, $pipes]) {
            $output = stream_get_contents($pipes[1]);
            $error = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            verify(proc_close($process) === 0, 'Race worker failed: '.$error);
            $ids[] = json_decode($output, true, flags: JSON_THROW_ON_ERROR)['id'];
        }
        verify($ids[0] === $ids[1] && DB::table('emergency_alerts')->where('resident_id', $users[5]->id)->count() === 1, 'SOS race produced duplicates.');
    } finally {
        if (is_file($barrier)) {
            unlink($barrier);
        }
    }
});
caseTest('Resident alert revision includes sanitized nearby changes and stays stable otherwise', function () use ($revisionController, $residentRequest, $beforeNearby) {
    $current = $revisionController->show($residentRequest, 'alerts')->getData(true)['data']['revision'];
    verify($current !== $beforeNearby, 'Nearby SOS did not invalidate the subscribed alerts source.');
    verify($current === $revisionController->show($residentRequest, 'alerts')->getData(true)['data']['revision'], 'Unchanged source revision is unstable.');
});
caseTest('SQL reports retain Captain-only joins and truthful monthly counts', function () use ($app, $captain, $resident) {
    $reports = $app->make(ReportService::class);
    $snapshot = $reports->snapshot($captain);
    verify(count($snapshot['alerts']) === 3 && is_string($snapshot['activity_logs'][0]['summary']), 'Incomplete joined report snapshot.');
    expectsProblem(fn () => $reports->snapshot($resident), 'FORBIDDEN');
});
require __DIR__.'/http-cases.php';
require __DIR__.'/sql-races.php';
require __DIR__.'/sql-audit-capacity.php';
require __DIR__.'/sql-lock-order.php';
require __DIR__.'/sql-review.php';
require __DIR__.'/sql-form-revisions.php';
require __DIR__.'/sql-final-review.php';
require __DIR__.'/sql-photo-policy.php';
require __DIR__.'/sql-sms-denial.php';
require __DIR__.'/sql-photo-boundary.php';
echo 'MySQL '.$version.'; original controllers exercised over HTTP; full registered-browser acceptance and remaining cross-owner races are separate gates.'.PHP_EOL;

caseTest('SQL feedback picker retains scoped revision and rejects membership changes without effects', function () use ($civic, $resident, $captain, $scope) {
    require_once __DIR__.'/civic-evidence.php';
    $tanod = saveModel(User::class, ['barangay_id' => $scope->id, 'full_name' => 'Picker Tanod', 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active']);
    $membership = saveModel(TanodMembership::class, ['user_id' => $tanod->id, 'barangay_id' => $scope->id, 'active' => true]);
    $row = $civic->submitFeedback($resident, ['type' => 'suggestion', 'category' => 'Safety', 'description' => 'Picker fixture'], 'sql-picker-create');
    $options = $civic->feedbackAssignmentOptions($captain, $row['id']);
    verify($options['feedback_revision'] === 0 && in_array($tanod->id, array_column($options['tanods'], 'id'), true), 'Current local Tanod missing.');
    verify(array_keys($options['tanods'][0]) === ['id', 'full_name'], 'Picker leaked private account fields.');
    expectsProblem(fn () => $civic->feedbackAssignmentOptions($resident, $row['id']), 'FORBIDDEN');
    $membership->forceFill(['active' => false])->save();
    $before = civicDatabaseState(); // Baseline AFTER the deliberate authority mutation.
    verify(! in_array($tanod->id, array_column($civic->feedbackAssignmentOptions($captain, $row['id'])['tanods'], 'id'), true), 'Inactive membership remained available.');
    expectsProblem(fn () => $civic->assignFeedback($captain, $row['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]), 'VALIDATION');
    verify(civicDatabaseState() === $before && $civic->feedbackItem($resident, $row['id'])['revision'] === 0, 'Rejected selection changed stored rows/payloads/objects.');
    $membership->forceFill(['active' => true])->save();
    $tanod->forceFill(['account_status' => 'Inactive'])->save();
    $before = civicDatabaseState();
    expectsProblem(fn () => $civic->assignFeedback($captain, $row['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]), 'VALIDATION');
    verify(civicDatabaseState() === $before, 'Rejected inactive account changed stored rows.');
    $tanod->forceFill(['account_status' => 'Active'])->save();
    $before = civicDatabaseState();
    expectsProblem(fn () => $civic->assignFeedback($resident, $row['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]), 'FORBIDDEN');
    verify(civicDatabaseState() === $before, 'Unauthorized assignment changed stored rows.');
    $foreignScope = saveModel(Barangay::class, ['name' => 'Foreign civic scope']);
    $foreign = saveModel(User::class, ['barangay_id' => $foreignScope->id, 'full_name' => 'Foreign civic official', 'email' => bin2hex(random_bytes(8)).'@example.test', 'password' => 'Fixture123', 'account_status' => 'Active', 'is_captain' => true]);
    $foreignActor = app(ReferenceData::class)->actorFor($foreign->id);
    $before = civicDatabaseState();
    expectsProblem(fn () => $civic->feedbackAssignmentOptions($foreignActor, $row['id']), 'NOT_FOUND');
    expectsProblem(fn () => $civic->assignFeedback($foreignActor, $row['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]), 'NOT_FOUND');
    verify(civicDatabaseState() === $before, 'Foreign assignment changed stored rows.');
    $trace = [];
    $recording = true;
    DB::listen(function ($query) use (&$trace, &$recording) {
        if (! $recording || ! str_contains(strtolower($query->sql), 'for update')) {
            return;
        }
        foreach (['users', 'personnel_appointments', 'tanod_memberships', 'community_feedback'] as $table) {
            if (str_contains($query->sql, 'from `'.$table.'`')) {
                $trace[] = ['table' => $table, 'ids' => $table === 'users' ? civicLockedUserIds($query->sql, $query->bindings) : []];
            }
        }
    });
    try {
        $civic->assignFeedback($captain, $row['id'], ['tanod_id' => $tanod->id, 'expected_revision' => 0]);
    } finally {
        $recording = false;
    }
    $tables = array_column($trace, 'table');
    $boundary = array_search('community_feedback', $tables, true);
    verify($boundary !== false, 'Missing actual CivicService feedback lock trace.');
    foreach (['users', 'personnel_appointments', 'tanod_memberships'] as $table) {
        $first = array_search($table, $tables, true);
        verify($first !== false && $first < $boundary, 'Eligibility locks were not declared before feedback.');
    }
    foreach ($trace as $lock) {
        if ($lock['table'] === 'users') {
            verify(array_diff($lock['ids'], [$captain->id, $tanod->id]) === [], 'Civic service locked an undeclared user.');
        }
    }
    $before = civicDatabaseState();
    expectsProblem(fn () => $civic->resolveFeedback($captain, $row['id'], ['expected_revision' => 0]), 'CONFLICT');
    verify(civicDatabaseState() === $before, 'Stale completion changed rows/history/payloads/receipts/objects.');
    $civic->resolveFeedback($captain, $row['id'], ['expected_revision' => 1]);
});
