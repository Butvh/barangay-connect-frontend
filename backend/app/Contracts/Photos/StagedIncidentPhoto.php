<?php

namespace App\Contracts\Photos;

use App\Contracts\Events\EventId;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/** Server-side projection of persisted private bytes. It is not proof that an upload occurred. */
final readonly class StagedIncidentPhoto
{
    public function __construct(public string $uploadId, private EffectiveIdentity $owner,
        public string $mime, public int $bytes, public DateTimeImmutable $expiresAt)
    {
        new EventId($uploadId);
        if (! in_array($mime, ['image/jpeg', 'image/png'], true) || $bytes < 1 || $bytes > 10485760) {
            throw new InvalidArgumentException('Incident photos require detected JPEG/PNG bytes within the upload limit.');
        }
    }

    public function assertOwnedBy(EffectiveIdentity $observed): void
    {
        if (! $this->owner->sameAs($observed)) {
            throw new ApiProblem('FORBIDDEN', 403, 'This upload is not available for your account.');
        }
    }

    public function toArray(): array
    {
        return ['upload_id' => $this->uploadId, 'mime' => $this->mime, 'bytes' => $this->bytes,
            'expires_at' => $this->expiresAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.u\Z')];
    }
}
