<?php

declare(strict_types=1);

namespace App\Contracts\P2;

use App\Services\Identity\EffectiveIdentity;

/** Candidate source policy only; P1/DBA must ratify before binding or accepting bytes. */
interface IncidentPhotoAuthorization
{
    /** Caller holds declared person/incident locks; succeeds or throws without committing. */
    public function assertAttach(EffectiveIdentity $observed, int $incidentId, int $expectedRevision): void;

    /** Fresh short read authorization; invoke outside another transaction, per download request. */
    public function assertDownload(EffectiveIdentity $observed, int $incidentId): void;
}
