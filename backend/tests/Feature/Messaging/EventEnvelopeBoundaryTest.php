<?php

namespace Tests\Feature\Messaging;

use App\Models\DeliveryReceipt;
use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Models\SmsDelivery;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\InAppRecipientUnavailable;
use App\Services\Messaging\OutboxDispatcher;
use App\Services\Messaging\SmsDeliveryService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class EventEnvelopeBoundaryTest extends MessagingTestCase
{
    public function test_targeted_dispatch_does_not_consume_unrelated_committed_events(): void
    {
        $older = $this->canonicalEvent(0);
        $target = $this->canonicalEvent(0);
        app(OutboxDispatcher::class)->dispatchOne($target->event_id);
        $this->assertNotNull($target->fresh()->dispatched_at);
        $this->assertNull($older->fresh()->dispatched_at);
    }

    private function statusEvent(bool $sms = false): OutboxEvent
    {
        $event = OutboxEvent::forceCreate(['event_id' => (string) Str::uuid(), 'version' => 2, 'type' => 'incident.status_changed.v2',
            'barangay_id' => 1, 'resource_type' => 'incident', 'resource_id' => 1, 'occurred_at' => now(), 'payload' => ['status' => 'Acknowledged'], 'template_key' => 'incident-status-changed.v2']);
        DB::table('outbox_recipients')->insert(['outbox_event_id' => $event->id, 'recipient_id' => 1, 'barangay_id' => 1, 'audience' => 'official', 'in_app' => true, 'sms' => $sms]);

        return $event;
    }

    public function test_unknown_event_is_quarantined_once_without_success_receipts(): void
    {
        $event = $this->event();
        $event->forceFill(['type' => 'unregistered.prototype'])->save();
        app(OutboxDispatcher::class)->dispatchOne();
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertNotNull($event->fresh()->blocked_at);
        $this->assertSame('unknown_event_type', $event->fresh()->last_error);
        $this->assertSame(1, $event->fresh()->attempts);
        $this->assertSame(0, DB::table('delivery_receipts')->count());
        Http::assertNothingSent();
    }

    public function test_in_app_event_cannot_gain_sms_through_a_recipient_flag(): void
    {
        $event = $this->statusEvent(sms: true);
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertSame('sms_channel_not_authorized', $event->fresh()->last_error);
        $this->assertNotNull($event->fresh()->blocked_at);
        $this->assertSame(0, DB::table('sms_deliveries')->count());
        $this->assertSame(0, DB::table('delivery_receipts')->count());
    }

    public function test_event_time_status_and_channel_template_reach_the_handler_in_its_receipt_transaction(): void
    {
        $event = $this->statusEvent();
        DB::table('emergency_alerts')->where('id', 1)->update(['status' => 'Resolved']);
        app()->bind(InAppNotificationHandler::class, fn () => new class implements InAppNotificationHandler
        {
            public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
            {
                if (DB::transactionLevel() < 1 || $event->getConnection()->getName() !== DB::connection()->getName()) {
                    throw new \LogicException('wrong_connection');
                }
                DB::table('notifications')->insert(['event_id' => $event->event_id, 'recipient_id' => $recipient->recipient_id, 'barangay_id' => $event->barangay_id,
                    'resource_type' => $event->resource_type, 'resource_id' => $event->resource_id, 'audience' => $recipient->audience,
                    'kind' => 'alert_status', 'target' => 'official-alert.html?id=1', 'title' => 'Fixture', 'event_status' => $event->payload['status'], 'template_key' => 'incident-status-changed.in-app.v2', 'created_at' => $event->occurred_at]);
            }
        });
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertSame('Acknowledged', DB::table('notifications')->value('event_status'));
        $this->assertSame('incident-status-changed.in-app.v2', DB::table('delivery_receipts')->value('template_key'));
        $this->assertSame('complete', DB::table('delivery_receipts')->value('state'));
        $this->assertSame(0, DB::table('sms_deliveries')->count());
    }

    public function test_revoked_recipient_gets_a_failed_receipt_not_false_completion(): void
    {
        $this->statusEvent();
        app()->bind(InAppNotificationHandler::class, fn () => new class implements InAppNotificationHandler
        {
            public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
            {
                throw new InAppRecipientUnavailable;
            }
        });
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertSame('failed', DB::table('delivery_receipts')->value('state'));
        $this->assertSame('in_app_recipient_unavailable', DB::table('delivery_receipts')->value('diagnostic_code'));
        $this->assertSame(0, DB::table('notifications')->count());
    }

    public function test_unbound_real_handler_is_visible_and_terminal_until_reviewed_requeue(): void
    {
        $event = $this->statusEvent();
        app()->offsetUnset(InAppNotificationHandler::class);
        app(OutboxDispatcher::class)->dispatchOne();
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertSame('in_app_handler_unbound', $event->fresh()->last_error);
        $this->assertNotNull($event->fresh()->blocked_at);
        $this->assertSame('failed', DB::table('delivery_receipts')->value('state'));
    }

    public function test_all_fourteen_registered_shapes_work_with_the_contract_fake_without_sms(): void
    {
        for ($i = 0; $i < 14; $i++) {
            $this->canonicalEvent($i);
            app(OutboxDispatcher::class)->dispatchOne();
        }
        $this->assertSame(14, DB::table('delivery_receipts')->where('state', 'complete')->count());
        $this->assertSame(0, DB::table('outbox_events')->whereNotNull('blocked_at')->count());
        $this->assertSame(0, DB::table('sms_deliveries')->count());
    }

    public function test_v2_urgent_sms_uses_independent_channel_template_and_never_make(): void
    {
        $event = $this->canonicalEvent(0, sms: true);
        app(OutboxDispatcher::class)->dispatchOne();
        $d = SmsDelivery::firstOrFail();
        $this->assertSame('alert-review.v1', $d->receipt->template_key);
        $this->assertSame(1, DB::table('delivery_receipts')->where('template_key', 'incident-created.in-app.v2')->where('state', 'complete')->count());
        Http::fake(['*' => Http::response([['message_id' => 901, 'recipient' => '639171234567', 'status' => 'Pending']])]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('accepted', $d->fresh()->state);
        $this->assertSame(0, DB::table('make_dispatches')->count());
        Http::assertSentCount(1);
    }

    public function test_malformed_sms_ledger_cannot_bypass_the_event_channel_policy(): void
    {
        $event = $this->canonicalEvent(2);
        app(OutboxDispatcher::class)->dispatchOne();
        $receipt = DeliveryReceipt::create(['outbox_event_id' => $event->id, 'recipient_id' => 1, 'channel' => 'sms', 'template_key' => 'alert-review.v1']);
        $d = SmsDelivery::create(['receipt_id' => $receipt->id]);
        app(SmsDeliveryService::class)->send($d->id);
        $this->assertSame('blocked', $d->fresh()->state);
        Http::assertNothingSent();
    }

    public function test_v2_data_refuses_a_destructive_delivery_contract_downgrade(): void
    {
        $this->canonicalEvent(2);
        $migration = require __DIR__.'/../../../database/migrations/2026_11_03_000200_add_versioned_delivery_contract.php';
        $this->expectException(\RuntimeException::class);
        $migration->down();
    }
}
