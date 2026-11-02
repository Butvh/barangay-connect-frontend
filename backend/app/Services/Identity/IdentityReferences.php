<?php

namespace App\Services\Identity;

use App\Models\User;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use LogicException;

/** P1 boundary. P2's adapter converts its DTO to Actor; no raw model crosses this service. */
final class IdentityReferences
{
    public function current(Request $request): EffectiveIdentity
    {
        $identity = $request->attributes->get('effective_identity');
        if (! config('identity.enabled') || ! $identity instanceof EffectiveIdentity) {
            throw new ApiProblem('AUTH', 401, 'Sign in to continue.');
        }

        return $identity;
    }

    /** Caller must already hold the sorted operations-person guards on the named connection. */
    public function locked(EffectiveIdentity $observed): EffectiveIdentity
    {
        $connection = DB::connection(config('integration.connection', 'mysql'));
        if ($connection->transactionLevel() < 1) {
            throw new LogicException('A caller-owned transaction and person guard are required.');
        }
        if (! config('identity.enabled') || ! class_exists(User::class)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Identity integration is not available yet.');
        }
        $user = User::on($connection->getName())
            ->where('id', $observed->id)->where('barangay_id', $observed->barangayId)->lockForUpdate()->first();
        if ($user) {
            // Fresh locking reads avoid an appointment cached before waiting on a guard.
            $user->setRelation('appointment', $user->appointment()->where('barangay_id', $observed->barangayId)->lockForUpdate()->first());
        }
        $fresh = $user ? EffectiveIdentity::fromUser($user) : null;
        if (! $fresh || ! $observed->sameAs($fresh)) {
            throw new ApiProblem('AUTH', 401, 'Account access changed. Sign in again.');
        }

        return $fresh;
    }

    /** Minimal person directory: administrative scope or own identity only. */
    public function person(EffectiveIdentity $actor, int $id): ?array
    {
        if ($id < 1 || ($id !== $actor->id && ! in_array($actor->role, ['captain', 'secretary'], true))) {
            throw new ApiProblem('FORBIDDEN', 403, 'This person reference is not available for your account.');
        }
        if (! config('identity.enabled') || ! class_exists(User::class)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Identity integration is not available yet.');
        }
        $user = User::on(config('integration.connection', 'mysql'))->where('id', $id)
            ->where('barangay_id', $actor->barangayId)->with(['appointment', 'tanodMembership'])->first();
        if (! $user) {
            return null;
        }

        return array_merge(['id' => (int) $user->id, 'full_name' => $user->full_name,
            'barangay_id' => $actor->barangayId, 'role' => EffectiveIdentity::fromUser($user)?->role], EffectiveRole::flags($user));
    }

    /** P1-domain reference projections require their reviewed services; no empty success. */
    public function unavailable(string $projection): never
    {
        throw new ApiProblem('NOT_AVAILABLE', 503, 'This reference projection is awaiting integration.');
    }
}
