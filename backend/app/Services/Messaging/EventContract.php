<?php

namespace App\Services\Messaging;

use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use Illuminate\Support\Str;

final class EventContract
{
    private const INCIDENT_STATUSES = ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'];

    public static function definition(OutboxEvent $event): array
    {
        $definition = config('messaging.events', [])[$event->type] ?? null;
        if (! $definition) {
            throw new EventContractViolation('unknown_event_type');
        }
        if ($event->version !== $definition['version'] || $event->resource_type !== $definition['resource'] || $event->template_key !== $definition['template']) {
            throw new EventContractViolation('event_version_template_mismatch');
        }
        if (! Str::isUuid($event->event_id) || $event->resource_id < 1 || $event->barangay_id < 1 || $event->resource_id > 9007199254740991 || $event->barangay_id > 9007199254740991) {
            throw new EventContractViolation('invalid_event_identity');
        }
        try {
            $at = $event->occurred_at;
        } catch (\Throwable) {
            throw new EventContractViolation('invalid_event_time');
        }
        if (! $at instanceof \DateTimeInterface) {
            throw new EventContractViolation('invalid_event_time');
        }
        self::payload($event->payload, $definition['payload_schema']);

        return $definition;
    }

    public static function recipient(OutboxEvent $event, OutboxRecipient $recipient, array $definition): void
    {
        if ($recipient->outbox_event_id !== $event->id || $recipient->barangay_id !== $event->barangay_id || $recipient->recipient_id < 1 || (! $recipient->in_app && ! $recipient->sms)) {
            throw new EventContractViolation('invalid_recipient_reference');
        }
        if ($event->version === 2 && ! in_array($recipient->audience, ['resident', 'official'], true)) {
            throw new EventContractViolation('recipient_audience_required');
        }
        if ($recipient->sms && $definition['sms_template'] === null) {
            throw new EventContractViolation('sms_channel_not_authorized');
        }
    }

    public static function template(array $definition, string $channel): string
    {
        $key = match ($channel) {
            'in_app' => $definition['in_app_template'], 'sms' => $definition['sms_template'], default => null
        };
        if (! is_string($key) || $key === '') {
            throw new EventContractViolation('channel_template_not_authorized');
        }

        return $key;
    }

    public static function message(OutboxEvent $event): string
    {
        $definition = self::definition($event);
        self::template($definition, 'sms');

        return match ($definition['sms_template']) {
            'alert-review.v1' => 'Barangay Connect: a new SOS requires your attention. Sign in to review alert A-'.$event->resource_id.'.',
            'announcement-review.v1' => 'Barangay Connect: a new community announcement is available. Sign in to review announcement '.$event->resource_id.'.',
            default => throw new EventContractViolation('sms_template_not_registered'),
        };
    }

    private static function payload(mixed $p, string $schema): void
    {
        if (! is_array($p) || strlen(json_encode($p, JSON_THROW_ON_ERROR)) > 256) {
            throw new EventContractViolation('invalid_event_payload');
        }
        $keys = array_keys($p);
        sort($keys);
        $valid = match ($schema) {
            'empty' => $p === [],
            'incident_created' => $keys === ['status'] && $p['status'] === 'Pending',
            'incident_status' => $keys === ['status'] && in_array($p['status'], self::INCIDENT_STATUSES, true),
            'verification_status' => $keys === ['status'] && in_array($p['status'], ['Pending', 'Resubmission requested', 'Approved', 'Rejected', 'Expired'], true),
            'facility_status' => $keys === ['status'] && in_array($p['status'], ['Active', 'Inactive'], true),
            'personnel_status' => $keys === ['role', 'status'] && (($p['role'] === null && $p['status'] === 'Unassigned') || (in_array($p['role'], ['secretary', 'responder', 'rescuer'], true) && in_array($p['status'], ['Active', 'Inactive'], true))),
            'security_action' => $keys === ['action'] && in_array($p['action'], ['password_changed', 'password_reset', 'access_revoked'], true),
            'feedback_submitted', 'feedback_updated' => $keys === ['kind', 'status'] && (($schema === 'feedback_submitted' && $p['kind'] === 'general' && $p['status'] === null)
                || (in_array($p['kind'], ['complaint', 'suggestion'], true) && in_array($p['status'], $schema === 'feedback_submitted' ? ['Pending'] : ['Pending', 'Assigned', 'Resolved'], true))),
            default => false,
        };
        if (! $valid) {
            throw new EventContractViolation('invalid_event_payload');
        }
    }
}
