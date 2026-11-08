<?php

declare(strict_types=1);

namespace App\Contracts\P2;

/** Mutable checks only: caller holds the named person guards/rows before any source lock. */
interface EligibilityReferences
{
    public function eligiblePerson(int $id, int $barangay): ?array;

    public function sosHousehold(int $residentId, int $barangay): ?array;
}
