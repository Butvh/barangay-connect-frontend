<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Server-selected user reference; no phone, email, document, credential, or message body. */
final readonly class RecipientReference
{
    public function __construct(public int $userId, public bool $inApp = true, public bool $sms = false)
    {
        if ($userId < 1 || (! $inApp && ! $sms)) {
            throw new InvalidArgumentException('A recipient and at least one channel are required.');
        }
    }
}
