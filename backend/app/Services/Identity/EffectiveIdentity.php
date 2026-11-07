<?php

namespace App\Services\Identity;

use Illuminate\Contracts\Auth\Authenticatable;

/** Internal server identity, never a raw model or browser-supplied role. */
final readonly class EffectiveIdentity
{
    private function __construct(
        public int $id,
        public int $barangayId,
        public string $role,
        private int $generation,
    ) {}

    public static function fromUser(Authenticatable $user): ?self
    {
        $id = $user->getAuthIdentifier();
        $role = EffectiveRole::of($user);
        if (! is_int($id) || $id < 1 || ! $role || ! is_int($user->auth_version) || $user->auth_version < 0) {
            return null;
        }

        return new self($id, $user->barangay_id, $role, $user->auth_version);
    }

    public function sessionSnapshot(): array
    {
        return ['identity_role' => $this->role, 'identity_version' => $this->generation, 'identity_scope' => $this->barangayId];
    }

    public function matches(array $snapshot): bool
    {
        foreach ($this->sessionSnapshot() as $key => $value) {
            if (! array_key_exists($key, $snapshot) || $snapshot[$key] !== $value) {
                return false;
            }
        }

        return true;
    }

    public function sameAs(self $other): bool
    {
        return $this->id === $other->id && $this->sessionSnapshot() === $other->sessionSnapshot();
    }
}
