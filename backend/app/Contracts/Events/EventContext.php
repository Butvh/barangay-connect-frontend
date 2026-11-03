<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Interface v1 value type; exact persisted-envelope v2 snapshots, never arbitrary bodies. */
final readonly class EventContext
{
    private const STAGES = ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'];

    public function __construct(private array $values = [], private ?string $eventType = null)
    {
        if ($eventType === null) {
            if ($values !== []) {
                throw new InvalidArgumentException('Nonempty snapshots require an explicit event family.');
            }
        } else {
            self::validate($eventType, $values);
        }
    }

    public static function forEvent(string $type, array $payload): self
    {
        return new self($payload, $type);
    }

    public function payloadFor(string $type): array
    {
        if ($this->eventType !== null && $this->eventType !== $type) {
            throw new InvalidArgumentException('An event snapshot cannot change families.');
        }
        self::validate($type, $this->values);

        return $this->values;
    }

    private static function validate(string $type, array $payload): void
    {
        $keys = array_keys($payload);
        sort($keys);
        $valid = match ($type) {
            'incident.created.v2' => $keys === ['status'] && $payload['status'] === 'Pending',
            'incident.assigned.v2', 'incident.status_changed.v2', 'incident.rescue_required.v2' => $keys === ['status'] && in_array($payload['status'], self::STAGES, true),
            'announcement.published.v2', 'identity.resident_registered.v2', 'profile.updated.v2', 'household.updated.v2' => $payload === [],
            'verification.updated.v2' => $keys === ['status'] && in_array($payload['status'], ['Pending', 'Resubmission requested', 'Approved', 'Rejected', 'Expired'], true),
            'facility.updated.v2' => $keys === ['status'] && in_array($payload['status'], ['Active', 'Inactive'], true),
            'personnel.updated.v2' => $keys === ['role', 'status'] && (($payload['role'] === null && $payload['status'] === 'Unassigned') ||
                (in_array($payload['role'], ['secretary', 'responder', 'rescuer'], true) && in_array($payload['status'], ['Active', 'Inactive'], true))),
            'security.updated.v2' => $keys === ['action'] && in_array($payload['action'], ['password_changed', 'password_reset', 'access_revoked'], true),
            'feedback.submitted.v2', 'feedback.updated.v2' => $keys === ['kind', 'status'] &&
                (($type === 'feedback.submitted.v2' && $payload['kind'] === 'general' && $payload['status'] === null) ||
                    (in_array($payload['kind'], ['complaint', 'suggestion'], true) && in_array($payload['status'], $type === 'feedback.submitted.v2' ? ['Pending'] : ['Pending', 'Assigned', 'Resolved'], true))),
            default => false,
        };
        if (! $valid || strlen(json_encode($payload, JSON_THROW_ON_ERROR)) > 256) {
            throw new InvalidArgumentException('Unsupported or oversized event snapshot.');
        }
    }
}
