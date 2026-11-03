<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Models\Notification;
use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Services\Messaging\EventContract;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\InAppRecipientUnavailable;
use App\Services\Messaging\NotificationAccess;
use App\Services\P2\Problem;
use Illuminate\Support\Facades\DB;

/** Invoked only by DBA's single dispatcher inside the receipt transaction. No provider calls. */
final class InAppHandler implements InAppNotificationHandler
{
    public function __construct(private Store $store, private ReferenceData $refs) {}

    public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
    {
        if (DB::transactionLevel() === 0 || $recipient->outbox_event_id !== $event->id || $recipient->barangay_id !== $event->barangay_id || ! $recipient->in_app) {
            throw new \LogicException('Invalid dispatcher receipt context.');
        }
        $definition = EventContract::definition($event);
        if (! in_array($event->resource_type, ['incident', 'alert', 'feedback', 'announcement'], true)) {
            throw new \LogicException('Source handler not integrated.');
        }
        try {
            $actor = $this->refs->actorFor((int) $recipient->recipient_id);
        } catch (Problem $e) {
            throw new InAppRecipientUnavailable;
        }
        $resource = $event->resource_type === 'alert' ? 'incident' : $event->resource_type;
        $audience = $event->version === 2 ? $recipient->audience : ($actor->role === 'resident' ? 'resident' : 'official');
        $row = ['user_id' => $actor->id, 'barangay_id' => (int) $event->barangay_id, 'resource_type' => $resource, 'resource_id' => (int) $event->resource_id, 'audience' => $audience];
        $source = NotificationAccess::source($this->store, $this->refs, $actor, $row, gmdate(DATE_ATOM));
        if (! $source) {
            throw new InAppRecipientUnavailable;
        }
        $status = $resource === 'incident' && $event->version === 2 ? ($event->payload['status'] ?? null) : null;
        $title = match ($resource) {
            'incident' => 'A-'.$event->resource_id.' · '.($status ?? 'New SOS'),
            'feedback' => 'Feedback update',
            default => 'Announcement published',
        };
        if (! Notification::query()->where(['event_id' => $event->event_id, 'recipient_id' => $recipient->recipient_id])->exists()) {
            (new Notification)->forceFill(['event_id' => $event->event_id, 'recipient_id' => $recipient->recipient_id, 'barangay_id' => $event->barangay_id, 'resource_type' => $resource, 'resource_id' => $event->resource_id, 'audience' => $audience, 'event_status' => $status, 'template_key' => EventContract::template($definition, 'in_app'), 'kind' => $resource === 'incident' ? 'alert_status' : ($resource === 'feedback' ? 'feedback_update' : 'announcement'), 'target' => NotificationAccess::link($row, $source), 'title' => $title, 'description' => '', 'created_at' => $event->occurred_at])->save();
        }
    }
}
