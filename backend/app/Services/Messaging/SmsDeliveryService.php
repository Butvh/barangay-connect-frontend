<?php

namespace App\Services\Messaging;

use App\Models\DeliveryReceipt;
use App\Models\SmsDelivery;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SmsDeliveryService
{
    public function __construct(private SemaphoreClient $client, private RateGate $rate, private SmsCurrentAuthorization $authority) {}

    public function send(int $id): void
    {
        if (DB::transactionLevel() !== 0 || DB::getDefaultConnection() !== config('integration.connection', 'mysql')) {
            throw new \LogicException('sms_requires_committed_connection');
        }
        $snapshot = SmsDelivery::with(['receipt.event', 'receipt.recipient.appointment'])->findOrFail($id);
        if ($snapshot->state === 'sending') {
            $this->recoverSending($id);

            return;
        }
        if ($snapshot->state !== 'pending' || ($snapshot->next_attempt_at && $snapshot->next_attempt_at->isFuture())) {
            return;
        }
        $delivery = null;
        try {
            $this->authority->purpose($snapshot->receipt->event);
            $definition = EventContract::definition($snapshot->receipt->event);
            if ($definition['route'] === 'make' && ! DB::table('make_commands')->where('outbox_event_id', $snapshot->receipt->event->id)->exists()) {
                return;
            }
            if (! class_exists(EffectiveIdentity::class)) {
                throw new SmsAuthorizationDenied('consent_authority_unavailable');
            }
            $user = $snapshot->receipt->recipient;
            $observed = $user ? EffectiveIdentity::fromUser($user) : null;
            if (! $observed || $observed->barangayId !== $snapshot->receipt->event->barangay_id) {
                throw new SmsAuthorizationDenied('recipient_unavailable');
            }
            $message = EventContract::message($snapshot->receipt->event);
            $delivery = $this->authority->current($snapshot, $observed, function (array $context) use ($id, $message) {
                $d = SmsDelivery::whereKey($id)->lockForUpdate()->firstOrFail();
                if ($d->state !== 'pending' || ($d->next_attempt_at && $d->next_attempt_at->isFuture())) {
                    return null;
                }
                if ($d->attempts >= config('messaging.sms.max_attempts')) {
                    $this->block($d, 'attempts_exhausted');

                    return null;
                }
                if ($d->provider_message_id !== null) {
                    throw new SmsAuthorizationDenied('delivery_already_submitted');
                }
                $number = $this->destination($d, $context['user']);
                $segments = SemaphoreClient::segments($message);
                if ($segments > config('messaging.sms.max_segments')) {
                    throw new SmsAuthorizationDenied('segment_limit');
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
                    'estimated_segments' => $segments, 'budget_reserved_at' => $d->budget_reserved_at ?? now(), 'state' => 'sending',
                    'attempts' => $d->attempts + 1, 'claim_token' => (string) Str::uuid(),
                    'lease_until' => now()->addSeconds(config('messaging.sms.lease_seconds')), 'last_error' => null])->save();
                DB::table('sms_attempts')->insert(['sms_delivery_id' => $d->id, 'attempt' => $d->attempts,
                    'claim_token' => $d->claim_token, 'outcome' => 'started', 'started_at' => now()]);
                $this->authority->record($context, $d, 'reservation');

                return $d;
            });
            if (! $delivery) {
                return;
            }
            // After commit only. Observers cannot place provider I/O in the retried transaction.
            event(new SmsReserved($delivery->id, $delivery->claim_token));
            $ready = $this->authority->current($snapshot, $observed, function (array $context) use ($delivery) {
                $d = SmsDelivery::whereKey($delivery->id)->lockForUpdate()->firstOrFail();
                if ($d->state !== 'sending' || $d->claim_token !== $delivery->claim_token) {
                    return null;
                }
                if (! $d->lease_until || $d->lease_until->isPast()) {
                    $this->uncertain($d);

                    return null;
                }
                $number = $this->destination($d, $context['user']);
                if ($number !== $delivery->destination) {
                    throw new SmsAuthorizationDenied('destination_changed');
                }
                $this->authority->record($context, $d, 'pre_send');

                return $d;
            });
            if (! $ready) {
                return;
            }
            $delivery = $ready;
        } catch (SmsAuthorizationDenied|EventContractViolation $error) {
            $this->deny($id, $delivery?->claim_token, $error->getMessage());

            return;
        }
        try {
            $result = $this->client->send($delivery->destination, $message);
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
                    'outcome' => $e->uncertain ? 'uncertain' : 'rejected', 'http_status' => $e->httpStatus,
                    'error_class' => $e->getMessage(), 'finished_at' => now()]);
            });
        }
    }

    private function destination(SmsDelivery $delivery, ?User $user): string
    {
        if (! $user || $user->account_status !== 'Active') {
            throw new SmsAuthorizationDenied('recipient_unavailable');
        }
        try {
            $current = PhoneNumber::normalize($user->contact_number ?? '');
        } catch (\InvalidArgumentException) {
            throw new SmsAuthorizationDenied('invalid_destination');
        }
        if ($delivery->destination !== null && $delivery->destination !== $current) {
            throw new SmsAuthorizationDenied('destination_changed');
        }
        if (! config('messaging.sms.enabled') || ! config('messaging.sms.key') || ! config('messaging.sms.sender') || ! config('messaging.sms.destination_pepper')) {
            throw new SmsAuthorizationDenied('provider_disabled');
        }
        if (! in_array($current, config('messaging.sms.allowlist', []), true)) {
            throw new SmsAuthorizationDenied('destination_not_approved');
        }

        return $current;
    }

    private function recoverSending(int $id): void
    {
        // Housekeeping only: release this transaction before any later person/source gate.
        DB::transaction(function () use ($id) {
            $d = SmsDelivery::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($d->state === 'sending' && $d->lease_until?->isPast()) {
                $this->uncertain($d);
            }
        });
    }

    private function uncertain(SmsDelivery $d): void
    {
        $d->forceFill(['state' => 'uncertain', 'last_error' => 'worker_lost_after_claim', 'claim_token' => null, 'lease_until' => null])->save();
        DB::table('sms_attempts')->where('sms_delivery_id', $d->id)->where('outcome', 'started')
            ->update(['outcome' => 'uncertain', 'error_class' => 'worker_lost_after_claim', 'finished_at' => now()]);
    }

    private function deny(int $id, ?string $token, string $reason): void
    {
        $receiptId = SmsDelivery::whereKey($id)->value('receipt_id');
        DB::transaction(function () use ($id, $receiptId, $token, $reason) {
            // Same receipt->delivery order as authorization and completion; never acquire users here.
            DeliveryReceipt::whereKey($receiptId)->lockForUpdate()->first();
            $d = SmsDelivery::whereKey($id)->lockForUpdate()->firstOrFail();
            if (($token === null && $d->state !== 'pending')
                || ($token !== null && ($d->state !== 'sending' || $d->claim_token !== $token))) {
                return;
            }
            $d->forceFill(['state' => 'blocked', 'last_error' => $reason, 'claim_token' => null,
                'lease_until' => null, 'next_attempt_at' => null])->save();
            if ($token !== null) {
                DB::table('sms_attempts')->where('sms_delivery_id', $id)->where('claim_token', $token)->where('outcome', 'started')
                    ->update(['outcome' => 'rejected', 'error_class' => $reason, 'finished_at' => now()]);
            }
            DB::table('delivery_receipts')->where('id', $receiptId)->where('channel', 'sms')->where('state', '<>', 'complete')
                ->update(['state' => 'failed', 'diagnostic_code' => $reason, 'failed_at' => now()]);
        });
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
                DeliveryReceipt::whereKey($d->receipt_id)->lockForUpdate()->firstOrFail();
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
            DeliveryReceipt::whereKey($delivery->receipt_id)->lockForUpdate()->firstOrFail();
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
