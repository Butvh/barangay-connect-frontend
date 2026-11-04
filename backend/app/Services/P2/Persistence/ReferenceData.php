<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\P2\ActorReferences;
use App\Contracts\P2\DestinationReferences;
use App\Contracts\P2\EligibilityReferences;
use App\Contracts\P2\GuardedStore;
use App\Contracts\P2\ScopedReferences;
use App\Contracts\P2\Store;
use App\Models\User;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\EffectiveRole;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\P2\Actor;
use App\Services\P2\Problem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Reads only current DBA records; P1 remains the authority for effective portal identity. */
final class ReferenceData implements \App\Contracts\P2\ReferenceData, ActorReferences, DestinationReferences, EligibilityReferences, ScopedReferences
{
    private ?EffectiveIdentity $observed = null;

    public function __construct(private Store $store) {}

    public function forActor(Actor $actor): \App\Contracts\P2\ReferenceData
    {
        $identity = $actor->observedIdentity();
        if (! $identity instanceof EffectiveIdentity || $identity->id !== $actor->id || $identity->barangayId !== $actor->barangayId || $identity->role !== $actor->role) {
            throw new Problem('AUTH', 'A matching captured identity is required.');
        }
        $copy = clone $this;
        $copy->observed = $identity;

        return $copy;
    }

    private function identity(int $scope): EffectiveIdentity
    {
        if (! $this->observed) {
            throw new Problem('AUTH', 'Bind the captured actor before reading references.');
        }
        if ($this->observed->barangayId !== $scope) {
            throw new Problem('FORBIDDEN', 'Cross-scope reference is unavailable.');
        }

        return $this->observed;
    }

    public function officialRecipients(Actor $actor): array
    {
        $bound = $this->forActor($actor);
        app(IdentityReferences::class)->assertCurrent($bound->identity($actor->barangayId));

        // Internal event selection: only minimal eligible official IDs/roles, never a public directory.
        return User::query()->with('appointment')->where('barangay_id', $actor->barangayId)->where('account_status', 'Active')
            ->get()->map(fn ($u) => $this->project($u))->filter(fn ($p) => in_array($p['role'], ['captain', 'secretary'], true))->values()->all();
    }

    public function current(Request $request): Actor
    {
        $identity = app(IdentityReferences::class)->current($request);

        return new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
    }

    public function locked(Actor $observed): Actor
    {
        $identity = $observed->observedIdentity();
        if (! $identity instanceof EffectiveIdentity) {
            throw new Problem('AUTH', 'A captured server identity is required.');
        }
        $fresh = app(IdentityReferences::class)->locked($identity);

        return new Actor($fresh->id, $fresh->barangayId, $fresh->role, $fresh);
    }

    private function user(int $id, bool $locked = false): ?User
    {
        $query = User::query();
        if (! $locked) {
            return $query->with(['appointment', 'tanodMembership'])->find($id);
        }
        $user = $query->lockForUpdate()->find($id);
        if ($user) {
            // Eager-loading uses snapshot reads; eligibility after a guard wait needs current reads.
            $user->setRelation('appointment', $user->appointment()->lockForUpdate()->first());
            $user->setRelation('tanodMembership', $user->tanodMembership()->lockForUpdate()->first());
        }

        return $user;
    }

    public function actorFor(int $authenticatedUserId): Actor
    {
        // Dispatcher/display projection may run after an outbox/receipt lock. It must
        // not acquire a new person lock. Mutations always use locked(original observation)
        // under declared person guards; notification reads reauthorize current source access.
        $user = $this->user($authenticatedUserId);
        $identity = $user ? EffectiveIdentity::fromUser($user) : null;
        if (! $identity) {
            throw new Problem('FORBIDDEN', 'Current account access is unavailable.');
        }

        return new Actor($identity->id, $identity->barangayId, $identity->role, $identity);
    }

    private function project(User $user): array
    {
        $flags = EffectiveRole::flags($user);
        $role = EffectiveRole::of($user);

        return ['id' => (int) $user->id, 'barangay_id' => (int) $user->barangay_id, 'full_name' => $user->full_name, 'role' => $role ?? ($flags['is_tanod'] ? 'tanod' : null), 'account_status' => $user->account_status] + $flags;
    }

    public function person(int $id, int $barangay): ?array
    {
        $actor = $this->identity($barangay);
        app(IdentityReferences::class)->assertCurrent($actor);
        if ($id !== $actor->id && ! in_array($actor->role, ['captain', 'secretary'], true) && ! $this->participant($actor, $id)) {
            throw new Problem('FORBIDDEN', 'This person is not part of an accessible source.');
        }
        $user = $this->user($id);

        return $user && $user->barangay_id === $barangay ? $this->project($user) : null;
    }

    public function people(int $barangay): array
    {
        return app(SourceReferences::class)->people($this->identity($barangay));
    }

    public function eligiblePerson(int $id, int $barangay): ?array
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Eligibility requires the caller transaction and declared person locks.');
        }
        if (! $this->store instanceof GuardedStore) {
            throw new \LogicException('Mutable references require a guarded relational Store.');
        }
        $this->store->assertPersonLocked($id);
        $actor = $this->identity($barangay);
        app(IdentityReferences::class)->assertCurrent($actor);
        if (! in_array($actor->role, ['captain', 'secretary'], true)) {
            throw new Problem('FORBIDDEN', 'Only officials may select personnel.');
        }
        $user = $this->user($id, true);

        if (! $user || $user->barangay_id !== $barangay) {
            return null;
        }
        $person = $this->project($user);
        $person['is_tanod'] = $person['is_tanod'] && $user->account_status === 'Active' && $user->tanodMembership?->active === true;

        return $person;
    }

    public function household(int $userId, int $barangay): ?array
    {
        $actor = $this->identity($barangay);

        // Projection must not introduce identity/household locks after an incident lock.
        return app(SourceReferences::class)->household($actor, $userId);
    }

    public function sosHousehold(int $residentId, int $barangay): ?array
    {
        $actor = $this->identity($barangay);
        if ($residentId !== $actor->id || $actor->role !== 'resident' || DB::transactionLevel() < 1) {
            throw new \LogicException('SOS household eligibility requires the guarded resident transaction.');
        }
        if (! $this->store instanceof GuardedStore) {
            throw new \LogicException('SOS requires a guarded relational Store.');
        }
        $this->store->assertPersonLocked($residentId);

        return app(SourceReferences::class)->household($actor, $residentId, true);
    }

    public function approved(int $userId, int $barangay): bool
    {
        $actor = $this->identity($barangay);

        return app(SourceReferences::class)->approved($actor, $userId, DB::transactionLevel() > 0 && $userId === $actor->id);
    }

    public function facilities(int $barangay): array
    {
        return app(SourceReferences::class)->facilities($this->identity($barangay));
    }

    public function verifications(int $barangay): array
    {
        return array_map(fn ($v) => $v + ['user_id' => $v['resident_id']], app(SourceReferences::class)->verifications($this->identity($barangay)));
    }

    public function destination(int $id, int $barangay): ?array
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Destination eligibility requires the caller transaction.');
        }

        return app(SourceReferences::class)->facility($this->identity($barangay), $id, true);
    }

    public function personnel(int $barangay): array
    {
        $appointments = app(SourceReferences::class)->personnel($this->identity($barangay));
        $people = $this->people($barangay);

        return ['people' => array_values(array_filter($people, fn ($p) => in_array($p['role'], ['secretary', 'responder', 'rescuer'], true))), 'appointments' => $appointments, 'capacities' => ['secretary' => 3, 'responder' => 6, 'rescuer' => 6]];
    }

    public function barangay(int $id): array
    {
        return app(SourceReferences::class)->barangay($this->identity($id));
    }

    /** Minimal names/roles for participants already rooted in an authorized persisted source. */
    private function participant(EffectiveIdentity $actor, int $id): bool
    {
        $scope = $actor->barangayId;
        $alerts = DB::table('emergency_alerts')->where('barangay_id', $scope);
        if ($actor->role === 'resident') {
            $alerts->where('resident_id', $actor->id);
        } else {
            $alerts->whereIn('id', DB::table('alert_assignments as a')->select('a.alert_id')->where('a.barangay_id', $scope)
                ->where('a.user_id', $actor->id)->where('a.role', $actor->role)->whereIn('a.status', ['active', 'completed', 'closed'])
                ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('alert_assignments as later')->whereColumn('later.alert_id', 'a.alert_id')->whereColumn('later.role', 'a.role')->whereColumn('later.id', '>', 'a.id')));
        }
        $alertIds = $alerts->pluck('id');
        if (DB::table('emergency_alerts')->whereIn('id', $alertIds)->where('resident_id', $id)->exists()
            || DB::table('alert_assignments')->whereIn('alert_id', $alertIds)->where(fn ($q) => $q->where('user_id', $id)->orWhere('assigned_by', $id))->exists()
            || DB::table('incident_status_history')->whereIn('alert_id', $alertIds)->where('actor_id', $id)->exists()) {
            return true;
        }
        if ($actor->role !== 'resident') {
            return false;
        }

        return DB::table('community_feedback')->where(['barangay_id' => $scope, 'resident_id' => $actor->id, 'assigned_tanod_id' => $id])->exists()
            || DB::table('announcements')->where(['barangay_id' => $scope, 'author_id' => $id, 'status' => 'Active'])
                ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->exists();
    }
}
