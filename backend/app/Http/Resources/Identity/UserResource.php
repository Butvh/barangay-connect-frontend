<?php

namespace App\Http\Resources\Identity;

use App\Services\Identity\EffectiveRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Explicit projection prevents future model fields becoming public by accident.
        $user = $this->resource;
        $result = [
            'id' => (int) $user->getAuthIdentifier(), 'full_name' => $user->full_name,
            'email' => $user->email, 'contact_number' => $user->contact_number,
            'barangay_id' => (int) $user->barangay_id,
            'household_id' => $user->household_id === null ? null : (int) $user->household_id,
            'account_status' => $user->account_status, 'created_at' => $user->created_at,
            'role' => EffectiveRole::of($user),
        ];

        return array_merge($result, EffectiveRole::flags($user));
    }
}
