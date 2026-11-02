<?php

namespace App\Services\Messaging;

use App\Models\DeliveryReceipt;
use App\Models\OutboxEvent;
use App\Models\SmsDelivery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OutboxDispatcher
{
    public function dispatchOne(): bool
    {
        if (DB::transactionLevel() !== 0) {
            throw new \LogicException('dispatcher_requires_committed_connection');
        }
        $event = DB::transaction(function () {
            $event = OutboxEvent::whereNull('dispatched_at')->where('attempts', '<', 10)
                ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
                ->where(fn ($q) => $q->whereNull('lease_until')->orWhere('lease_until', '<', now()))
                ->orderByRaw("CASE WHEN type = 'alert.created.v1' THEN 0 ELSE 1 END")
                ->orderBy('id')->lock('FOR UPDATE SKIP LOCKED')->first();
            if (! $event) {
                return null;
            }
            $event->forceFill(['claim_token' => (string) Str::uuid(), 'lease_until' => now()->addSeconds(90), 'attempts' => $event->attempts + 1])->save();

            return $event;
        });
        if (! $event) {
            return false;
        }
        try {
            $definition = EventContract::definition($event);
            // Persist the routing intent before running P2's independent in-app channel.
            DB::transaction(function () use ($event, $definition) {
                $this->fence($event);
                foreach ($event->recipients as $recipient) {
                    foreach (['in_app', 'sms'] as $channel) {
                        if (! $recipient->$channel) {
                            continue;
                        }
                        $receipt = DeliveryReceipt::firstOrCreate(
                            ['outbox_event_id' => $event->id, 'recipient_id' => $recipient->recipient_id, 'channel' => $channel, 'template_key' => $event->template_key], []);
                        if ($channel === 'sms') {
                            SmsDelivery::firstOrCreate(['receipt_id' => $receipt->id], []);
                        }
                    }
                }
                if ($definition['route'] === 'make' && $event->recipients->contains('sms', true)) {
                    DB::table('make_dispatches')->insertOrIgnore(['outbox_event_id' => $event->id, 'created_at' => now(), 'updated_at' => now()]);
                }
            });
            foreach ($event->recipients->where('in_app', true) as $recipient) {
                DB::transaction(function () use ($event, $recipient) {
                    $this->fence($event);
                    $receipt = DeliveryReceipt::where('outbox_event_id', $event->id)->where('recipient_id', $recipient->recipient_id)->where('channel', 'in_app')->lockForUpdate()->firstOrFail();
                    if ($receipt->state === 'complete') {
                        return;
                    }
                    app(InAppNotificationHandler::class)->handle($event, $recipient);
                    $receipt->forceFill(['state' => 'complete', 'completed_at' => now()])->save();
                });
            }
            OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->update(['dispatched_at' => now(), 'lease_until' => null, 'claim_token' => null, 'last_error' => null]);
        } catch (\Throwable) {
            OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->update([
                'lease_until' => null, 'claim_token' => null, 'last_error' => 'dispatch_incomplete',
                'next_attempt_at' => now()->addSeconds(min(3600, 2 ** min(10, $event->attempts)) + random_int(1, 20)),
            ]);
        }

        return true;
    }

    private function fence(OutboxEvent $event): void
    {
        if (! OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->where('lease_until', '>', now())->lockForUpdate()->exists()) {
            throw new \RuntimeException('outbox_claim_lost');
        }
    }
}
