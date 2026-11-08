<?php

namespace App\Services\Messaging;

use App\Models\OutboxEvent;
use App\Models\OutboxRecipient;

interface InAppNotificationHandler
{
    /** P2 implementation participates in this transaction; no external calls. Must dedupe event_id/recipient_id. */
    public function handle(OutboxEvent $event, OutboxRecipient $recipient): void;
}
