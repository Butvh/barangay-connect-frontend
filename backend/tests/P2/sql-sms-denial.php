<?php

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\RecipientReference;
use App\Services\P2\Persistence\TypedOutboxWriter;
use Illuminate\Support\Facades\DB;

caseTest('Actual incident and announcement producers reject client channel authority and never infer consent from phone or global switches', function () use ($racePerson, $incidents, $civic, $captain) {
    $resident = $racePerson('resident');
    $before = array_map(fn ($table) => DB::table($table)->count(), ['emergency_alerts', 'announcements', 'outbox_events', 'idempotency_requests']);
    foreach (['sms' => true, 'channels' => ['sms'], 'phone' => '09171234567', 'message' => 'Client body', 'template' => 'client'] as $field => $value) {
        expectsProblem(fn () => $incidents->create($resident, [$field => $value], 'sms-deny-incident-'.$field), 'VALIDATION');
        expectsProblem(fn () => $civic->publish($captain, ['title' => 'Denied fixture', 'content' => 'Fixture', $field => $value], 'sms-deny-announcement-'.$field), 'VALIDATION');
    }
    verify($before === array_map(fn ($table) => DB::table($table)->count(), ['emergency_alerts', 'announcements', 'outbox_events', 'idempotency_requests']), 'Rejected channel body left partial state.');
    $previous = [config('messaging.sms.enabled'), config('messaging.make.enabled')];
    config(['messaging.sms.enabled' => true, 'messaging.make.enabled' => true]);
    try {
        DB::table('users')->whereIn('id', [$resident->id, $captain->id])->update(['contact_number' => '09171234567']);
        $alert = $incidents->create($resident, [], 'sms-default-deny-sos');
        $published = $civic->publish($captain, ['title' => 'In-app fixture', 'content' => 'No SMS consent authority exists.'], 'sms-default-deny-publish');
        $events = DB::table('outbox_events')->where(function ($q) use ($alert, $published) {
            $q->where(fn ($q) => $q->where('type', 'incident.created.v2')->where('resource_id', $alert['id']))
                ->orWhere(fn ($q) => $q->where('type', 'announcement.published.v2')->where('resource_id', $published['id']));
        })->pluck('id');
        // Announcement fanout may emit multiple bounded event chunks for this fixture scope.
        verify(count($events) >= 2 && DB::table('outbox_events')->whereIn('id', $events)->distinct()->count('type') === 2, 'Actual producer families missing.');
        $recipients = DB::table('outbox_recipients')->whereIn('outbox_event_id', $events)->get();
        verify($recipients->isNotEmpty() && $recipients->every(fn ($r) => $r->in_app && ! $r->sms), 'Phone/global setting became SMS authority.');
        foreach ([['incident.created.v2', $alert['id'], new EventContext('Pending')], ['announcement.published.v2', $published['id'], new EventContext]] as [$type, $id, $context]) {
            foreach ([new RecipientReference($captain->id, true, true), new RecipientReference($captain->id, false, true)] as $ref) {
                $eventCount = DB::table('outbox_events')->count();
                try {
                    DB::transaction(fn () => (new TypedOutboxWriter)->record(EventId::generate(), $type, $captain->barangayId, $id, [$ref], new DateTimeImmutable, $context));
                    throw new RuntimeException('Unsupported SMS reference accepted.');
                } catch (LogicException $e) {
                    verify($e->getMessage() === 'Use distinct in-app-only recipient references.', 'Wrong channel denial.');
                }
                verify(DB::table('outbox_events')->count() === $eventCount, 'Denied SMS event escaped caller rollback.');
            }
        }
        verify(DB::table('sms_deliveries')->count() === 0 && DB::table('make_dispatches')->count() === 0, 'Provider work was created.');
    } finally {
        config(['messaging.sms.enabled' => $previous[0], 'messaging.make.enabled' => $previous[1]]);
    }
});
