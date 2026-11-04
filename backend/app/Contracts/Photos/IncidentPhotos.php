<?php

namespace App\Contracts\Photos;

use App\Services\Identity\EffectiveIdentity;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** P1 private bytes await the active DBA metadata/model; reviewed P2 source policy stays unbound. */
interface IncidentPhotos
{
    /** Detect MIME/read actual bytes; stage under a random private key, never accept a client filename as content. */
    public function stage(EffectiveIdentity $observed, UploadedFile $photo, string $intentKey): StagedIncidentPhoto;

    /**
     * Authorize the original command revision before photo locks and source revision increment.
     * Caller holds declared actor/incident guards and owns source/audit/outbox/replay commit.
     * Never infer a missing revision from current storage; never move/delete bytes here.
     */
    public function attach(EffectiveIdentity $observed, string $uploadId, int $incidentId, int $expectedRevision): int;

    /** Reauthorize current source access on every request; deny missing bytes/symlinks; private no-store response. */
    public function download(EffectiveIdentity $observed, int $photoId): BinaryFileResponse;
}
