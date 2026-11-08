<?php

namespace App\Services\Identity;

use Illuminate\Contracts\Auth\Authenticatable;

final class EffectiveRole
{
    public static function of(Authenticatable $user): ?string
    {
        if (! is_int($user->barangay_id) || $user->barangay_id < 1 || $user->account_status !== 'Active') {
            return null;
        }
        if ($user->is_captain === true) {
            return 'captain';
        }
        $appointment = $user->appointment;
        if ($appointment && $appointment->barangay_id === $user->barangay_id &&
            $appointment->status === 'Active' && in_array($appointment->role, ['secretary', 'responder', 'rescuer'], true)) {
            return $appointment->role;
        }

        return $user->is_resident === true ? 'resident' : null;
    }

    /** Frontend role flags are derived projections, not duplicated database columns. */
    public static function flags(Authenticatable $user): array
    {
        $appointment = $user->appointment;
        $sameScope = $appointment && $appointment->barangay_id === $user->barangay_id;
        $membership = $user->tanodMembership;
        $result = [
            'is_captain' => $user->is_captain === true, 'is_resident' => $user->is_resident === true,
            'is_tanod' => $membership && $membership->barangay_id === $user->barangay_id,
            'personnel_status' => $sameScope ? $appointment->status : null,
        ];
        foreach (['secretary', 'responder', 'rescuer'] as $role) {
            $result['is_'.$role] = $sameScope && $appointment->role === $role;
        }

        return $result;
    }
}
