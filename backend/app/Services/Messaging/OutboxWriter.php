<?php

declare(strict_types=1);

namespace App\Services\Messaging;

use App\Contracts\P2\Store;

final class OutboxWriter
{
    public function __construct(private Store $store, private \Closure $clock) {}

    public function record(string $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, string $occurredAt, array $context = []): array
    {
        if (! $this->store->inTransaction()) {
            throw new \LogicException('Outbox must join the domain transaction.');
        }
        if (! in_array($type, ['incident.created', 'incident.assigned', 'incident.status_changed', 'incident.rescue_required', 'announcement.published', 'feedback.submitted', 'feedback.updated', 'verification.updated', 'personnel.updated', 'facility.updated', 'security.updated'], true)) {
            throw new \InvalidArgumentException('Unknown event type.');
        }
        if (! preg_match('/^[a-f0-9]{32}$/D', $eventId) || $scope < 1 || $resourceId < 1) {
            throw new \InvalidArgumentException('Invalid event identity.');
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
