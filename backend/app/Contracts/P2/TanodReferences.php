<?php

declare(strict_types=1);

namespace App\Contracts\P2;

interface TanodReferences
{
    /** Display-only local active memberships; never an eligibility write lock. */
    public function feedbackTanods(int $barangay): array;
}
