<?php

namespace App\Contracts\Events;

/** Proposed shared contract, pending DBA/P2 review. No persistence implementation. */
final readonly class ResourceReference
{
    public function __construct(public string $type, public int $id) {}
}
