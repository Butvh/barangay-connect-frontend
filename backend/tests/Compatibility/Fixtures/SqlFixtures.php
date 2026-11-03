<?php

namespace Tests\Compatibility\Fixtures;

use App\Contracts\Events\EventContext;
use App\Contracts\Events\EventId;
use App\Contracts\Events\OutboxWriter;
use App\Contracts\Events\RecipientReference;
use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;
use App\Services\Messaging\EventContract;
use App\Services\Messaging\InAppNotificationHandler;
use App\Services\Messaging\InAppRecipientUnavailable;
use Illuminate\Support\Facades\DB;

/** SQL test double only. The CLI rejects every class in this directory as production source. */
class CompatibleTypedWriter implements OutboxWriter
{
    public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, \DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Fixture requires caller transaction');
        }
        $definition = config('messaging.events')[$type] ?? throw new \InvalidArgumentException('Unknown fixture event');
        $event = (new OutboxEvent)->forceFill(['event_id' => $eventId->value, 'version' => $definition['version'], 'type' => $type, 'barangay_id' => $scope,
            'resource_type' => $definition['resource'], 'resource_id' => $resourceId, 'occurred_at' => $occurredAt->setTimezone(new \DateTimeZone('UTC')),
            'template_key' => $definition['template'], 'payload' => $context->status === null ? [] : ['status' => $context->status]]);
        EventContract::definition($event);
        $event->save();
        foreach ($recipientRefs as $reference) {
            if (! $reference instanceof RecipientReference) {
                throw new \InvalidArgumentException('Typed recipient required');
            }
            $r = OutboxRecipient::forceCreate(['outbox_event_id' => $event->id, 'recipient_id' => $reference->userId, 'barangay_id' => $scope, 'audience' => 'official', 'in_app' => $reference->inApp, 'sms' => $reference->sms]);
            EventContract::recipient($event, $r, $definition);
        }
    }
}

final class InAppOnlyTypedWriter extends CompatibleTypedWriter
{
    public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, \DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
    {
        foreach ($recipientRefs as $reference) {
            if ($reference->sms) {
                throw new \InvalidArgumentException('Fixture integration is in-app only');
            }
        }
        parent::record($eventId, $type, $scope, $resourceId, $recipientRefs, $occurredAt, $context);
    }
}

final class IndependentlyCommittingWriter extends CompatibleTypedWriter
{
    public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, \DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
    {
        parent::record($eventId, $type, $scope, $resourceId, $recipientRefs, $occurredAt, $context);
        DB::commit();
    }
}

final class WrongVersionWriter extends CompatibleTypedWriter
{
    public function record(EventId $eventId, string $type, int $scope, int $resourceId, array $recipientRefs, \DateTimeImmutable $occurredAt, EventContext $context = new EventContext): void
    {
        parent::record($eventId, $type, $scope, $resourceId, $recipientRefs, $occurredAt, $context);
        DB::table('outbox_events')->where('event_id', $eventId->value)->update(['version' => 1]);
    }
}

class CompatiblePerRecipientHandler implements InAppNotificationHandler
{
    public function handle(OutboxEvent $event, OutboxRecipient $recipient): void
    {
        if (DB::table('users')->where('id', $recipient->recipient_id)->value('account_status') !== 'Active') {
            throw new InAppRecipientUnavailable;
        }
        DB::table('notifications')->insertOrIgnore(['event_id' => $event->event_id, 'recipient_id' => $recipient->recipient_id, 'barangay_id' => $event->barangay_id,
            'resource_type' => $event->resource_type, 'resource_id' => $event->resource_id, 'audience' => $recipient->audience,
            'kind' => 'alert_new', 'title' => 'Fictional event', 'description' => '', 'event_status' => $event->payload['status'],
            'target' => 'official-alert.html?id='.$event->resource_id, 'template_key' => EventContract::template(EventContract::definition($event), 'in_app'), 'created_at' => $event->occurred_at]);
    }
}

final class NoopHandler implements InAppNotificationHandler
{
    public function handle(OutboxEvent $event, OutboxRecipient $recipient): void {}
}

final class WrongInterface {}
