<?php

namespace App\Contracts\Events;

use InvalidArgumentException;

/** Proposed shared contract, pending DBA/P2 review. No persistence implementation. */
final readonly class ResourceReference
{
    public function __construct(public string $type, public int $id)
    {
        if ($id < 1 || $id > 9007199254740991 || ! in_array($type, ['incident', 'personnel_appointment', 'alert', 'announcement', 'feedback', 'verification', 'personnel', 'facility', 'user', 'household', 'security'], true)) {
            throw new InvalidArgumentException('Unsupported server resource reference.');
        }
    }
}
