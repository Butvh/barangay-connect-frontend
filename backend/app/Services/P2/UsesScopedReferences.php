<?php

declare(strict_types=1);

namespace App\Services\P2;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\ScopedReferences;

trait UsesScopedReferences
{
    protected function references(Actor $actor): ReferenceData
    {
        return $this->refs instanceof ScopedReferences ? $this->refs->forActor($actor) : $this->refs;
    }
}
