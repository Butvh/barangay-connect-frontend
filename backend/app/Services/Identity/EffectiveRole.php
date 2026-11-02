<?php

namespace App\Services\Identity;

use Illuminate\Contracts\Auth\Authenticatable;

final class EffectiveRole
{
    public static function of(Authenticatable $user): ?string
    {
        if (! is_int($user->barangay_id) || $user->barangay_id < 1) {
            return null;
        }
        // Database boolean casts are a required DBA contract, never request input.
        $inactive = in_array($user->personnel_status, ['Inactive', 'Unassigned'], true);
        foreach (['captain', 'secretary', 'responder', 'rescuer', 'resident'] as $role) {
            if ($user->{'is_'.$role} === true && ($role === 'resident' || ! $inactive)) {
                return $role;
            }
        }

        return null;
    }
}
