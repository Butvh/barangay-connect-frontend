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
            $urgentTypes = array_keys(array_filter(config('messaging.events'), fn ($d) => $d['route'] === 'urgent'));
            $event = OutboxEvent::whereNull('blocked_at')->whereNull('dispatched_at')->where('attempts', '<', 10)
                ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
                ->where(fn ($q) => $q->whereNull('lease_until')->orWhere('lease_until', '<', now()))
                ->orderByRaw('CASE WHEN type IN ('.implode(',', array_fill(0, count($urgentTypes), '?')).') THEN 0 ELSE 1 END', $urgentTypes)
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
            $event->load('recipients');
            if ($event->recipients->count() > 1000) {
                throw new EventContractViolation('recipient_batch_limit');
            }
            foreach ($event->recipients as $recipient) {
                EventContract::recipient($event, $recipient, $definition);
            }
            // Persist the routing intent before running P2's independent in-app channel.
            DB::transaction(function () use ($event, $definition) {
                $this->fence($event);
                foreach ($event->recipients as $recipient) {
                    foreach (['in_app', 'sms'] as $channel) {
                        if (! $recipient->$channel) {
                            continue;
                        }
                        $receipt = DeliveryReceipt::firstOrCreate(
                            ['outbox_event_id' => $event->id, 'recipient_id' => $recipient->recipient_id, 'channel' => $channel, 'template_key' => EventContract::template($definition, $channel)], []);
                        if ($channel === 'sms') {
                            SmsDelivery::firstOrCreate(['receipt_id' => $receipt->id], []);
                        }
                    }
                }
                if ($definition['route'] === 'make' && $event->recipients->contains('sms', true)) {
                    DB::table('make_dispatches')->insertOrIgnore(['outbox_event_id' => $event->id, 'created_at' => now(), 'updated_at' => now()]);
                }
            });
            $recipientFailed = false;
            foreach ($event->recipients->where('in_app', true) as $recipient) {
                try {
                    DB::transaction(function () use ($event, $recipient, $definition) {
                        $this->fence($event);
                        $receipt = DeliveryReceipt::where('outbox_event_id', $event->id)->where('recipient_id', $recipient->recipient_id)->where('channel', 'in_app')->where('template_key', EventContract::template($definition, 'in_app'))->lockForUpdate()->firstOrFail();
                        if ($receipt->state !== 'pending') {
                            return;
                        }
                        if (! app()->bound(InAppNotificationHandler::class)) {
                            throw new EventContractViolation('in_app_handler_unbound');
                        }
                        $handler = app(InAppNotificationHandler::class);
                        if (! $handler instanceof InAppNotificationHandler) {
                            throw new EventContractViolation('in_app_handler_signature_mismatch');
                        }
                        $level = DB::transactionLevel();
                        $handler->handle($event, $recipient);
                        if (DB::transactionLevel() !== $level) {
                            throw new EventContractViolation('in_app_transaction_changed');
                        }
                        $notification = DB::table('notifications')->where('event_id', $event->event_id)->where('recipient_id', $recipient->recipient_id)->first();
                        if (! $notification) {
                            throw new EventContractViolation('in_app_result_missing');
                        }
                        if ($event->version === 2 && ($notification->template_key !== $receipt->template_key || $notification->barangay_id !== $event->barangay_id
                            || $notification->resource_type !== $event->resource_type || $notification->resource_id !== $event->resource_id || $notification->audience !== $recipient->audience
                            || $notification->event_status !== ($event->resource_type === 'incident' ? $event->payload['status'] : null))) {
                            throw new EventContractViolation('in_app_result_contract_mismatch');
                        }
                        $receipt->forceFill(['state' => 'complete', 'completed_at' => now()])->save();
                    });
                } catch (InAppRecipientUnavailable $e) {
                    $this->failReceipt($event, $recipient->recipient_id, $e->getMessage());
                    $recipientFailed = true;
                } catch (EventContractViolation $e) {
                    $this->failReceipt($event, $recipient->recipient_id, $e->getMessage());
                    throw $e;
                }
            }
            OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->update(['dispatched_at' => now(), 'lease_until' => null, 'claim_token' => null, 'last_error' => $recipientFailed ? 'in_app_recipient_unavailable' : null]);
        } catch (EventContractViolation $e) {
            OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->update([
                'blocked_at' => now(), 'claim_token' => null, 'lease_until' => null, 'next_attempt_at' => null, 'last_error' => $e->getMessage(),
            ]);
        } catch (\Throwable) {
            OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->update([
                'lease_until' => null, 'claim_token' => null, 'last_error' => $event->attempts >= 10 ? 'dispatch_attempts_exhausted' : 'dispatch_incomplete',
                'blocked_at' => $event->attempts >= 10 ? now() : null,
                'next_attempt_at' => now()->addSeconds(min(3600, 2 ** min(10, $event->attempts)) + random_int(1, 20)),
            ]);
        }

        return true;
    }

    private function failReceipt(OutboxEvent $event, int $recipientId, string $code): void
    {
        DB::transaction(function () use ($event, $recipientId, $code) {
            $this->fence($event);
            DeliveryReceipt::where('outbox_event_id', $event->id)->where('recipient_id', $recipientId)->where('channel', 'in_app')->where('state', 'pending')
                ->update(['state' => 'failed', 'diagnostic_code' => $code, 'failed_at' => now()]);
        });
    }

    private function fence(OutboxEvent $event): void
    {
        if (! OutboxEvent::whereKey($event->id)->where('claim_token', $event->claim_token)->where('lease_until', '>', now())->lockForUpdate()->exists()) {
            throw new \RuntimeException('outbox_claim_lost');
        }
    }
}
