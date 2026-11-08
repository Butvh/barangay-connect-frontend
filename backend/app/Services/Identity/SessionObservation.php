<?php

namespace App\Services\Identity;

use Illuminate\Http\Request;

/** A concurrency nonce, never a credential, role or public authentication version. */
final class SessionObservation
{
    public static function rotate(Request $request): string
    {
        $value = bin2hex(random_bytes(32));
        $request->session()->put('identity_observation', $value);

        return $value;
    }

    public static function current(Request $request): string
    {
        $value = $request->session()->get('identity_observation');

        return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) ? $value : self::rotate($request);
    }
}
