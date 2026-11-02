<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Proposed shared contract, pending DBA/P2 review. No persistence implementation. */
final readonly class ResourceReference
{
    public function __construct(public string $type, public int $id)
    {
        if ($id < 1 || ! in_array($type, ['alert', 'announcement', 'feedback', 'verification', 'personnel', 'facility', 'user', 'household', 'security'], true)) {
            throw new InvalidArgumentException('Unsupported server resource reference.');
        }
    }
}
