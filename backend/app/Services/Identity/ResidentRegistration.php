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

    public function register(array $input, string $key): array
    {
        $db = $this->context->db();
        if ($db->transactionLevel() !== 0) {
            throw new \LogicException('Public registration starts outside an existing source transaction.');
        }
        if (! preg_match('/^[A-Za-z0-9_-]{8,128}$/D', $key)) {
            throw new ApiProblem('VALIDATION', 422, 'Use a valid original registration command key.');
        }
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
        $route = 'p1:resident.register';
        $digest = hash_hmac('sha256', $route.'|'.$key, config('app.key'));
        ksort($data);
        $requestHash = hash_hmac('sha256', json_encode($data, JSON_THROW_ON_ERROR), config('app.key'));
        $lock = 'p1reg:'.substr($digest, 0, 56);
        // No actor exists yet. Serialize this opaque command before any source
        // transaction; the database unique email separately prevents duplicate accounts.
        if ((int) $db->selectOne('SELECT GET_LOCK(?,5) AS held', [$lock])->held !== 1) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'The original registration is still being processed.');
        }
        try {
            $previous = $db->table('idempotency_requests')->where('route', $route)->where('key_digest', $digest)->first();
            if ($previous) {
                if (! hash_equals($previous->request_hash, $requestHash) || ! $previous->outcome) {
                    throw new ApiProblem('CONFLICT', 409, 'This registration key belongs to different original input.');
                }

                return json_decode($previous->outcome, true, flags: JSON_THROW_ON_ERROR);
            }

            return $db->transaction(function () use ($data, $hash, $route, $digest, $requestHash): array {
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

                $result = (new UserResource($user))->resolve(request());
                // Store only the original safe resource, never a password or a
                // live future role projection. Replay does not authenticate anyone.
                $db->table('idempotency_requests')->insert(['actor_id' => $id, 'route' => $route, 'key_digest' => $digest,
                    'request_hash' => $requestHash, 'http_status' => 201, 'outcome' => json_encode($result, JSON_THROW_ON_ERROR),
                    'expires_at' => $now->copy()->addDay(), 'created_at' => $now, 'updated_at' => $now]);

                return $result;
            });
        } catch (QueryException $error) {
            if (($error->errorInfo[1] ?? null) === 1062 && $db->table('users')->where('email', $data['email'])->exists()) {
                throw new ApiProblem('VALIDATION', 422, 'This email is already registered.', ['email' => 'Use another email or sign in.']);
            }
            throw $error;
        } finally {
            $db->selectOne('SELECT RELEASE_LOCK(?)', [$lock]);
        }
    }
}
