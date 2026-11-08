<?php

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Contracts\P2\ReferenceData;
use App\Http\Controllers\P2\P2Controller;
use App\Models\Facility;
use App\Models\OutboxEvent;
use App\Models\Verification;
use App\Services\P2\Actor;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

$reviewFailures = [];
$review = function (string $name, Closure $work) use (&$reviewFailures) {
    try {
        $work();
        echo 'PASS '.$name.PHP_EOL;
    } catch (Throwable $error) {
        $reviewFailures[] = $name.': '.$error->getMessage();
        echo 'FAIL '.end($reviewFailures).PHP_EOL;
    }
};
$review('Inactive optional recipients do not block acknowledgment or transfer', function () use ($incidents, $captain, $racePerson) {
    $owner = $racePerson('resident');
    $responder = $racePerson('responder');
    $next = $racePerson('responder');
    $alert = $incidents->create($owner, [], 'inactive-recipient-sos');
    DB::table('users')->where('id', $owner->id)->update(['account_status' => 'Inactive']);
    $alert = $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    DB::table('users')->where('id', $responder->id)->update(['account_status' => 'Inactive']);
    $assignment = DB::table('alert_assignments')->where(['alert_id' => $alert['id'], 'status' => 'active'])->first();
    $alert = $incidents->changeAssignment($captain, $assignment->id, ['personnel_id' => $next->id, 'expected_revision' => $alert['assignment_revision'], 'reason' => 'Replace inactive fixture'], true);
    verify($alert['assigned_responder_id'] === $next->id, 'Inactive recipient blocked valid transfer.');
});
$review('Historical announcement title/content are restored from the persisted snapshot', function () use ($civic, $captain) {
    $item = $civic->publish($captain, ['title' => 'Original history title', 'content' => 'Original history content'], 'history-shape');
    $item = $civic->edit($captain, $item['id'], ['expected_revision' => 1, 'title' => 'New history title', 'content' => 'New content']);
    verify(($item['history'][0]['title'] ?? null) === 'Original history title' && ($item['history'][0]['content'] ?? null) === 'Original history content', 'Historical dialog snapshot fields absent.');
});
$review('Non-UTC announcement expiry retains its intended instant in MySQL', function () use ($civic, $captain) {
    $item = $civic->publish($captain, ['title' => 'Offset fixture', 'content' => 'UTC normalization', 'expires_at' => '2027-03-01T17:00:00+08:00'], 'offset-expiry');
    verify((new DateTimeImmutable($item['expires_at']))->setTimezone(new DateTimeZone('UTC'))->format('H:i:s') === '09:00:00', 'Submitted offset was lost.');
});
$review('Selected rescue destination is current even in a pre-existing repeatable-read snapshot', function () use ($incidents, $captain, $racePerson, $scope) {
    $owner = $racePerson('resident');
    $responder = $racePerson('responder');
    $rescuer = $racePerson('rescuer');
    $alert = $incidents->create($owner, [], 'facility-current-sos');
    $alert = $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
    $alert = $incidents->response($responder, $alert['id'], ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true], 'facility-current-response');
    $alert = $incidents->assign($captain, $alert['id'], ['role' => 'rescuer', 'personnel_id' => $rescuer->id, 'expected_revision' => $alert['assignment_revision']]);
    $facility = saveModel(Facility::class, ['managed_by_barangay_id' => $scope->id, 'name' => 'Current destination', 'type' => 'Evacuation Center', 'address' => 'Fixture', 'active' => true]);
    config(['database.connections.p2_second' => config('database.connections.mysql')]);
    DB::transaction(function () use ($incidents, $rescuer, $alert, $facility) {
        DB::table('facilities')->where('id', $facility->id)->first();
        DB::connection('p2_second')->table('facilities')->where('id', $facility->id)->update(['active' => false]);
        expectsProblem(fn () => $incidents->rescue($rescuer, $alert['id'], ['facility_id' => $facility->id, 'rescue_status' => 'In progress'], 'facility-current-rescue'), 'VALIDATION');
    });
    verify(DB::table('rescues')->where('alert_id', $alert['id'])->count() === 0, 'Inactive destination persisted.');
    DB::purge('p2_second');
});
$review('History sequence is current after another connection appends to an older snapshot', function () use ($incidents, $captain, $racePerson) {
    $owner = $racePerson('resident');
    $responder = $racePerson('responder');
    $alert = $incidents->create($owner, [], 'history-current-sos');
    config(['database.connections.p2_second' => config('database.connections.mysql')]);
    DB::transaction(function () use ($incidents, $captain, $responder, $alert) {
        DB::table('incident_status_history')->where('alert_id', $alert['id'])->max('sequence');
        DB::connection('p2_second')->table('incident_status_history')->insert(['alert_id' => $alert['id'], 'stage' => 'Pending', 'actor_id' => $captain->id, 'role_at_action' => 'captain', 'occurred_at' => gmdate('Y-m-d H:i:s'), 'sequence' => 2, 'evidence' => 'Independent fixture']);
        $incidents->assign($captain, $alert['id'], ['personnel_id' => $responder->id, 'expected_revision' => 0], true);
        verify(DB::table('incident_status_history')->where('alert_id', $alert['id'])->max('sequence') === 3, 'Current history sequence missing.');
    });
    DB::purge('p2_second');
});
$review('HTTP controller refuses a legacy gateway without captured-identity support', function () use ($resident, $users) {
    $legacy = Mockery::mock(ReferenceData::class);
    $legacy->shouldReceive('actorFor')->andReturn($resident);
    $controller = new class($legacy) extends P2Controller
    {
        public function identity(Request $request)
        {
            return $this->actor($request);
        }
    };
    $request = Request::create('/api/v1/alerts');
    $request->setUserResolver(fn () => $users[0]);
    expectsProblem(fn () => $controller->identity($request), 'UNAVAILABLE');
    Mockery::close();
});
$review('Announcement audiences over1000 produce bounded distinct transactional event chunks', function () use ($civic, $captain, $scope, $home, $users, $refs) {
    $rows = [];
    for ($i = 0; $i < 1001; $i++) {
        $rows[] = ['barangay_id' => $scope->id, 'household_id' => $home->id, 'full_name' => 'Fanout fixture', 'email' => 'fanout'.$i.'@example.test', 'password' => $users[0]->getRawOriginal('password'), 'account_status' => 'Active', 'is_resident' => true];
    }
    foreach (array_chunk($rows, 250) as $batch) {
        DB::table('users')->insert($batch);
    }
    $expected = count(array_filter($refs->forActor($captain)->people($scope->id), fn ($p) => in_array($p['role'], ['resident', 'captain', 'secretary'], true)));
    $item = $civic->publish($captain, ['title' => 'Large audience', 'content' => 'Bounded fanout'], 'large-fanout');
    $events = OutboxEvent::query()->where(['resource_type' => 'announcement', 'resource_id' => $item['id']])->get();
    verify($events->count() === (int) ceil($expected / 1000) && $events->pluck('event_id')->unique()->count() === $events->count(), 'Fanout event IDs/count incorrect.');
    $total = 0;
    foreach ($events as $event) {
        $count = DB::table('outbox_recipients')->where('outbox_event_id', $event->id)->count();
        verify($count <= 1000, 'Fanout chunk exceeds limit.');
        $total += $count;
    }
    verify($total === $expected, 'Fanout lost or duplicated recipients.');
});
$review('Current residency approval is obtained through the actor-bound P1 reference', function () use ($racePerson, $incidents, $scope) {
    $owner = $racePerson('resident');
    DB::table('verifications')->where('resident_id', $owner->id)->update(['review_status' => 'Expired']);
    DB::table('verifications')->where('resident_id', $owner->id)->update(['review_status' => 'Expired']);
    saveModel(Verification::class, ['resident_id' => $owner->id, 'barangay_id' => $scope->id, 'review_status' => 'Pending']);
    expectsProblem(fn () => $incidents->create($owner, [], 'latest-approval-sos'), 'FORBIDDEN');
});
$review('P1 source projections retain the observed actor and reject cross-scope references', function () use ($refs, $captain, $scope) {
    $bound = $refs->forActor($captain);
    verify($bound->barangay($scope->id)['id'] === $scope->id, 'Bound projection missing.');
    expectsProblem(fn () => $bound->facilities($scope->id + 100000), 'FORBIDDEN');
    $forged = new Actor($captain->id, $captain->barangayId, 'resident', $captain->observedIdentity());
    expectsProblem(fn () => $refs->forActor($forged), 'AUTH');
});
$review('Assigned household source policy revokes the old responder on transfer', function () use ($refs, $captain, $incidents, $racePerson, $scope) {
    $owner = $racePerson('resident');
    $first = $racePerson('responder');
    $next = $racePerson('responder');
    $alert = $incidents->create($owner, [], 'source-policy-sos');
    $alert = $incidents->assign($captain, $alert['id'], ['personnel_id' => $first->id, 'expected_revision' => 0], true);
    verify($refs->forActor($first)->household($owner->id, $scope->id) !== null, 'Assigned household missing.');
    $assignment = DB::table('alert_assignments')->where(['alert_id' => $alert['id'], 'status' => 'active'])->first();
    $incidents->changeAssignment($captain, $assignment->id, ['personnel_id' => $next->id, 'expected_revision' => $alert['assignment_revision'], 'reason' => 'Policy fixture'], true);
    try {
        $refs->forActor($first)->household($owner->id, $scope->id);
        throw new RuntimeException('Transferred responder retained household access.');
    } catch (ApiProblem $error) {
        verify($error->errorCode === 'FORBIDDEN', 'Wrong policy rejection.');
    }
});
$review('Typed outbox validates the intended recipient audience', function () use ($resident, $captain, $incidents, $app) {
    $owner = $resident;
    $alert = $incidents->list($owner)[0];
    $rejected = false;
    try {
        DB::transaction(function () use ($alert, $captain, $app) {
            $app->make(OutboxWriter::class)->record(
                new EventId((string) Str::uuid()), 'incident.status_changed.v2', $captain->barangayId, $alert['id'],
                [new RecipientReference($captain->id, true, false, 'resident')], new DateTimeImmutable,
                EventContext::forEvent('incident.status_changed.v2', ['status' => 'Resolved'])
            );
        });
    } catch (InvalidArgumentException) {
        $rejected = true;
    }
    verify($rejected, 'A recipient audience hint was silently changed.');
});
$review('Typed feedback accepts its exact bound family snapshot', function () use ($civic, $resident, $captain, $app) {
    $item = $civic->submitFeedback($resident, ['type' => 'complaint', 'category' => 'Drainage', 'description' => 'Typed context fixture'], 'typed-feedback-snapshot');
    DB::transaction(function () use ($item, $captain, $app) {
        $app->make(OutboxWriter::class)->record(
            new EventId((string) Str::uuid()), 'feedback.updated.v2', $captain->barangayId, $item['id'], [], new DateTimeImmutable,
            EventContext::forEvent('feedback.updated.v2', ['kind' => 'complaint', 'status' => 'Pending'])
        );
    });
});
if ($reviewFailures) {
    throw new RuntimeException(implode(PHP_EOL, $reviewFailures));
}
