<?php

declare(strict_types=1);

namespace App\Contracts\P2;

interface GuardedStore extends Store
{
    public function assertPersonLocked(int $id): void;

    public function assertIncidentLocked(int $id): void;
}
