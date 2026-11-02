<?php

namespace Tests\Feature\Messaging;

use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Models\SmsDelivery;
use App\Services\Messaging\EventContract;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\OutboxDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
                    'barangay_id' => $event->barangay_id, 'resource_type' => $event->resource_type, 'resource_id' => $event->resource_id, 'audience' => $recipient->audience,
                    'event_status' => $event->resource_type === 'incident' ? $event->payload['status'] : null,
                    'template_key' => EventContract::template(EventContract::definition($event), 'in_app'),
                    'kind' => 'fixture', 'target' => 'official-alert.html?id=1', 'title' => 'Fictional update', 'created_at' => $event->occurred_at, 'updated_at' => now()]);
            }
        });
    }

    protected function prepare(string $type = 'alert.created.v1'): SmsDelivery
    {
        $event = $this->event($type);
        app(OutboxDispatcher::class)->dispatchOne();

        return SmsDelivery::whereHas('receipt', fn ($q) => $q->where('outbox_event_id', $event->id))->firstOrFail();
    }

    protected function canonicalEvent(int $caseIndex, bool $sms = false): OutboxEvent
    {
        $fixture = json_decode(file_get_contents(__DIR__.'/../../Fixtures/events-v2.json'), true, flags: JSON_THROW_ON_ERROR);
        $case = array_intersect_key($fixture['valid'][$caseIndex], array_flip(['type', 'resource_type', 'template_key', 'payload']));
        $event = OutboxEvent::forceCreate(array_replace($fixture['base'], $case, ['event_id' => (string) Str::uuid()]));
        DB::table('outbox_recipients')->insert(['outbox_event_id' => $event->id, 'recipient_id' => 1, 'barangay_id' => 1, 'audience' => 'official', 'in_app' => true, 'sms' => $sms]);

        return $event;
    }
}
