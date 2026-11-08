<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\RecipientReference;
use App\Contracts\P2\Store;
use App\Services\P2\Problem;

final class OutboxWriter
{
    public function __construct(private Store $store, private \Closure $clock, private ?\App\Contracts\Events\OutboxWriter $typed = null) {}

    public function record(string $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, string $occurredAt, array $context = []): array
    {
        if (! $this->store->inTransaction()) {
            throw new \LogicException('Outbox must join the domain transaction.');
        }
        if (! in_array($type, ['incident.created', 'incident.assigned', 'incident.status_changed', 'incident.rescue_required', 'announcement.published', 'feedback.submitted', 'feedback.updated', 'verification.updated', 'personnel.updated', 'facility.updated', 'security.updated'], true)) {
            throw new \InvalidArgumentException('Unknown event type.');
        }
        if (! preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $eventId) || $scope < 1 || $resourceId < 1) {
            throw new \InvalidArgumentException('Invalid event identity.');
        }
        if ($this->typed) {
            $versioned = match ($type) {
                'incident.created', 'incident.assigned', 'incident.status_changed', 'incident.rescue_required', 'announcement.published', 'feedback.submitted', 'feedback.updated' => $type.'.v2',
                default => throw new Problem('UNAVAILABLE', 'This event contract is awaiting team integration.'),
            };
            if (array_diff(array_keys($context), ['status'])) {
                throw new \LogicException('Unsupported event-time context.');
            }
            $snapshot = $context;
            if (str_starts_with($type, 'feedback.')) {
                $source = $this->store->select('community_feedback', ['id' => $resourceId, 'barangay_id' => $scope])[0] ?? throw new Problem('NOT_FOUND', 'Feedback source unavailable.');
                $snapshot = ['kind' => $source['type'], 'status' => $source['status']];
            }
            $refs = array_map(fn ($r) => new RecipientReference($r['user_id'], in_array('in_app', $r['channels'], true), in_array('sms', $r['channels'], true), $r['audience']), $recipientRefs);
            $this->typed->record(new EventId($eventId), $versioned, $scope, $resourceId, $refs, new \DateTimeImmutable($occurredAt), EventContext::forEvent($versioned, $snapshot));

            return ['event_id' => $eventId];
        }
        foreach ($recipientRefs as $ref) {
            if (! is_int($ref['user_id'] ?? null) || $ref['user_id'] < 1 || ! in_array($ref['audience'] ?? null, ['resident', 'official'], true) || array_diff($ref['channels'] ?? [], ['in_app', 'sms'])) {
                throw new \InvalidArgumentException('Invalid recipient reference.');
            }
        }
        $existing = $this->store->select('outbox_events', ['event_id' => $eventId]);
        if (array_diff(array_keys($context), ['status']) || (isset($context['status']) && ! in_array($context['status'], ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'], true))) {
            throw new \InvalidArgumentException('Invalid event context.');
        }
        if ($existing) {
            throw new \LogicException('Event identity already exists; do not reuse it for another command.');
        }

        return $this->store->insert('outbox_events', ['event_id' => $eventId, 'event_type' => $type, 'barangay_id' => $scope, 'resource_id' => $resourceId, 'payload' => ['version' => 1, 'recipients' => array_values($recipientRefs), 'context' => $context], 'occurred_at' => $occurredAt, 'created_at' => ($this->clock)(), 'dispatched_at' => null]);
    }
}
