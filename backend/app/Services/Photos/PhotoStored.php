<?php

namespace App\Services\Photos;

/** Internal observation after immutable storage, before ready commit; contains no private bytes/key. */
final readonly class PhotoStored
{
    public function __construct(public int $metadataId) {}
}
