<?php

namespace Tests\Feature\Messaging;

use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Models\SmsDelivery;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

abstract class MessagingTestCase extends MysqlDbaTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->fixtures();
        config(['messaging.sms.destination_pepper' => str_repeat('p', 32), 'messaging.sms.daily_segment_budget' => 10]);
        DB::table('users')->where('id', 1)->update(['contact_number' => '09171234567']);
        // Test double only. P2 supplies the real handler and its policies/DTOs.
        app()->bind(InAppNotificationHandler::class, fn () => new class implements InAppNotificationHandler
        {
            public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
            {
                DB::table('notifications')->insertOrIgnore(['event_id' => $event->event_id, 'recipient_id' => $recipient->recipient_id,
                    'kind' => 'fixture', 'target' => 'official-alert.html?id=1', 'title' => 'Fictional update', 'created_at' => now(), 'updated_at' => now()]);
            }
        });
    }

    protected function prepare(string $type = 'alert.created.v1'): SmsDelivery
    {
        $event = $this->event($type);
        app(OutboxDispatcher::class)->dispatchOne();

        return SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->firstOrFail();
    }
}
