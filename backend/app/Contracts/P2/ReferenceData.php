<?php

declare(strict_types=1);

namespace App\Contracts\P2;

use App\Services\P2\Actor;

/** P1-owned authenticated identity/reference gateway, mapped to DBA models. Never client authority. */
interface ReferenceData
{
    public function actorFor(int $authenticatedUserId): Actor;

    public function person(int $id, int $barangay): ?array;

    public function people(int $barangay): array;

    public function household(int $userId, int $barangay): ?array;

    public function approved(int $userId, int $barangay): bool;

    public function facilities(int $barangay): array;

    public function verifications(int $barangay): array;

    public function personnel(int $barangay): array;

    public function barangay(int $id): array;
}
