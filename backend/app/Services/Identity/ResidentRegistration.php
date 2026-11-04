<?php

namespace App\Services\Identity;

use App\Http\Resources\Identity\UserResource;
use App\Models\User;
use App\Services\Administration\AdministrativeContext;
use App\Support\ApiProblem;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Hash;

final class ResidentRegistration
{
    public function __construct(private AdministrativeContext $context) {}

    public function register(array $input): array
    {
        $data = $this->context->validate($input, ['full_name' => 'required|string|max:100', 'email' => 'required|string|email:rfc|max:254',
            'password' => 'required|string|min:8|max:128', 'contact_number' => 'nullable|string|max:30',
            'barangay_id' => 'required|integer|min:1', 'household_address' => 'required|string|max:200',
            'map_x' => 'nullable|numeric|between:0,100', 'map_y' => 'nullable|numeric|between:0,100']);
        $data['email'] = mb_strtolower(trim($data['email']));
        if (! $this->context->db()->table('barangays')->where('id', $data['barangay_id'])->exists()) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a valid barangay.');
        }
        if (array_key_exists('map_x', $data) !== array_key_exists('map_y', $data) ||
            (($data['map_x'] ?? null) === null) !== (($data['map_y'] ?? null) === null) || trim($data['full_name']) === '' || trim($data['household_address']) === '') {
            throw new ApiProblem('VALIDATION', 422, 'Enter a name, address and complete optional map pin.');
        }
        $hash = Hash::make($data['password']);
        try {
            return $this->context->db()->transaction(function () use ($data, $hash): array {
                $db = $this->context->db();
                $now = now('UTC');
                $home = $db->table('households')->insertGetId(['barangay_id' => $data['barangay_id'], 'address' => trim($data['household_address']),
                    'map_x' => $data['map_x'] ?? null, 'map_y' => $data['map_y'] ?? null, 'created_at' => $now, 'updated_at' => $now]);
                $id = $db->table('users')->insertGetId(['barangay_id' => $data['barangay_id'], 'household_id' => $home,
                    'full_name' => trim($data['full_name']), 'email' => $data['email'], 'password' => $hash, 'contact_number' => $data['contact_number'] ?? null,
                    'is_resident' => true, 'is_captain' => false, 'account_status' => 'Active', 'auth_version' => 0, 'created_at' => $now, 'updated_at' => $now]);
                $user = User::on($db->getName())->findOrFail($id);
                $actor = EffectiveIdentity::fromUser($user);
                $this->context->record($actor, 'user', $id, 'identity.resident_registered.v2', [], 'Resident registered', ['status' => 'Active'], [$id]);

                return (new UserResource($user))->resolve(request());
            });
        } catch (QueryException $error) {
            if (($error->errorInfo[1] ?? null) === 1062) {
                throw new ApiProblem('VALIDATION', 422, 'This email is already registered.', ['email' => 'Use another email or sign in.']);
            }
            throw $error;
        }
    }
}
