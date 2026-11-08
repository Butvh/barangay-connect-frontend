<?php

namespace Tests\Support;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Support\Facades\Hash;

/** Isolated guard test double. Not registered by application code or backed by a schema. */
final class ArrayUserProvider implements UserProvider
{
    public array $users = [];

    public function retrieveById($identifier)
    {
        return $this->users[$identifier] ?? null;
    }

    public function retrieveByToken($identifier, $token)
    {
        return null; // Remember-me authentication is not supported.
    }

    public function updateRememberToken(Authenticatable $user, $token)
    {
        $user->setRememberToken($token);
    }

    public function retrieveByCredentials(array $credentials)
    {
        foreach ($this->users as $user) {
            if ($user->email === $credentials['email']) {
                return $user;
            }
        }

        return null;
    }

    public function validateCredentials(Authenticatable $user, array $credentials)
    {
        return Hash::check($credentials['password'], $user->getAuthPassword());
    }

    public function rehashPasswordIfRequired(Authenticatable $user, array $credentials, bool $force = false) {}
}
