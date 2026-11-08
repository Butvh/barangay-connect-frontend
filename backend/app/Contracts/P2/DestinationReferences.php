<?php

declare(strict_types=1);

namespace App\Contracts\P2;

/** Current scoped destination projection; caller already holds the facility lock. */
interface DestinationReferences
{
    public function destination(int $id, int $barangay): ?array;
}
