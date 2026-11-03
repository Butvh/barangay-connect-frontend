<?php

namespace App\Contracts\Photos;

use App\Services\Identity\EffectiveIdentity;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** P1 private-byte implementation awaits DBA metadata and P2 incident-policy ports. No binding yet. */
interface IncidentPhotos
{
    /** Detect MIME/read actual bytes; stage under a random private key, never accept a client filename as content. */
    public function stage(EffectiveIdentity $observed, UploadedFile $photo, string $intentKey): StagedIncidentPhoto;

    /** Reload token metadata/current generation after guards; attach once in the caller's incident transaction. */
    public function attach(EffectiveIdentity $observed, string $uploadId, int $incidentId): int;

    /** Reauthorize current source access on every request; deny missing bytes/symlinks; private no-store response. */
    public function download(EffectiveIdentity $observed, int $photoId): BinaryFileResponse;
}
