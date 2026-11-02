<?php

namespace App\Services\Messaging;

use App\Models\SmsDelivery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SmsDeliveryService
{
    public function __construct(private SemaphoreClient $client, private RateGate $rate) {}

    public function send(int $id): void
    {
        if (DB::transactionLevel() !== 0) {
            throw new \LogicException('sms_requires_committed_connection');
        }
        $delivery = DB::transaction(function () use ($id) {
            $d = SmsDelivery::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($d->state === 'sending') {
                if ($d->lease_until?->isPast()) {
                    $d->forceFill(['state' => 'uncertain', 'last_error' => 'worker_lost_after_claim', 'claim_token' => null, 'lease_until' => null])->save();
                    DB::table('sms_attempts')->where('sms_delivery_id', $d->id)->where('outcome', 'started')->update(['outcome' => 'uncertain', 'error_class' => 'worker_lost_after_claim', 'finished_at' => now()]);
                }

                return null;
            }
            if ($d->state !== 'pending' || ($d->next_attempt_at && $d->next_attempt_at->isFuture())) {
                return null;
            }
            if ($d->attempts >= config('messaging.sms.max_attempts')) {
                $this->block($d, 'attempts_exhausted');

                return null;
            }
            $event = $d->receipt->event;
            try {
                $definition = EventContract::definition($event);
                $recipient = $event->recipients()->where('recipient_id', $d->receipt->recipient_id)->first();
                if (! $recipient || ! $recipient->sms || $d->receipt->channel !== 'sms' || $d->receipt->template_key !== EventContract::template($definition, 'sms')) {
                    throw new EventContractViolation('sms_receipt_not_authorized');
                }
                EventContract::recipient($event, $recipient, $definition);
            } catch (EventContractViolation $e) {
                $this->block($d, $e->getMessage());

                return null;
            }
            if ($definition['route'] === 'make' && ! DB::table('make_commands')->where('outbox_event_id', $event->id)->exists()) {
                return null;
            }
            $user = $d->receipt->recipient;
            if (! $user || $user->account_status !== 'Active' || $user->barangay_id !== $event->barangay_id) {
                $this->block($d, 'recipient_unavailable');

                return null;
            }
            try {
                $number = $d->destination ?? PhoneNumber::normalize($user->contact_number ?? '');
            } catch (\InvalidArgumentException) {
                $this->block($d, 'invalid_destination');

                return null;
            }
            if (! config('messaging.sms.enabled') || ! config('messaging.sms.key') || ! config('messaging.sms.sender') || ! config('messaging.sms.destination_pepper')) {
                $this->block($d, 'provider_disabled');

                return null;
            }
            if (! in_array($number, config('messaging.sms.allowlist', []), true)) {
                $this->block($d, 'destination_not_approved');

                return null;
            }
            $segments = SemaphoreClient::segments(EventContract::message($event));
            if ($segments > config('messaging.sms.max_segments')) {
                $this->block($d, 'segment_limit');

                return null;
            }
            if ($wait = $this->rate->take('messages_post', 120)) {
                $d->forceFill(['next_attempt_at' => now()->addSeconds($wait)])->save();

                return null;
            }
            if (! $d->budget_reserved_at) {
                $day = now()->timezone('Asia/Manila')->toDateString();
                DB::table('messaging_budgets')->insertOrIgnore(['day' => $day, 'reserved_segments' => 0]);
                $budget = DB::table('messaging_budgets')->where('day', $day)->lockForUpdate()->first();
                if ($budget->reserved_segments + $segments > config('messaging.sms.daily_segment_budget', 0)) {
                    $this->block($d, 'daily_budget_exhausted');

                    return null;
                }
                DB::table('messaging_budgets')->where('day', $day)->increment('reserved_segments', $segments);
            }
            $d->forceFill(['destination' => $number, 'destination_digest' => hash_hmac('sha256', $number, config('messaging.sms.destination_pepper')),
                'estimated_segments' => $segments, 'budget_reserved_at' => $d->budget_reserved_at ?? now(), 'state' => 'sending', 'attempts' => $d->attempts + 1,
                'claim_token' => (string) Str::uuid(), 'lease_until' => now()->addSeconds(config('messaging.sms.lease_seconds')), 'last_error' => null])->save();
            DB::table('sms_attempts')->insert(['sms_delivery_id' => $d->id, 'attempt' => $d->attempts, 'claim_token' => $d->claim_token, 'outcome' => 'started', 'started_at' => now()]);

            return $d;
        });
        if (! $delivery) {
            return;
        }
        try {
            $result = $this->client->send($delivery->destination, EventContract::message($delivery->receipt->event));
            $this->finish($delivery, $result);
        } catch (TransportFailure $e) {
            if ($e->getMessage() === 'rate_limited') {
                $this->rate->block('messages_post', $e->retryAfter ?? 60);
            }
            DB::transaction(function () use ($delivery, $e) {
                $d = SmsDelivery::whereKey($delivery->id)->where('claim_token', $delivery->claim_token)->lockForUpdate()->first();
                if (! $d) {
                    return;
                }
                $retry = ! $e->uncertain && $e->retryAfter !== null && $d->attempts < config('messaging.sms.max_attempts');
                $delay = max($e->retryAfter ?? 0, min(3600, 30 * 2 ** $d->attempts) + random_int(1, 20));
                $d->forceFill(['state' => $e->uncertain ? 'uncertain' : ($retry ? 'pending' : 'blocked'), 'last_error' => $e->getMessage(),
                    'claim_token' => null, 'lease_until' => null, 'next_attempt_at' => $retry ? now()->addSeconds($delay) : null])->save();
                DB::table('sms_attempts')->where('sms_delivery_id', $d->id)->where('attempt', $d->attempts)->update([
                    'outcome' => $e->uncertain ? 'uncertain' : 'rejected', 'http_status' => $e->httpStatus, 'error_class' => $e->getMessage(), 'finished_at' => now()]);
            });
        }
    }

    public function reconcile(int $id): void
    {
        if (! config('messaging.sms.enabled') || ! config('messaging.sms.key')) {
            return;
        }
        $d = SmsDelivery::findOrFail($id);
        if (! $d->provider_message_id || in_array($d->state, ['network_sent', 'refunded'], true) || ($d->reconcile_at && $d->reconcile_at->isFuture())) {
            return;
        }
        if ($this->rate->take('messages_get', 30)) {
            return;
        }
        try {
            $result = $this->client->status($d->provider_message_id, $d->destination);
            // Reconciliation never POSTs and can never authorize a resend.
            DB::transaction(function () use ($d, $result) {
                $fresh = SmsDelivery::whereKey($d->id)->lockForUpdate()->firstOrFail();
                if (in_array($fresh->state, ['network_sent', 'refunded'], true)) {
                    return;
                }
                $this->applyStatus($fresh, $result);
            });
        } catch (TransportFailure $e) {
            if ($e->retryAfter !== null) {
                $this->rate->block('messages_get', $e->retryAfter);
            }
            SmsDelivery::whereKey($d->id)->update(['last_error' => $e->getMessage(), 'reconcile_at' => now()->addSeconds(max(300, $e->retryAfter ?? 0))]);
        }
    }

    private function finish(SmsDelivery $delivery, array $result): void
    {
        DB::transaction(function () use ($delivery, $result) {
            $d = SmsDelivery::whereKey($delivery->id)->where('claim_token', $delivery->claim_token)->lockForUpdate()->first();
            if (! $d) {
                return;
            }
            $this->applyStatus($d, $result);
            DB::table('sms_attempts')->where('sms_delivery_id', $d->id)->where('attempt', $d->attempts)->update([
                'outcome' => 'accepted', 'provider_message_id' => $result['message_id'], 'finished_at' => now()]);
        });
    }

    private function applyStatus(SmsDelivery $d, array $result): void
    {
        $state = match ($result['status']) {
            'Sent' => 'network_sent', 'Failed' => 'failed', 'Refunded' => 'refunded', default => 'accepted'
        };
        $d->forceFill(['state' => $state, 'provider_message_id' => $result['message_id'], 'provider_status' => $result['status'],
            'claim_token' => null, 'lease_until' => null, 'last_error' => null, 'reconcile_at' => in_array($state, ['network_sent', 'refunded'], true) ? null : now()->addMinutes(2)])->save();
        if (in_array($state, ['network_sent', 'refunded'], true)) {
            $d->receipt->forceFill(['state' => $state === 'network_sent' ? 'complete' : 'failed', 'completed_at' => now()])->save();
        }
    }

    private function block(SmsDelivery $d, string $reason): void
    {
        $d->forceFill(['state' => 'blocked', 'last_error' => $reason])->save();
    }
}
