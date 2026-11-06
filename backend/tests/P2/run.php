<?php

declare(strict_types=1);

// Dependency-free contract tests. No Laravel scaffold, schema or real providers are created.
spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'App\\')) {
        $file = __DIR__.'/../../app/'.str_replace('\\', '/', substr($class, 4)).'.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
require __DIR__.'/support.php';

use App\Contracts\P2\TanodReferences;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use App\Services\Messaging\CreateInAppNotification;
use App\Services\Messaging\NotificationService;
use App\Services\Messaging\OutboxWriter;
use App\Services\P2\Actor;
use App\Services\P2\Problem;
use App\Services\Reports\ReportService;

$count = 0;
$failures = 0;
function commandKey(): string
{
    static $n = 0;

    return 'test-command-'.(++$n);
}
function check(string $name, Closure $test): void
{
    global $count,$failures;
    try {
        $test();
        $count++;
        echo "PASS $name\n";
    } catch (Throwable $e) {
        $failures++;
        echo "FAIL $name: ".$e->getMessage()."\n";
    }
}
function eq(mixed $a, mixed $b): void
{
    if ($a !== $b) {
        throw new RuntimeException('Expected '.var_export($b, true).', got '.var_export($a, true));
    }
}
function denied(Closure $test, string $code): void
{
    try {
        $test();
    } catch (Problem $e) {
        eq($e->errorCode, $code);

        return;
    } throw new RuntimeException('Expected '.$code);
}
function fixture(): array
{
    $s = new MemoryStore;
    $r = new References;
    $clock = fn () => '2026-11-02T08:00:00+00:00';
    $audit = new AuditRecorder($s, $clock);
    $outbox = new OutboxWriter($s, $clock);
    $i = new IncidentService($s, $r, $audit, $outbox, $clock);
    $c = new CivicService($s, $r, $audit, $outbox, $clock);

    return [$s, $r, $i, $c, new NotificationService($s, $r, $clock), new CreateInAppNotification($s, $r, $clock), new ReportService($s, $r, $clock, $i, $c)];
}
function who(int $id): Actor
{
    return (new References)->actorFor($id);
}
function sos(IncidentService $i): array
{
    return $i->create(who(1), ['alert_type' => 'Flood', 'victim_count' => 2], 'request-00000001');
}
function ack(IncidentService $i, int $id = 1): array
{
    return $i->assign(who(2), $id, ['role' => 'responder', 'personnel_id' => 4, 'expected_revision' => 0], true);
}

check('SOS is persisted once, carries no automatic assignments, and records transactional event', function () {
    [$s,$r,$i] = fixture();
    $a = sos($i);
    eq($a['status'], 'Pending');
    eq($a['assigned_responder_id'], null);
    eq(sos($i)['id'], $a['id']);
    eq(count($s->rows['emergency_alerts']), 1);
    eq(count($s->rows['outbox_events']), 1);
});
check('Idempotency key cannot be reused with another payload', function () {
    [,,$i] = fixture();
    sos($i);
    denied(fn () => $i->create(who(1), ['alert_type' => 'Fire'], 'request-00000001'), 'CONFLICT');
});
check('Unverified resident, forged tenant and operational roles cannot create SOS', function () {
    [$s,$r,$i] = fixture();
    $r->approved = false;
    denied(fn () => sos($i), 'FORBIDDEN');
    $r->approved = true;
    denied(fn () => $i->create(who(4), [], 'request-00000002'), 'FORBIDDEN');
    denied(fn () => $i->create(who(1), ['barangay_id' => 2], 'request-00000003'), 'VALIDATION');
});
check('Failed outbox append rolls back SOS and audit', function () {
    [$s,,$i] = fixture();
    $s->failTable = 'outbox_events';
    try {
        sos($i);
    } catch (RuntimeException $e) {
    } eq(count($s->rows['emergency_alerts'] ?? []), 0);
    eq(count($s->rows['activity_logs'] ?? []), 0);
});
check('Acknowledge requires selection, stale revision fails, unrelated role cannot read', function () {
    [,,$i] = fixture();
    sos($i);
    denied(fn () => $i->assign(who(2), 1, ['expected_revision' => 0], true), 'VALIDATION');
    ack($i);
    denied(fn () => $i->assign(who(2), 1, ['role' => 'responder', 'personnel_id' => 7, 'expected_revision' => 0]), 'CONFLICT');
    denied(fn () => $i->get(who(7), 1), 'NOT_FOUND');
});
check('Cross-barangay and other-resident access never reveal incident', function () {
    [,,$i] = fixture();
    sos($i);
    denied(fn () => $i->get(who(9), 1), 'NOT_FOUND');
    denied(fn () => $i->get(who(8), 1), 'NOT_FOUND');
});
check('Response requires boolean rescue assessment and does not dispatch rescuer', function () {
    [$s,,$i] = fixture();
    sos($i);
    ack($i);
    denied(fn () => $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Responding', 'notes' => 'On site'], commandKey()), 'VALIDATION');
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true, 'notes' => 'On site'], commandKey());
    eq($a['status'], 'Responding');
    eq($a['assigned_rescuer_id'], null);
    eq(count($s->rows['alert_assignments']), 1);
});
check('Completed no-rescue response releases slot and requires explicit official resolution', function () {
    [$s,,$i] = fixture();
    sos($i);
    ack($i);
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false, 'notes' => 'Safe'], commandKey());
    eq($a['status'], 'Responding');
    eq($a['active_responder_assignment'], false);
    $a = $i->resolve(who(2), 1, ['expected_revision' => $a['assignment_revision']]);
    eq($a['status'], 'Resolved');
    eq($a['timeline'][3]['at'], null);
});
check('Rescue-required branch rejects early resolution and retains destination snapshot', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true, 'notes' => 'Transport needed'], commandKey());
    denied(fn () => $i->resolve(who(2), 1, ['expected_revision' => $a['assignment_revision']]), 'INVALID_STATE');
    $a = $i->assign(who(2), 1, ['role' => 'rescuer', 'personnel_id' => 5, 'expected_revision' => $a['assignment_revision']]);
    $a = $i->rescue(who(5), 1, ['rescue_status' => 'Completed', 'facility_id' => 1, 'notes' => 'Arrived'], commandKey());
    eq($a['status'], 'Rescue in progress');
    eq($a['active_rescuer_assignment'], false);
    $r->activeFacility = false;
    eq($i->get(who(2), 1)['rescues'][0]['facility']['name'], 'School');
    $i->resolve(who(2), 1, ['expected_revision' => $a['assignment_revision']]);
});
check('Ordinary responder capacity, inactive staff, Secretary override and default-disabled Captain override', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    foreach ([21, 22] as $id) {
        $s->insert('alert_assignments', ['alert_id' => $id, 'barangay_id' => 1, 'role' => 'responder', 'user_id' => 4, 'status' => 'active']);
    } denied(fn () => ack($i), 'CAPACITY');
    denied(fn () => $i->assign(who(2), 1, ['role' => 'responder', 'personnel_id' => 4, 'expected_revision' => 0, 'override' => ['confirmed' => true, 'reason' => 'Emergency']], true), 'FORBIDDEN');
    denied(fn () => $i->assign(who(3), 1, ['role' => 'responder', 'personnel_id' => 4, 'expected_revision' => 0, 'override' => ['confirmed' => true, 'reason' => 'Emergency']], true), 'FORBIDDEN');
});
check('Nearby data is coarse and does not leak resident, household or free text', function () {
    [,,$i] = fixture();
    sos($i);
    $a = $i->nearby(who(8))[0];
    eq(isset($a['resident_id']), false);
    eq(isset($a['household_id']), false);
    eq(isset($a['resident']), false);
    eq($a['map_x'], 30);
    eq($a['location_label'], 'Barangay One');
});
check('Resident patch cannot change lifecycle or another resident incident', function () {
    [,,$i] = fixture();
    sos($i);
    denied(fn () => $i->details(who(1), 1, ['status' => 'Resolved']), 'VALIDATION');
    denied(fn () => $i->details(who(8), 1, ['description' => 'Bad']), 'NOT_FOUND');
    eq($i->details(who(1), 1, ['victim_count' => null])['victim_count'], null);
});
check('Civic mutation is scoped, versioned, audited and cannot edit expired announcement', function () {
    [$s,$r,$i,$c] = fixture();
    $a = $c->publish(who(2), ['title' => 'Notice', 'content' => 'Community update'], commandKey());
    denied(fn () => $c->edit(who(9), $a['id'], ['title' => 'X', 'expected_revision' => 1]), 'NOT_FOUND');
    denied(fn () => $c->edit(who(2), $a['id'], ['title' => 'X', 'expected_revision' => 0]), 'CONFLICT');
    $c->archive(who(2), $a['id'], ['expected_revision' => 1]);
    eq(count($c->announcements(who(1))), 0);
});
check('General feedback remains separate; operational feedback uses eligible Tanod', function () {
    [$s,$r,$i,$c] = fixture();
    $g = $c->submitFeedback(who(1), ['type' => 'general', 'rating' => 4, 'comment' => 'Useful'], commandKey());
    denied(fn () => $c->assignFeedback(who(2), $g['id'], ['tanod_id' => 6, 'expected_revision' => 0]), 'INVALID_STATE');
    $f = $c->submitFeedback(who(1), ['type' => 'suggestion', 'category' => 'Safety', 'description' => 'Add signs', 'location' => 'Street'], commandKey());
    $f = $c->assignFeedback(who(2), $f['id'], ['tanod_id' => 6, 'expected_revision' => 0]);
    eq($f['status'], 'Assigned');
    eq($c->resolveFeedback(who(2), $f['id'], ['expected_revision' => 1])['status'], 'Resolved');
});
check('In-app handler is idempotent, channel-specific and recipient-scoped', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    sos($i);
    $event = $s->rows['outbox_events'][0];
    $handler->handle($event);
    $handler->handle($event);
    eq(count($s->rows['notifications']), 2);
    $items = $n->list(who(2));
    eq(count($items), 1);
    denied(fn () => $n->setRead(who(8), $items[0]['id'], true), 'NOT_FOUND');
    $n->setRead(who(2), $items[0]['id'], true);
    eq($n->clearRead(who(2)), 1);
    eq(count($n->list(who(2))), 0);
    eq(count($n->list(who(3))), 1);
});
check('Feedback picker is scoped, read-only and denies stale or ineligible assignment', function () {
    [$s,$r,$i,$c] = fixture();
    $f = $c->submitFeedback(who(1), ['type' => 'complaint', 'category' => 'Drainage', 'description' => 'Drain blocked'], commandKey());
    $before = $s->rows;
    $options = $c->feedbackAssignmentOptions(who(2), $f['id']);
    eq($options['feedback_revision'], 0);
    eq(array_column($options['tanods'], 'id'), [6]);
    eq($s->rows, $before);
    denied(fn () => $c->feedbackAssignmentOptions(who(1), $f['id']), 'FORBIDDEN');
    denied(fn () => $c->feedbackAssignmentOptions(who(9), $f['id']), 'NOT_FOUND');
    $r->inactive = [6];
    eq($c->feedbackAssignmentOptions(who(3), $f['id'])['tanods'], []);
    denied(fn () => $c->assignFeedback(who(2), $f['id'], ['tanod_id' => 6, 'expected_revision' => 0]), 'VALIDATION');
    eq($s->rows, $before);
    $r->inactive = [];
    $c->assignFeedback(who(2), $f['id'], ['tanod_id' => 6, 'expected_revision' => 0]);
    $assigned = $s->rows;
    denied(fn () => $c->resolveFeedback(who(2), $f['id'], ['expected_revision' => 0]), 'CONFLICT');
    eq($s->rows, $assigned);
    $g = $c->submitFeedback(who(1), ['type' => 'general', 'rating' => 4, 'comment' => 'Useful'], commandKey());
    denied(fn () => $c->feedbackAssignmentOptions(who(2), $g['id']), 'INVALID_STATE');
});
check('Feedback picker uses the active-membership read port when available', function () {
    [$store,$refs] = fixture();
    $refs = new class extends References implements TanodReferences
    {
        public function feedbackTanods(int $barangay): array
        {
            return [];
        }
    };
    $clock = fn () => '2026-11-02T08:00:00+00:00';
    $civic = new CivicService($store, $refs, new AuditRecorder($store, $clock), new OutboxWriter($store, $clock), $clock);
    $row = $civic->submitFeedback(who(1), ['type' => 'complaint', 'category' => 'Safety', 'description' => 'Fixture'], commandKey());
    eq($civic->feedbackAssignmentOptions(who(2), $row['id'])['tanods'], []);
});
check('Reports are Captain-only, count distinct incidents and use Manila month boundaries', function () {
    [$s,$r,$i,$c,$n,$handler,$reports] = fixture();
    sos($i);
    denied(fn () => $reports->summary(who(2), '2026-11'), 'FORBIDDEN');
    $x = $reports->summary(who(3), '2026-11');
    eq($x['incidents'], 1);
    eq($x['average_response_minutes'], null);
    eq($reports->summary(who(3), '2026-10')['incidents'], 0);
    denied(fn () => $reports->summary(who(3), '2026-13'), 'VALIDATION');
});

check('Archived announcement may be retracted with a reason but never edited', function () {
    [,,$i,$c] = fixture();
    $a = $c->publish(who(2), ['title' => 'Notice', 'content' => 'Update'], commandKey());
    $a = $c->archive(who(2), $a['id'], ['expected_revision' => 1]);
    denied(fn () => $c->edit(who(2), $a['id'], ['expected_revision' => 2, 'title' => 'Wrong']), 'INVALID_STATE');
    eq($c->retract(who(2), $a['id'], ['expected_revision' => 2, 'reason' => 'Superseded'])['status'], 'Retracted');
});
check('Report snapshot retains joined timeline/logs and frontend audit keys', function () {
    [$s,$r,$i,$c,$n,$h,$reports] = fixture();
    sos($i);
    ack($i);
    $x = $reports->snapshot(who(3));
    eq($x['alerts'][0]['resident']['id'], 1);
    eq(count($x['alerts'][0]['timeline']), 5);
    eq($x['activity_logs'][0]['entity'], 'alert');
    eq(isset($x['activity_logs'][0]['at']), true);
});
check('Response-time metric uses first response, not acknowledgment; Manila boundary is inclusive', function () {
    [$s,$r,$i,$c,$n,$h,$reports] = fixture();
    sos($i);
    ack($i);
    eq($reports->summary(who(3), '2026-11')['average_response_minutes'], null);
    $s->update('emergency_alerts', 1, ['created_at' => '2026-10-31T16:00:00+00:00']);
    $s->insert('alert_responses', ['barangay_id' => 1, 'alert_id' => 1, 'responder_id' => 4, 'response_status' => 'Responding', 'responded_at' => '2026-10-31T16:10:00+00:00']);
    $s->insert('alert_responses', ['barangay_id' => 1, 'alert_id' => 1, 'responder_id' => 4, 'response_status' => 'Responding', 'responded_at' => '2026-10-31T16:20:00+00:00']);
    eq($reports->summary(who(3), '2026-11')['average_response_minutes'], 10.0);
});
check('Rescuer capacity and inactive destination reject without corrupting assignments', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => true, 'notes' => 'Transport'], commandKey());
    $busy = $s->insert('alert_assignments', ['alert_id' => 99, 'barangay_id' => 1, 'role' => 'rescuer', 'user_id' => 5, 'status' => 'active']);
    denied(fn () => $i->assign(who(2), 1, ['role' => 'rescuer', 'personnel_id' => 5, 'expected_revision' => $a['assignment_revision']]), 'CAPACITY');
    $s->update('alert_assignments', $busy['id'], ['status' => 'completed']);
    $i->assign(who(2), 1, ['role' => 'rescuer', 'personnel_id' => 5, 'expected_revision' => $a['assignment_revision']]);
    $r->activeFacility = false;
    denied(fn () => $i->rescue(who(5), 1, ['rescue_status' => 'Completed', 'facility_id' => 1], commandKey()), 'VALIDATION');
    eq(count($s->select('rescues')), 0);
});
check('Transfers/cancellation preserve history and reject stale repeated action', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    $a = ack($i);
    denied(fn () => $i->changeAssignment(who(2), 1, ['personnel_id' => 7, 'expected_revision' => 1, 'reason' => 'Cover'], true), 'FORBIDDEN');
    $a = $i->changeAssignment(who(3), 1, ['personnel_id' => 7, 'expected_revision' => 1, 'reason' => 'Cover'], true);
    eq($a['assigned_responder_id'], 7);
    eq($s->rows['alert_assignments'][0]['status'], 'reassigned');
    $a = $i->changeAssignment(who(3), 2, ['expected_revision' => $a['assignment_revision'], 'reason' => 'No longer available'], false);
    eq($a['assigned_responder_id'], null);
    denied(fn () => $i->changeAssignment(who(3), 2, ['expected_revision' => 1, 'reason' => 'Again'], false), 'CONFLICT');
});
check('Outbox and audit refuse nontransactional writes', function () {
    [$s] = fixture();
    try {
        (new OutboxWriter($s, fn () => '2026-11-02T00:00:00Z'))->record(bin2hex(random_bytes(16)), 'incident.created', 1, 1, [], '2026-11-02T00:00:00Z');
    } catch (LogicException $e) {
        eq(count($s->select('outbox_events')), 0);

        return;
    }throw new RuntimeException('Missing transaction guard');
});
check('In-app handler ignores forged event payload and notification URL', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    sos($i);
    $event = $s->rows['outbox_events'][0];
    $event['payload']['recipients'] = [['user_id' => 8, 'audience' => 'resident', 'channels' => ['in_app']]];
    $handler->handle($event);
    eq(count($n->list(who(8))), 0);
    $id = $n->list(who(2))[0]['id'];
    $s->update('notifications', $id, ['link' => 'https://attacker.invalid/']);
    eq($n->list(who(2))[0]['link'], 'official-alert.html?id=1');
    eq($n->clearRead(who(2)), 0);
});
check('CSV export cells neutralize spreadsheet formulas and quote content', function () {
    eq(ReportService::csvCell(' =cmd'), "\"' =cmd\"");
    eq(ReportService::csvCell('a"b'), '"a""b"');
});

check('Inactive candidate and revoked actor are rejected after fresh locked reads', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    $r->inactive = [4];
    denied(fn () => ack($i), 'VALIDATION');
    $r->inactive = [2];
    denied(fn () => ack($i), 'FORBIDDEN');
    eq(count($s->select('alert_assignments')), 0);
});
check('Cannot declare rescue unnecessary while an active rescuer is assigned', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true], commandKey());
    $i->assign(who(2), 1, ['role' => 'rescuer', 'personnel_id' => 5, 'expected_revision' => $a['assignment_revision']]);
    denied(fn () => $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Completed', 'rescue_required' => false], commandKey()), 'INVALID_STATE');
});
check('Notification bulk mutation and reads reject revoked accounts', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    sos($i);
    $handler->handle($s->rows['outbox_events'][0]);
    $r->inactive = [2];
    denied(fn () => $n->markAllRead(who(2)), 'FORBIDDEN');
    denied(fn () => $n->list(who(2)), 'FORBIDDEN');
});
check('Performance retains historical role work even without reconstructed audit', function () {
    [$s,$r,$i,$c,$n,$h,$reports] = fixture();
    $r->roles[4] = 'secretary';
    $s->insert('alert_responses', ['barangay_id' => 1, 'alert_id' => 1, 'responder_id' => 4, 'response_status' => 'Completed', 'responded_at' => '2026-11-02T08:00:00Z']);
    $p = $reports->performance(who(3), '2026-11', 'responder')['personnel'];
    eq(count($p), 2);
    eq(array_values(array_filter($p, fn ($p) => $p['id'] === 4))[0]['completed_responses'], 1);
});
check('Announcement projections retain retraction reason and responsible actor', function () {
    [,,$i,$c] = fixture();
    $a = $c->publish(who(2), ['title' => 'Notice', 'content' => 'Update'], commandKey());
    $a = $c->retract(who(3), $a['id'], ['expected_revision' => 1, 'reason' => 'Incorrect']);
    eq($a['retracted_by'], 3);
    eq($a['retraction_reason'], 'Incorrect');
    eq($a['retracted_at'], '2026-11-02T08:00:00+00:00');
});
check('Retrying the same response key does not append logs or outbox twice', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $input = ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true];
    $i->response(who(4), 1, $input, 'response-retry-01');
    $events = count($s->select('outbox_events'));
    $i->response(who(4), 1, $input, 'response-retry-01');
    eq(count($s->select('alert_responses')), 1);
    eq(count($s->select('outbox_events')), $events);
    denied(fn () => $i->response(who(4), 1, array_replace($input, ['notes' => 'Different']), 'response-retry-01'), 'CONFLICT');
});
check('Publish and feedback retry keys preserve single source event', function () {
    [$s,$r,$i,$c] = fixture();
    foreach ([1, 2] as $repeat) {
        $c->publish(who(2), ['title' => 'Notice', 'content' => 'Update'], 'notice-retry-001');
        $c->submitFeedback(who(1), ['type' => 'general', 'rating' => 4, 'comment' => 'Useful'], 'feedback-retry-1');
    } eq(count($s->select('announcements')), 1);
    eq(count($s->select('community_feedback')), 1);
    eq(count($s->select('outbox_events')), 2);
});
check('Feedback allows optional location, retains created_at and cannot reassign Assigned', function () {
    [,,,$c] = fixture();
    $f = $c->submitFeedback(who(1), ['type' => 'complaint', 'category' => 'Drainage', 'description' => 'Clear the drain'], commandKey());
    eq(isset($f['created_at']), true);
    $c->assignFeedback(who(2), $f['id'], ['tanod_id' => 6, 'expected_revision' => 0]);
    denied(fn () => $c->assignFeedback(who(2), $f['id'], ['tanod_id' => 6, 'expected_revision' => 1]), 'INVALID_STATE');
});
check('Assignment picker exposes selected state and assignment flags used by current UI', function () {
    [,,$i] = fixture();
    sos($i);
    ack($i);
    $x = $i->assignmentOptions(who(3), 1, 'responder');
    eq($x['alert_id'], 1);
    eq($x['active_responder_assignment'], true);
    $person = array_values(array_filter($x['personnel'], fn ($p) => $p['id'] === 4))[0];
    eq($person['assigned'], true);
    eq($person['available'], false);
});
check('Dashboard and map aggregates preserve own scope and public nearby privacy', function () {
    [$s,$r,$i,$c] = fixture();
    sos($i);
    ack($i);
    $x = new OverviewService($s, $r, $i, $c, fn () => '2026-11-02T08:00:00Z');
    eq($x->dashboard(who(4))['active_alerts'], 1);
    eq($x->dashboard(who(7))['active_alerts'], 0);
    $map = $x->map(who(8));
    eq(isset($map['alerts'][0]['resident']), false);
    eq($map['household']['id'], 8);
});

check('Nearby filters search only sanitized fields and sort by occurrence', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    eq(count($i->nearby(who(8), ['q' => 'Private Street'])), 0);
    eq(count($i->nearby(who(8), ['q' => 'A-1'])), 1);
});
check('Expiry is scoped, persists one history action, and is retry-safe', function () {
    [$s,$r,$i,$c] = fixture();
    $a = $c->publish(who(2), ['title' => 'Notice', 'content' => 'Update'], commandKey());
    $s->update('announcements', $a['id'], ['expires_at' => '2026-11-01T00:00:00Z']);
    eq($c->expireOverdue(who(9)), 0);
    eq($c->expireOverdue(who(2)), 1);
    eq($c->expireOverdue(who(2)), 0);
    eq(count($s->select('announcement_history')), 2);
    eq($c->announcement(who(2), 1)['archived_at'], '2026-11-01T00:00:00Z');
});
check('Impossible expiry date is rejected rather than silently rolled forward', function () {
    [,,,$c] = fixture();
    denied(fn () => $c->publish(who(2), ['title' => 'Notice', 'content' => 'Update', 'expires_at' => '2027-02-30T08:00:00Z'], commandKey()), 'VALIDATION');
});
check('Failed transfer restores previous assignment and sorted guards', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $s->failTable = 'outbox_events';
    try {
        $i->changeAssignment(who(3), 1, ['personnel_id' => 7, 'expected_revision' => 1, 'reason' => 'Cover'], true);
    } catch (RuntimeException $e) {
    } eq($i->get(who(3), 1)['assigned_responder_id'], 4);
    eq($s->select('alert_assignments')[0]['status'], 'active');
    eq(end($s->locks), ['person:3', 'person:4', 'person:7', 'incident:1']);
});
check('Recipient mutations hide a notification after assignment access is lost', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    sos($i);
    ack($i);
    $event = end($s->rows['outbox_events']);
    $handler->handle($event);
    $id = $n->list(who(4))[0]['id'];
    $i->changeAssignment(who(3), 1, ['personnel_id' => 7, 'expected_revision' => 1, 'reason' => 'Cover'], true);
    eq(count($n->list(who(4))), 0);
    denied(fn () => $n->setRead(who(4), $id, true), 'NOT_FOUND');
});
check('Explicit enabled Captain override still requires confirmation and records reason', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    foreach ([21, 22] as $id) {
        $s->insert('alert_assignments', ['alert_id' => $id, 'barangay_id' => 1, 'role' => 'responder', 'user_id' => 4, 'status' => 'active']);
    } $i->capacityOverrideEnabled = true;
    denied(fn () => $i->assign(who(3), 1, ['personnel_id' => 4, 'expected_revision' => 0, 'override' => ['reason' => 'Emergency']], true), 'VALIDATION');
    $a = $i->assign(who(3), 1, ['personnel_id' => 4, 'expected_revision' => 0, 'override' => ['confirmed' => true, 'reason' => 'Emergency']], true);
    eq($a['assignments'][0]['override_by'], 3);
    eq($a['assignments'][0]['override_reason'], 'Emergency');
});
check('Delayed notification preserves recorded event status instead of later source state', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    sos($i);
    $created = $s->select('outbox_events')[0];
    ack($i);
    $handler->handle($created);
    eq($n->list(who(2))[0]['event_status'], 'Pending');
});
check('Explicit resident filters restrict administrator alert and feedback lists', function () {
    [,,$i,$c] = fixture();
    sos($i);
    $c->submitFeedback(who(1), ['type' => 'general', 'rating' => 4, 'comment' => 'Useful'], commandKey());
    eq(count($i->list(who(2), ['resident_id' => 8])), 0);
    eq(count($c->feedback(who(2), ['resident_id' => 8])), 0);
    denied(fn () => $c->feedback(who(1), ['resident_id' => 8]), 'FORBIDDEN');
});
check('Transferred responder must supply current-assignment assessment before rescuer dispatch', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    ack($i);
    $a = $i->response(who(4), 1, ['response_type' => 'Assessment', 'response_status' => 'Responding', 'rescue_required' => true], commandKey());
    $a = $i->changeAssignment(who(3), 1, ['personnel_id' => 7, 'expected_revision' => $a['assignment_revision'], 'reason' => 'Shift change'], true);
    eq($a['rescue_required'], null);
    eq($a['can_assign_rescuer'], false);
    denied(fn () => $i->assign(who(2), 1, ['role' => 'rescuer', 'personnel_id' => 5, 'expected_revision' => $a['assignment_revision']]), 'INVALID_STATE');
    eq(count($a['responses']), 1);
});
check('Feedback notifications link to the corresponding authorized category', function () {
    [$s,$r,$i,$c,$n,$handler] = fixture();
    foreach (['suggestion', 'general'] as $type) {
        $input = $type === 'general' ? ['type' => $type, 'rating' => 4, 'comment' => 'Useful'] : ['type' => $type, 'category' => 'Safety', 'description' => 'Signs'];
        $f = $c->submitFeedback(who(1), $input, commandKey());
        $handler->handle(end($s->rows['outbox_events']));
        $items = $n->list(who(2));
        $notice = array_values(array_filter($items, fn ($n) => $n['resource_id'] === $f['id']))[0];
        eq($notice['link'], 'official-feedback.html?type='.$type.'&id='.$f['id']);
    }
});
check('Snapshot audit entries contain display text and canonical record links', function () {
    [$s,$r,$i,$c,$n,$h,$reports] = fixture();
    sos($i);
    $snapshot = $reports->snapshot(who(3));
    eq(is_string($snapshot['activity_logs'][0]['summary']), true);
    eq($snapshot['activity_logs'][0]['href'], 'official-alert.html?id=1');
});
check('New assignment records retain responsible official names', function () {
    [,,$i] = fixture();
    sos($i);
    $a = ack($i);
    eq($a['responder_assigned_by_name'], 'Person 2');
    eq($a['assignments'][0]['assigned_by_name'], 'Person 2');
});
check('SOS retry fingerprint uses submitted payload rather than mutable household defaults', function () {
    [$s,$r,$i] = fixture();
    sos($i);
    $r->homeAddress = 'Updated household';
    eq(sos($i)['id'], 1);
    eq($i->get(who(1), 1)['location_label'], 'Private Street');
});
check('SOS history and outbox share event time even when the clock advances between calls', function () {
    $store = new MemoryStore;
    $refs = new References;
    $tick = 0;
    $clock = function () use (&$tick) {
        return gmdate(DATE_ATOM, 1793606400 + $tick++);
    };
    $service = new IncidentService($store, $refs, new AuditRecorder($store, $clock), new OutboxWriter($store, $clock), $clock);
    $service->create(who(1), [], 'advancing-clock');
    eq($store->select('incident_status_history')[0]['occurred_at'], $store->select('outbox_events')[0]['occurred_at']);
});

check('Civic evidence detects changed payload with identical row counts and ignores row ordering', function () {
    if (is_file(__DIR__.'/civic-evidence.php')) {
        require_once __DIR__.'/civic-evidence.php';
    }
    eq(function_exists('civicRowsHash'), true);
    $rows = [['id' => 1, 'payload' => ['a' => 1, 'b' => 2]], ['id' => 2, 'text' => 'safe']];
    eq(civicRowsHash($rows), civicRowsHash(array_reverse($rows)));
    eq(civicRowsHash($rows), civicRowsHash([['payload' => ['b' => 2, 'a' => 1], 'id' => 1], $rows[1]]));
    $changed = $rows;
    $changed[0]['payload']['b'] = 3;
    eq(civicRowsHash($rows) === civicRowsHash($changed), false);
    eq(civicRowsHash($rows) === civicRowsHash([$rows[0], $rows[0]]), false);
});

echo "$count P2 contract checks passed; $failures failed. Database/HTTP integration is not tested by this runner.\n";
exit($failures ? 1 : 0);
