<?php

declare(strict_types=1);

namespace App\Services\P2;

final readonly class Actor
{
    public function __construct(public int $id, public int $barangayId, public string $role)
    {
        if ($id < 1 || $barangayId < 1 || ! in_array($role, ['resident', 'captain', 'secretary', 'responder', 'rescuer'], true)) {
            throw new Problem('AUTH', 'Sign in to continue.');
        }
    }

    public function allow(array $roles): void
    {
        if (! in_array($this->role, $roles, true)) {
            throw new Problem('FORBIDDEN', 'Your role cannot perform this action.');
        }
    }

    public function administrator(): bool
    {
        return in_array($this->role, ['captain', 'secretary'], true);
    }
}
