<?php

namespace App\Contracts\References;

use App\Services\Identity\EffectiveIdentity;

/** P2 implements the assigned-incident policy; never authorizes from a caller's resident ID alone. */
interface IncidentReferenceAuthorization
{
    /** Locked calls join the caller's ordered guards/user/appointment/incident transaction. */
    public function allows(EffectiveIdentity $observed, int $residentId, bool $locked): bool;
}
