<?php

namespace Tests\Feature;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Models\OutboxEvent;
use App\Models\SmsDelivery;
use App\Models\Verification;
use App\Providers\IntegrationServiceProvider;
use App\Services\Audit\AuditRecorder;
use App\Services\Civic\CivicService;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Services\Incidents\IncidentService;
use App\Services\Messaging\MakeSmsCommandService;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\OutboxWriter;
use App\Services\Messaging\SmsDeliveryService;
use App\Services\Messaging\SmsReserved;
use App\Services\P2\Actor;
use App\Services\P2\Persistence\TypedAuditRecorder;
use App\Services\P2\Persistence\TypedOutboxWriter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

/** Events originate in actual P2 source services, not handcrafted writer/worker fixtures. */
final class P2ConsentProducerTest extends TestCase
{
    use CombinedMysql;

    private CurrentSmsConsent $consent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
        $this->consent = new CurrentSmsConsent(app(Store::class), new IdentityReferences, new TypedAuditRecorder);
        $this->app->instance(SmsDeliveryEligibility::class, $this->consent);
        Http::preventStrayRequests();
    }

    private function actor($user): Actor
    {
        $observed = EffectiveIdentity::fromUser($user->fresh());

        return new Actor($observed->id, $observed->barangayId, $observed->role, $observed);
    }

    private function grant($user, string $purpose, string $state = 'granted'): void
    {
        $actor = $this->actor($user)->observedIdentity();
        $row = $this->consent->read($actor, $purpose);
        $this->consent->change($actor, $purpose, ['state' => $state, 'expected_revision' => $row['revision'],
            'policy_version' => CurrentSmsConsent::POLICY, 'template_version' => CurrentSmsConsent::TEMPLATES[$purpose]]);
    }

    private function incidents(): IncidentService
    {
        return new IncidentService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class), $this->smsOutbox(),
            static fn () => gmdate('Y-m-d\TH:i:s\Z'), null, $this->consent);
    }

    private function civic(): CivicService
    {
        return new CivicService(app(Store::class), app(ReferenceData::class), app(AuditRecorder::class), $this->smsOutbox(),
            static fn () => gmdate('Y-m-d\TH:i:s\Z'), $this->consent);
    }

    private function smsOutbox(): OutboxWriter
    {
        return new OutboxWriter(app(Store::class), static fn () => gmdate('Y-m-d\TH:i:s\Z'), new TypedOutboxWriter(allowSmsIntent: true));
    }

    private function resident(?int $scope = null)
    {
        $resident = $this->sourceUser('resident', $scope);
        Verification::forceCreate(['resident_id' => $resident->id, 'barangay_id' => $resident->barangay_id, 'review_status' => 'Approved']);

        return $resident;
    }

    public function test_actual_sos_source_intersects_minimal_audience_with_persisted_purpose_consent_before_source_locks(): void
    {
        $resident = $this->resident();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $secretary = $this->sourceUser('secretary', $resident->barangay_id);
        $foreign = $this->sourceUser('captain');
        $this->grant($captain, 'incident_review');
        $this->grant($secretary, 'barangay_announcements'); // Other purpose is not consent for SOS review.
        $this->grant($foreign, 'incident_review');
        $trace = [];
        DB::listen(function ($query) use (&$trace): void {
            if (str_contains($query->sql, 'for update')) {
                $trace[] = $query->sql;
            }
        });
        $source = $this->incidents()->create($this->actor($resident), [], 'consented-source-intent');
        $event = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->sole();
        $this->assertEqualsCanonicalizing([$captain->id, $secretary->id], $event->recipients->pluck('recipient_id')->all());
        $this->assertSame([$captain->id], $event->recipients->where('sms', true)->pluck('recipient_id')->all());
        $this->assertTrue($event->recipients->every(fn ($r) => $r->in_app));
        $this->assertTrue((bool) array_filter($trace, fn ($q) => str_contains($q, 'notification_preferences')));
        $trace = [];
        $this->grant($captain, 'incident_review', 'revoked');
        $trace = [];
        $this->incidents()->create($this->actor($resident), [], 'consented-source-intent');
        $this->assertSame([], array_values(array_filter($trace, fn ($q) => str_contains($q, 'notification_preferences'))));
        $this->assertSame(1, OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->count());
        Http::assertNothingSent();
    }

    public function test_actual_announcement_source_uses_resident_purpose_and_default_services_remain_in_app_only(): void
    {
        $captain = $this->sourceUser('captain');
        $resident = $this->resident($captain->barangay_id);
        $this->grant($resident, 'barangay_announcements');
        $source = $this->civic()->publish($this->actor($captain), ['title' => 'Fictional advisory', 'content' => 'Review the official notice.'], 'consented-publication-intent');
        $event = OutboxEvent::where('type', 'announcement.published.v2')->where('resource_id', $source['id'])->sole();
        $this->assertSame([$resident->id], $event->recipients->where('sms', true)->pluck('recipient_id')->all());
        $default = app(CivicService::class)->publish($this->actor($captain), ['title' => 'Default in-app notice', 'content' => 'Defaults remain disabled.'], 'default-publication-intent');
        $this->assertFalse(OutboxEvent::where('type', 'announcement.published.v2')->where('resource_id', $default['id'])->sole()->recipients->contains('sms', true));
        Http::assertNothingSent();
    }

    public function test_actual_source_event_reaches_current_worker_fake_transport_once_and_queue_revocation_blocks(): void
    {
        $resident = $this->resident();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        DB::table('users')->where('id', $captain->id)->update(['contact_number' => '09171234567']);
        $this->grant($captain, 'incident_review');
        config(['messaging.sms.enabled' => true, 'messaging.sms.key' => 'fake-key', 'messaging.sms.sender' => 'Approved',
            'messaging.sms.allowlist' => ['639171234567'], 'messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10]);
        Http::fake(function () {
            $this->assertSame(0, DB::transactionLevel());

            return Http::response([['message_id' => 901, 'recipient' => '639171234567', 'status' => 'Queued']]);
        });
        $source = $this->incidents()->create($this->actor($resident), [], 'worker-source-intent');
        $event = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->sole();
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $delivery = SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->sole();
        app(SmsDeliveryService::class)->send($delivery->id);
        app(SmsDeliveryService::class)->send($delivery->id);
        $this->assertSame('accepted', $delivery->fresh()->state);
        Http::assertSentCount(1);
        $this->assertSame(['reservation', 'pre_send'], DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->orderBy('id')->pluck('gate')->all());
        // A different actual resident source is queued, then consent changes before either worker gate.
        $next = $this->resident($resident->barangay_id);
        $source2 = $this->incidents()->create($this->actor($next), [], 'revoked-worker-source-intent');
        $event2 = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source2['id'])->sole();
        app(OutboxDispatcher::class)->dispatchOne($event2->event_id);
        $delivery2 = SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event2->id))->sole();
        $this->grant($captain, 'incident_review', 'revoked');
        app(SmsDeliveryService::class)->send($delivery2->id);
        $this->assertSame('blocked', $delivery2->fresh()->state);
        $this->assertSame('consent_denied', $delivery2->fresh()->last_error);
        Http::assertSentCount(1);
        $this->assertSame(0, DB::table('sms_authorizations')->where('sms_delivery_id', $delivery2->id)->count());
    }

    public function test_source_outbox_failure_rolls_back_command_and_retries_original_intent_once(): void
    {
        $resident = $this->resident();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        $this->grant($captain, 'incident_review');
        $before = DB::table('activity_logs')->count();
        $historyBefore = DB::table('incident_status_history')->count();
        $armed = true;
        DB::listen(function ($query) use (&$armed): void {
            if ($armed && str_starts_with($query->sql, 'insert into `outbox_recipients`')) {
                $armed = false;
                throw new \RuntimeException('injected actual source outbox failure');
            }
        });
        try {
            $this->incidents()->create($this->actor($resident), [], 'rollback-source-intent');
            $this->fail('Outbox fault did not roll back the source command.');
        } catch (\RuntimeException $error) {
            $this->assertSame('injected actual source outbox failure', $error->getMessage());
        }
        $this->assertFalse($armed);
        foreach (['emergency_alerts', 'outbox_events'] as $table) {
            $this->assertSame(0, DB::table($table)->where('barangay_id', $resident->barangay_id)->count());
        }
        $this->assertSame($historyBefore, DB::table('incident_status_history')->count());
        $this->assertSame($before, DB::table('activity_logs')->count());
        $this->assertSame(0, DB::table('idempotency_requests')->where('actor_id', $resident->id)->count());
        $source = $this->incidents()->create($this->actor($resident), [], 'rollback-source-intent');
        $this->incidents()->create($this->actor($resident), [], 'rollback-source-intent');
        $event = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->sole();
        $this->assertSame([$captain->id], $event->recipients->where('sms', true)->pluck('recipient_id')->all());
        Http::assertNothingSent();
    }

    public function test_actual_publication_event_and_existing_make_command_reach_worker_using_fake_http_only(): void
    {
        $captain = $this->sourceUser('captain');
        $resident = $this->resident($captain->barangay_id);
        DB::table('users')->where('id', $resident->id)->update(['contact_number' => '09171234567']);
        $this->grant($resident, 'barangay_announcements');
        config(['messaging.make.barangay_id' => $captain->barangay_id, 'messaging.sms.enabled' => true,
            'messaging.sms.key' => 'fake-key', 'messaging.sms.sender' => 'Approved', 'messaging.sms.allowlist' => ['639171234567'],
            'messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10]);
        Http::fake(function () {
            $this->assertSame(0, DB::transactionLevel());

            return Http::response([['message_id' => 902, 'recipient' => '639171234567', 'status' => 'Queued']]);
        });
        $notice = $this->civic()->publish($this->actor($captain), ['title' => 'Fictional worker notice', 'content' => 'Private fake transport acceptance.'], 'make-source-intent');
        $event = OutboxEvent::where('type', 'announcement.published.v2')->where('resource_id', $notice['id'])->sole();
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $delivery = SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->sole();
        app(SmsDeliveryService::class)->send($delivery->id);
        Http::assertNothingSent(); // Existing Make routing gate must be satisfied first.
        // In-process fake-only acceptance of DBA's explicit current Make enable/scope gate.
        // No webhook, scenario, environment or production worker is enabled.
        config(['messaging.make.enabled' => true]);
        $command = ['event_id' => $event->event_id, 'barangay_id' => $event->barangay_id, 'type' => $event->type, 'template_key' => $event->template_key];
        $this->assertTrue(app(MakeSmsCommandService::class)->accept($command));
        $this->assertFalse(app(MakeSmsCommandService::class)->accept($command));
        app(SmsDeliveryService::class)->send($delivery->id);
        $this->assertSame('accepted', $delivery->fresh()->state);
        Http::assertSentCount(1);
        $this->assertSame(2, DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->count());
        $this->assertSame([], $event->payload);
        $this->assertTrue(config('messaging.make.enabled'));
    }

    public function test_actual_source_final_gate_blocks_revocation_after_reservation(): void
    {
        $resident = $this->resident();
        $captain = $this->sourceUser('captain', $resident->barangay_id);
        DB::table('users')->where('id', $captain->id)->update(['contact_number' => '09171234567']);
        $this->grant($captain, 'incident_review');
        config(['messaging.sms.enabled' => true, 'messaging.sms.key' => 'fake-key', 'messaging.sms.sender' => 'Approved',
            'messaging.sms.allowlist' => ['639171234567'], 'messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10]);
        Http::fake();
        $source = $this->incidents()->create($this->actor($resident), [], 'final-gate-source-intent');
        $event = OutboxEvent::where('type', 'incident.created.v2')->where('resource_id', $source['id'])->sole();
        app(OutboxDispatcher::class)->dispatchOne($event->event_id);
        $delivery = SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->sole();
        Event::listen(SmsReserved::class, function () use ($captain): void {
            $this->grant($captain, 'incident_review', 'revoked');
        });
        try {
            app(SmsDeliveryService::class)->send($delivery->id);
        } finally {
            Event::forget(SmsReserved::class);
        }
        $this->assertSame('blocked', $delivery->fresh()->state);
        $this->assertSame('consent_denied', $delivery->fresh()->last_error);
        $this->assertSame(1, DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->where('gate', 'reservation')->count());
        $this->assertSame(0, DB::table('sms_authorizations')->where('sms_delivery_id', $delivery->id)->where('gate', 'pre_send')->count());
        Http::assertNothingSent();
    }
}
