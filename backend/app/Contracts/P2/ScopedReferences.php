<?php

declare(strict_types=1);

namespace App\Contracts\P2;

use App\Services\P2\Actor;

/** Optional production extension; portable domain doubles retain the original port. */
interface ScopedReferences
{
    public function forActor(Actor $actor): ReferenceData;

    /** Server-side event selection only; not a browser directory. */
    public function officialRecipients(Actor $actor): array;
}
