<?php

namespace Tests\Feature\Messaging;

use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class OutboxRecoveryTest extends MessagingTestCase
{
    public function test_rollback_leaves_no_event_notification_or_send(): void
    {
        DB::beginTransaction();
        $this->event();
        DB::rollBack();
        $this->assertFalse(app(OutboxDispatcher::class)->dispatchOne());
        $this->assertSame(0, DB::table('notifications')->count());
        $this->assertSame(0, DB::table('sms_deliveries')->count());
        Http::assertNothingSent();
    }

    public function test_dispatcher_refuses_to_run_inside_an_uncommitted_domain_transaction(): void
    {
        DB::beginTransaction();
        try {
            $this->expectException(\LogicException::class);
            app(OutboxDispatcher::class)->dispatchOne();
        } finally {
            DB::rollBack();
        }
    }

    public function test_expired_outbox_claim_recovers_and_finished_channel_stays_complete(): void
    {
        $event = $this->event();
        $event->forceFill(['claim_token' => (string) Str::uuid(), 'lease_until' => now()->subMinute()])->save();
        app(OutboxDispatcher::class)->dispatchOne();
        $event->fresh()->forceFill(['dispatched_at' => null, 'next_attempt_at' => null])->save();
        app()->bind(InAppNotificationHandler::class, fn () => new class implements InAppNotificationHandler
        {
            public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
            {
                throw new \RuntimeException('Completed in-app channel was incorrectly repeated');
            }
        });
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertNotNull($event->fresh()->dispatched_at);
        $this->assertSame(1, DB::table('notifications')->count());
        $this->assertSame(1, DB::table('sms_deliveries')->count());
    }

    public function test_in_app_failure_does_not_discard_sms_routing_intent(): void
    {
        app()->bind(InAppNotificationHandler::class, fn () => new class implements InAppNotificationHandler
        {
            public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
            {
                throw new \RuntimeException('fake in-app failure');
            }
        });
        $event = $this->event();
        app(OutboxDispatcher::class)->dispatchOne();
        $this->assertNull($event->fresh()->dispatched_at);
        $this->assertSame(1, DB::table('sms_deliveries')->count());
        $this->assertSame('pending', DB::table('delivery_receipts')->where('channel', 'in_app')->value('state'));
    }
}
