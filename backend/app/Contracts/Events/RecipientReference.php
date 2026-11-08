<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Server-selected user reference; no phone, email, document, credential, or message body. */
final readonly class RecipientReference
{
    public function __construct(public int $userId, public bool $inApp = true, public bool $sms = false, public ?string $audience = null)
    {
        if ($userId < 1 || $userId > 9007199254740991 || (! $inApp && ! $sms) || ($audience !== null && ! in_array($audience, ['resident', 'official'], true))) {
            throw new InvalidArgumentException('A safe recipient, explicit audience and at least one channel are required.');
        }
    }

    public function toArray(?string $derivedAudience = null): array
    {
        $audience = $derivedAudience ?? $this->audience;
        if (! in_array($audience, ['resident', 'official'], true) || ($derivedAudience !== null && $this->audience !== null && $derivedAudience !== $this->audience)) {
            throw new InvalidArgumentException('Persist the server-derived audience without changing the intended audience.');
        }

        return ['user_id' => $this->userId, 'audience' => $audience, 'in_app' => $this->inApp, 'sms' => $this->sms];
    }
}
