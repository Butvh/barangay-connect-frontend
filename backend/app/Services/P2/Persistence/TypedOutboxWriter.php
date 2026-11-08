<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Messaging\EventContract;
use App\Services\P2\Actor;
use App\Services\P2\Problem;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

/** P1 typed boundary to DBA v2 storage; no external transport or nested commit. */
final class TypedOutboxWriter implements OutboxWriter
{
    public function __construct(private bool $allowSmsIntent = false) {}

    public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
    {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('Outbox must join the caller transaction.');
        }
        $table = match ($type) {
            'incident.created.v2', 'incident.assigned.v2', 'incident.status_changed.v2', 'incident.rescue_required.v2' => 'emergency_alerts',
            'announcement.published.v2' => 'announcements',
            'feedback.submitted.v2', 'feedback.updated.v2' => 'community_feedback',
            'identity.resident_registered.v2', 'profile.updated.v2', 'security.updated.v2' => 'users',
            'household.updated.v2' => 'households',
            'verification.updated.v2' => 'verifications',
            'facility.updated.v2' => 'facilities',
            'personnel.updated.v2' => 'personnel_appointments',
            default => throw new Problem('UNAVAILABLE', 'Source projection is awaiting owner integration.'),
        };
        $definition = config('messaging.events', [])[$type] ?? throw new Problem('UNAVAILABLE', 'Event registry unavailable.');
        $administrative = in_array($definition['resource'], AdministrativeNotificationSources::RESOURCES, true);
        // P1's source unit owns its write guards. Never take a new users lock from this projection.
        $source = $administrative ? AdministrativeNotificationSources::row($definition['resource'], $resourceId, $scope)
            : DB::table($table)->where(['id' => $resourceId, 'barangay_id' => $scope])->lockForUpdate()->first();
        if (! $source || count($recipientRefs) > 1000) {
            throw new \LogicException('Invalid scoped event source or fanout.');
        }
        $payload = $context->payloadFor($type);
        if ($administrative) {
            AdministrativeNotificationSources::assertSnapshot($definition['resource'], $source, $payload);
        }
        if ($table === 'community_feedback' && $payload !== ['kind' => $source->kind, 'status' => $source->status]) {
            throw new \LogicException('Feedback snapshot does not match the locked source.');
        }
        $event = (new OutboxEvent)->forceFill(['event_id' => $eventId->value, 'version' => 2, 'type' => $type, 'barangay_id' => $scope, 'resource_type' => $definition['resource'], 'resource_id' => $resourceId, 'occurred_at' => $occurredAt->setTimezone(new DateTimeZone('UTC')), 'payload' => $payload, 'template_key' => $definition['template'], 'created_at' => now()]);
        EventContract::definition($event);
        $event->save();
        $seen = [];
        foreach ($recipientRefs as $ref) {
            if ($ref instanceof RecipientReference && $ref->sms && ! $this->allowSmsIntent) {
                throw new \LogicException('Use distinct in-app-only recipient references.');
            }
            if (! $ref instanceof RecipientReference || ! $ref->inApp || isset($seen[$ref->userId]) ||
                ($ref->sms && ! in_array($type, ['incident.created.v2', 'announcement.published.v2'], true))) {
                throw new \LogicException('Use distinct in-app recipients and only reviewed optional SMS families.');
            }
            $seen[$ref->userId] = true;
            $user = User::query()->where(['id' => $ref->userId, 'barangay_id' => $scope])->with('appointment')->first();
            $identity = $user ? EffectiveIdentity::fromUser($user) : null;
            if (! $identity) {
                throw new \LogicException('Outbox recipient is not currently eligible.');
            }
            if ($administrative && ! AdministrativeNotificationSources::allowed(new Actor($identity->id, $identity->barangayId, $identity->role), $definition['resource'], $source)) {
                // P1 removal retains the appointment and may return a Tanod to resident identity.
                // That legitimate transition still notifies the Captain, never the now-ineligible subject.
                if ($definition['resource'] === 'personnel_appointment' && (int) $source['user_id'] === $identity->id) {
                    continue;
                }
                throw new \LogicException('Outbox recipient cannot access this exact administrative source.');
            }
            if ($ref->sms && ! in_array($identity->role, $type === 'incident.created.v2' ? ['captain', 'secretary'] : ['resident', 'captain', 'secretary'], true)) {
                throw new \LogicException('SMS recipient is outside the minimal source audience.');
            }
            $audience = $ref->toArray($identity->role === 'resident' ? 'resident' : 'official')['audience'];
            $recipient = (new OutboxRecipient)->forceFill(['outbox_event_id' => $event->id, 'recipient_id' => $ref->userId, 'barangay_id' => $scope, 'audience' => $audience, 'in_app' => true, 'sms' => $ref->sms]);
            EventContract::recipient($event, $recipient, $definition);
            $recipient->save();
        }
    }
}
