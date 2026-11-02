<?php

namespace App\Contracts\Events;

use DateTimeImmutable;

interface OutboxWriter
{
    /**
     * Must use caller's transaction. P2 supplies the implementation; DBA owns dispatch.
     *
     * @param  list<RecipientReference>  $recipientRefs
     */
    public function record(
        EventId $eventId,
        string $type,
        int $scope,
        int $resourceId,
        array $recipientRefs,
        DateTimeImmutable $occurredAt,
        EventContext $context = new EventContext,
    ): void;
}
