<?php

namespace Tests\Feature;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Models\OutboxEvent;
use App\Models\TanodMembership;
use App\Providers\IntegrationServiceProvider;
use App\Services\Administration\PersonnelAdministration;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\ProfileAdministration;
use App\Services\Messaging\NotificationService;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\P2\Persistence\ReferenceData;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

/** Actual owner producers/dispatcher, not a replacement source or writer. */
final class P2AdministrativeNotificationsTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_actual_self_profile_event_dispatches_once_without_private_source_data(): void
    {
        $user = $this->sourceUser('secretary');
        $other = $this->sourceUser('resident', $user->barangay_id);
        app(ProfileAdministration::class)->update(EffectiveIdentity::fromUser($user), ['full_name' => 'Fictional updated secretary']);
        $event = OutboxEvent::where('type', 'profile.updated.v2')->where('resource_id', $user->id)->sole();
        $this->assertSame([$user->id], $event->recipients->pluck('recipient_id')->all());
        $this->assertFalse($event->recipients->first()->sms);
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $this->assertSame(1, DB::table('notifications')->where('event_id', $event->event_id)->count());
        $this->assertSame(0, DB::table('notifications')->where('event_id', $event->event_id)->where('recipient_id', $other->id)->count());
        $items = app(NotificationService::class)->list(app(ReferenceData::class)->actorFor($user->id));
        $this->assertCount(1, $items);
        $this->assertSame('official-profile.html', $items[0]['link']);
        $json = json_encode($items, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString($user->email, $json);
        $this->assertStringNotContainsString($user->password, $json);
    }

    public function test_actual_facility_event_uses_manager_scope_and_loses_access_after_role_removal(): void
    {
        $captain = $this->sourceUser('captain');
        $secretary = $this->sourceUser('secretary', $captain->barangay_id);
        $resident = $this->sourceUser('resident', $captain->barangay_id);
        $foreign = $this->sourceUser('captain');
        $facility = app(FacilityAdministration::class)->save(EffectiveIdentity::fromUser($captain), null,
            ['name' => 'Fictional notification facility', 'type' => 'EvacuationCenter', 'address' => 'School Street', 'capacity' => 250]);
        $event = OutboxEvent::where('type', 'facility.updated.v2')->where('resource_id', $facility['id'])->sole();
        $this->assertEqualsCanonicalizing([$captain->id, $secretary->id], $event->recipients->pluck('recipient_id')->all());
        $this->assertNotContains($resident->id, $event->recipients->pluck('recipient_id')->all());
        $this->assertNotContains($foreign->id, $event->recipients->pluck('recipient_id')->all());
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $refs = app(ReferenceData::class);
        $this->assertCount(1, app(NotificationService::class)->list($refs->actorFor($captain->id)));
        DB::table('users')->where('id', $captain->id)->update(['is_captain' => false]);
        $this->assertSame([], app(NotificationService::class)->list($refs->actorFor($captain->id)));
    }

    public function test_actual_writer_rejects_admin_source_wrong_recipient_and_sms_with_atomic_rollback(): void
    {
        $owner = $this->sourceUser('secretary');
        $other = $this->sourceUser('secretary', $owner->barangay_id);
        $before = DB::table('outbox_events')->count();
        foreach ([new RecipientReference($other->id, true, false, 'official'), new RecipientReference($owner->id, true, true, 'official')] as $recipient) {
            try {
                DB::transaction(fn () => app(OutboxWriter::class)->record(new EventId((string) Str::uuid()), 'profile.updated.v2',
                    $owner->barangay_id, $owner->id, [$recipient], new \DateTimeImmutable('now', new \DateTimeZone('UTC')),
                    EventContext::forEvent('profile.updated.v2', [])));
                $this->fail('Private own-account source or in-app-only boundary was bypassed.');
            } catch (\LogicException) {
            }
            $this->assertSame($before, DB::table('outbox_events')->count());
        }
    }

    public function test_dispatcher_recipient_projection_does_not_take_user_locks_after_receipt_claim(): void
    {
        $user = $this->sourceUser('secretary');
        app(ProfileAdministration::class)->update(EffectiveIdentity::fromUser($user), ['full_name' => 'Fictional lock trace']);
        $event = OutboxEvent::where('type', 'profile.updated.v2')->where('resource_id', $user->id)->sole();
        $late = [];
        DB::listen(function ($query) use (&$late): void {
            if (str_contains($query->sql, '`users`') && str_contains($query->sql, 'for update')) {
                $late[] = $query->sql;
            }
        });
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $this->assertSame([], $late, 'Display-only recipient resolution locked users after the outbox/receipt.');
    }

    public function test_actual_personnel_transitions_notify_only_captain_and_current_eligible_subject(): void
    {
        $captain = $this->sourceUser('captain');
        $secretary = $this->sourceUser('secretary', $captain->barangay_id);
        $subject = $this->sourceUser('resident', $captain->barangay_id);
        TanodMembership::forceCreate(['user_id' => $subject->id, 'barangay_id' => $captain->barangay_id, 'active' => true]);
        $service = app(PersonnelAdministration::class);
        $actor = EffectiveIdentity::fromUser($captain);
        $date = now('Asia/Manila')->format('Y-m-d');
        $appointed = $service->change($actor, $subject->id, 'appoint', ['role' => 'responder', 'effective_date' => $date, 'expected_revision' => 0]);
        $event = OutboxEvent::where('type', 'personnel.updated.v2')->where('resource_id', $subject->fresh()->appointment->id)->sole();
        $this->assertEqualsCanonicalizing([$captain->id, $subject->id], $event->recipients->pluck('recipient_id')->all());
        $this->assertFalse($event->recipients->first()->sms);
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $refs = app(ReferenceData::class);
        $notifications = app(NotificationService::class);
        $this->assertSame('captain-personnel.html?id='.$subject->id, $notifications->list($refs->actorFor($captain->id))[0]['link']);
        $this->assertSame('official-profile.html', $notifications->list($refs->actorFor($subject->id))[0]['link']);
        $this->assertSame([], $notifications->list($refs->actorFor($secretary->id)));
        $this->assertStringNotContainsString($subject->email, json_encode($notifications->list($refs->actorFor($captain->id)), JSON_THROW_ON_ERROR));
        $reassigned = $service->change($actor, $subject->id, 'reassign', ['role' => 'rescuer', 'effective_date' => $date, 'expected_revision' => $appointed['revision']]);
        $queued = OutboxEvent::where('type', 'personnel.updated.v2')->where('resource_id', $event->resource_id)->orderByDesc('id')->first();
        $removed = $service->change($actor, $subject->id, 'remove', ['effective_date' => $date, 'expected_revision' => $reassigned['revision']]);
        $removal = OutboxEvent::where('type', 'personnel.updated.v2')->where('resource_id', $event->resource_id)->orderByDesc('id')->first();
        $this->assertSame('Unassigned', $removed['status']);
        $this->assertSame([$captain->id], $removal->recipients->pluck('recipient_id')->all());
        app(OutboxDispatcher::class)->dispatchOne($queued->event_id);
        app(OutboxDispatcher::class)->dispatchOne($removal->event_id);
        app(OutboxDispatcher::class)->dispatchOne($removal->event_id);
        $this->assertSame(0, DB::table('notifications')->where('event_id', $queued->event_id)->where('recipient_id', $subject->id)->count());
        $this->assertSame([], $notifications->list($refs->actorFor($subject->id)));
        $this->assertSame(1, DB::table('notifications')->where('event_id', $removal->event_id)->count());
        $this->assertCount(3, $notifications->list($refs->actorFor($captain->id)));
    }
}
