<?php

namespace App\Services\Identity;

use App\Http\Resources\Identity\UserResource;
use App\Models\User;
use App\Services\Administration\AdministrativeContext;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\Hash;

final class ProfileAdministration
{
    private const ROLES = ['resident', 'captain', 'secretary', 'responder', 'rescuer'];

    public function __construct(private AdministrativeContext $context, private SourceReferences $sources) {}

    private function projection(EffectiveIdentity $actor): array
    {
        $user = User::on($this->context->db()->getName())->with('appointment')->findOrFail($actor->id);

        return (new UserResource($user))->resolve(request()) + ['last_login_at' => $user->last_login_at,
            'household' => $actor->role === 'resident' ? $this->sources->household($actor, $actor->id, true) : null,
            'verification' => $this->sources->ownVerification($actor)];
    }

    public function get(EffectiveIdentity $actor): array
    {
        return $this->context->transaction($actor, self::ROLES, [], fn () => $this->projection($actor));
    }

    public function update(EffectiveIdentity $actor, array $input, ?int $expectedHouseholdRevision = null): array
    {
        $rules = ['full_name' => 'sometimes|required|string|max:100', 'contact_number' => 'nullable|string|max:30'];
        if ($actor->role === 'resident') {
            $rules += ['address' => 'sometimes|required|string|max:200', 'map_x' => 'nullable|numeric|between:0,100', 'map_y' => 'nullable|numeric|between:0,100'];
        }
        $fields = $this->context->validate($input, $rules);
        if (array_key_exists('map_x', $fields) !== array_key_exists('map_y', $fields) ||
            (array_key_exists('map_x', $fields) && (($fields['map_x'] === null) !== ($fields['map_y'] === null)))) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a complete household pin.');
        }

        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $fields, $expectedHouseholdRevision): array {
            $db = $this->context->db();
            $person = $db->table('users')->where('id', $actor->id)->first();
            $personal = array_intersect_key($fields, array_flip(['full_name', 'contact_number']));
            if ($personal) {
                if (isset($personal['full_name'])) {
                    $personal['full_name'] = trim($personal['full_name']);
                    if ($personal['full_name'] === '') {
                        throw new ApiProblem('VALIDATION', 422, 'Enter a full name.');
                    }
                }
                if (($personal['contact_number'] ?? null) === '') {
                    $personal['contact_number'] = null;
                }
                $personal = array_filter($personal, fn ($value, $name) => $value !== $person->$name, ARRAY_FILTER_USE_BOTH);
                if ($personal) {
                    $db->table('users')->where('id', $actor->id)->update($personal + ['updated_at' => now('UTC')]);
                    $this->context->record($actor, 'user', $actor->id, 'profile.updated.v2', [], 'Profile updated', ['status' => 'Updated'], [$actor->id]);
                }
            }
            $household = array_intersect_key($fields, array_flip(['address', 'map_x', 'map_y']));
            if ($household) {
                $home = $db->table('households')->where('id', $person->household_id)->where('barangay_id', $actor->barangayId)->lockForUpdate()->first();
                if ($expectedHouseholdRevision !== null && ($home ? (int) $home->revision : 0) !== $expectedHouseholdRevision) {
                    throw new ApiProblem('CONFLICT', 409, 'This household changed. Refresh and review it.');
                }
                if (! $home) {
                    if (empty($household['address'])) {
                        throw new ApiProblem('VALIDATION', 422, 'Household address is required.');
                    }
                    $homeId = $db->table('households')->insertGetId($household + ['barangay_id' => $actor->barangayId, 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
                    $db->table('users')->where('id', $actor->id)->update(['household_id' => $homeId, 'updated_at' => now('UTC')]);
                } else {
                    $homeId = (int) $home->id;
                    $db->table('households')->where('id', $homeId)->update($household + ['revision' => $home->revision + 1, 'updated_at' => now('UTC')]);
                }
                $this->context->record($actor, 'household', $homeId, 'household.updated.v2', [], 'Household updated', ['status' => 'Updated'], [$actor->id]);
            }

            return $this->projection($actor);
        });
    }

    public function changePassword(EffectiveIdentity $actor, array $input): array
    {
        $fields = $this->context->validate($input, ['current_password' => 'required|string|max:128',
            'password' => ['required', 'string', 'min:8', 'max:128', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'confirmed'],
            'password_confirmation' => 'required|string|max:128']);
        $hash = Hash::make($fields['password']); // Expensive hashing is outside the retried source transaction.

        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $fields, $hash): array {
            $db = $this->context->db();
            $user = $db->table('users')->where('id', $actor->id)->first();
            if (! Hash::check($fields['current_password'], $user->password) || Hash::check($fields['password'], $user->password)) {
                throw new ApiProblem('VALIDATION', 422, 'Check the current and new passwords.', ['current_password' => 'Check this field.']);
            }
            $db->table('users')->where('id', $actor->id)->update(['password' => $hash, 'auth_version' => $user->auth_version + 1, 'remember_token' => null, 'updated_at' => now('UTC')]);
            $db->table('password_recovery_challenges')->where('user_id', $actor->id)->whereNull('consumed_at')->update(['superseded_at' => now('UTC'), 'updated_at' => now('UTC')]);
            $this->context->record($actor, 'user', $actor->id, 'security.updated.v2', ['action' => 'password_changed'], 'Password changed', ['status' => 'password_changed'], [$actor->id]);

            return ['password_changed' => true];
        });
    }
}
