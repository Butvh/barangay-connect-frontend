<?php

namespace App\Contracts\Events;

/** Server-selected user reference; no phone, email, document, credential, or message body. */
final readonly class RecipientReference
{
    public function __construct(public int $userId, public bool $inApp = true, public bool $sms = false) {}
}
