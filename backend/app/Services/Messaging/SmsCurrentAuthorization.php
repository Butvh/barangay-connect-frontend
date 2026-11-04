<?php

namespace App\Services\Messaging;

use App\Models\DeliveryReceipt;
use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Models\SmsDelivery;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\SmsDeliveryEligibility;
use App\Support\ApiProblem;
use Closure;
use Illuminate\Support\Facades\DB;

/** Uses the actual P1 current authority; owns only exact delivery/source/ledger checks. */
final class SmsCurrentAuthorization
{
    private const PURPOSES = [
        'incident.created.v2' => ['incident_review', 'alert-review.v1'],
        'announcement.published.v2' => ['barangay_announcements', 'announcement-review.v1'],
    ];

    public function purpose(OutboxEvent $event): string
    {
        EventContract::definition($event);
        if ($event->version !== 2 || ! isset(self::PURPOSES[$event->type])) {
            throw new SmsAuthorizationDenied('sms_producer_family_denied');
        }

        return self::PURPOSES[$event->type][0];
    }

    public function current(SmsDelivery $snapshot, EffectiveIdentity $observed, Closure $callback): mixed
    {
        $connection = DB::connection(config('integration.connection', 'mysql'));
        if ($connection->transactionLevel() !== 0 || $connection->getName() !== DB::getDefaultConnection()) {
            throw new \LogicException('sms_authority_requires_committed_named_connection');
        }
        if (! app()->bound(SmsDeliveryEligibility::class)) {
            throw new SmsAuthorizationDenied('consent_authority_unavailable');
        }
        if ($connection->getDriverName() !== 'mysql'
            || (int) $connection->selectOne('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),CURRENT_TIMESTAMP()) AS utc_offset')->utc_offset !== 0) {
            throw new SmsAuthorizationDenied('consent_connection_not_utc');
        }
        if (! $connection->getSchemaBuilder()->hasTable('sms_authorizations')) {
            throw new SmsAuthorizationDenied('consent_evidence_unavailable');
        }
        $purpose = $this->purpose($snapshot->receipt->event);
        $result = null;
        $entered = false;
        try {
            $allowed = app(SmsDeliveryEligibility::class)->withCurrentEligibility($observed, $purpose,
                function (int $revision, string $policy, string $template) use ($snapshot, $observed, $callback, $purpose, &$result, &$entered): bool {
                    $entered = true;
                    if ($revision < 1 || $policy !== 'sms-consent.v1' || $template !== self::PURPOSES[$snapshot->receipt->event->type][1]) {
                        throw new SmsAuthorizationDenied('consent_version_mismatch');
                    }
                    // P1 already holds this exact person/account/appointment. Re-read it
                    // before source/ledger locks; no new audience/person is discovered.
                    $user = User::whereKey($observed->id)->lockForUpdate()->first();
                    $context = $this->source($snapshot, $observed);
                    $context += ['user' => $user, 'purpose' => $purpose, 'consent_revision' => $revision,
                        'policy_version' => $policy, 'template_version' => $template];
                    $result = $callback($context);

                    return true;
                });
        } catch (ApiProblem $error) {
            if ($error->status === 503) {
                throw new SmsAuthorizationDenied('consent_authority_unavailable', previous: $error);
            }
            throw $error;
        }
        if (! $allowed || ! $entered) {
            throw new SmsAuthorizationDenied('consent_denied');
        }

        return $result;
    }

    private function source(SmsDelivery $snapshot, EffectiveIdentity $observed): array
    {
        $original = $snapshot->receipt->event;
        if ($observed->barangayId !== $original->barangay_id || $observed->id !== $snapshot->receipt->recipient_id) {
            throw new SmsAuthorizationDenied('recipient_scope_mismatch');
        }
        $table = $original->type === 'incident.created.v2' ? 'emergency_alerts' : 'announcements';
        $source = DB::table($table)->where('id', $original->resource_id)->where('barangay_id', $original->barangay_id)->lockForUpdate()->first();
        if (! $source) {
            throw new SmsAuthorizationDenied('source_unavailable');
        }
        if ($table === 'announcements' && ($source->status !== 'Active' || ! $source->published_at
            || $source->published_at > now('UTC')->format('Y-m-d H:i:s.u')
            || ($source->expires_at !== null && $source->expires_at <= now('UTC')->format('Y-m-d H:i:s.u')))) {
            throw new SmsAuthorizationDenied('source_unavailable');
        }
        $event = OutboxEvent::whereKey($original->id)->lockForUpdate()->first();
        $identity = ['event_id', 'version', 'type', 'barangay_id', 'resource_type', 'resource_id', 'template_key', 'payload'];
        if (! $event || $event->only($identity) !== $original->only($identity)) {
            throw new SmsAuthorizationDenied('event_reference_changed');
        }
        $definition = EventContract::definition($event);
        $recipient = OutboxRecipient::where('outbox_event_id', $event->id)->where('recipient_id', $observed->id)->lockForUpdate()->first();
        $receipt = DeliveryReceipt::whereKey($snapshot->receipt_id)->lockForUpdate()->first();
        if (! $recipient || ! $recipient->sms || $recipient->audience !== ($observed->role === 'resident' ? 'resident' : 'official')
            || ! $receipt || $receipt->outbox_event_id !== $event->id || $receipt->recipient_id !== $observed->id
            || $receipt->channel !== 'sms' || $receipt->template_key !== EventContract::template($definition, 'sms')
            || $receipt->state === 'complete') {
            throw new SmsAuthorizationDenied('sms_receipt_not_authorized');
        }
        EventContract::recipient($event, $recipient, $definition);
        if ($definition['route'] === 'make') {
            $command = DB::table('make_commands')->where('outbox_event_id', $event->id)->lockForUpdate()->first();
            $hash = hash('sha256', json_encode([$event->event_id, $event->barangay_id, $event->type, $event->template_key], JSON_THROW_ON_ERROR));
            if (! config('messaging.make.enabled') || $event->barangay_id !== config('messaging.make.barangay_id')
                || ! $command || $command->credential_id !== config('messaging.make.credential_id') || ! hash_equals($command->payload_hash, $hash)) {
                throw new SmsAuthorizationDenied('make_command_unavailable');
            }
        }

        return compact('event', 'recipient', 'receipt', 'definition');
    }

    public function record(array $context, SmsDelivery $delivery, string $gate): void
    {
        DB::table('sms_authorizations')->insert(['sms_delivery_id' => $delivery->id, 'attempt' => $delivery->attempts,
            'recipient_id' => $context['recipient']->recipient_id, 'barangay_id' => $context['event']->barangay_id,
            'claim_token' => $delivery->claim_token, 'gate' => $gate, 'purpose' => $context['purpose'],
            'consent_revision' => $context['consent_revision'], 'policy_version' => $context['policy_version'],
            'template_version' => $context['template_version'], 'checked_at' => now('UTC')->format('Y-m-d H:i:s.u')]);
    }
}
