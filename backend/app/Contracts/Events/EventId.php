<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Canonical v1 proposal: new events use UUIDv4; old IDs are never silently rewritten. */
final readonly class EventId
{
    public function __construct(public string $value)
    {
        if (! preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $value)) {
            throw new InvalidArgumentException('A canonical UUIDv4 event ID is required.');
        }
    }

    public static function generate(): self
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);
        $hex = bin2hex($bytes);

        return new self(substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20));
    }
}
