<?php

namespace Tests\Feature\Messaging;

use App\Jobs\Messaging\DispatchOutbox;
use App\Jobs\Messaging\SendSms;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

class UrgentQueueIsolationTest extends MessagingTestCase
{
    public function test_unconfirmed_make_backlog_cannot_starve_new_urgent_sms(): void
    {
        // More than the scheduler batch size, all waiting for Make callbacks.
        for ($i = 0; $i < 501; $i++) {
            $event = $this->event('announcement.published.v1');
            $event->forceFill(['dispatched_at' => now()])->save();
            $receipt = DB::table('delivery_receipts')->insertGetId(['outbox_event_id' => $event->id, 'recipient_id' => 1, 'channel' => 'sms', 'template_key' => $event->template_key, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('sms_deliveries')->insert(['receipt_id' => $receipt, 'created_at' => now(), 'updated_at' => now()]);
        }
        $urgent = $this->prepare();
        Queue::fake();
        (new DispatchOutbox)->handle(app(OutboxDispatcher::class));
        Queue::assertPushedOn('sms-urgent', SendSms::class, fn ($job) => $job->deliveryId === $urgent->id);
        Queue::assertPushed(SendSms::class, 1);
    }
}
