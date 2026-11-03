<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Server-selected user reference; no phone, email, document, credential, or message body. */
final readonly class RecipientReference
{
    public function __construct(public int $userId, public bool $inApp, public bool $sms, public string $audience)
    {
        if ($userId < 1 || $userId > 9007199254740991 || (! $inApp && ! $sms) || ! in_array($audience, ['resident', 'official'], true)) {
            throw new InvalidArgumentException('A safe recipient, explicit audience and at least one channel are required.');
        }
    }

    public function toArray(): array
    {
        return ['user_id' => $this->userId, 'audience' => $this->audience, 'in_app' => $this->inApp, 'sms' => $this->sms];
    }
}
