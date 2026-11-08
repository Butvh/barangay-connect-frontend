<?php

namespace App\Services\Identity;

use App\Contracts\References\IncidentReferenceAuthorization;
use App\Models\User;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/** P1 read projections, not P2 repositories or source-access/notification writers. */
final class SourceReferences
{
    public function __construct(private readonly IdentityReferences $identity = new IdentityReferences) {}

    private function table(string $table, bool $locked = false): Builder
    {
        $connection = DB::connection(config('integration.connection', 'mysql'));
        if ($locked && $connection->transactionLevel() < 1) {
            throw new \LogicException('Locked references require the caller transaction and ordered guards.');
        }

        return $connection->table($table)->when($locked, fn ($query) => $query->lockForUpdate());
    }

    private function actor(EffectiveIdentity $observed, bool $locked = false): void
    {
        if ($locked) {
            $this->identity->locked($observed);
        } else {
            $this->identity->assertCurrent($observed);
        }
    }

    private function administrator(EffectiveIdentity $actor): void
    {
        if (! in_array($actor->role, ['captain', 'secretary'], true)) {
            throw new ApiProblem('FORBIDDEN', 403, 'This reference is restricted to barangay officials.');
        }
    }

    /** Before locked calls, P2 holds ALL affected operations guards and sorted user/appointment rows. */
    private function resident(EffectiveIdentity $actor, int $residentId, bool $locked): object
    {
        $this->actor($actor, $locked);
        if ($residentId < 1) {
            throw new ApiProblem('NOT_FOUND', 404, 'Resident reference is unavailable.');
        }
        if ($residentId !== $actor->id && ! in_array($actor->role, ['captain', 'secretary'], true)) {
            if ($actor->role === 'resident') {
                throw new ApiProblem('FORBIDDEN', 403, 'This resident reference is not available for your account.');
            }
            if (! app()->bound(IncidentReferenceAuthorization::class)) {
                throw new ApiProblem('NOT_AVAILABLE', 503, 'Assigned-incident reference authorization is awaiting integration.');
            }
            if (! app(IncidentReferenceAuthorization::class)->allows($actor, $residentId, $locked)) {
                throw new ApiProblem('FORBIDDEN', 403, 'This incident reference is not available for your account.');
            }
        }
        $user = $this->table('users', $locked)->where('id', $residentId)->where('barangay_id', $actor->barangayId)
            ->where('is_resident', true)->first(['id', 'household_id']);

        return $user ?? throw new ApiProblem('NOT_FOUND', 404, 'Resident reference is unavailable.');
    }

    public function household(EffectiveIdentity $actor, int $residentId, bool $locked = false): ?array
    {
        $user = $this->resident($actor, $residentId, $locked);
        if ($user->household_id === null) {
            return null; // Actual absent relationship, not a missing adapter.
        }
        $home = $this->table('households', $locked)->where('id', $user->household_id)->where('barangay_id', $actor->barangayId)
            ->first(['id', 'barangay_id', 'address', 'map_x', 'map_y', 'revision']);
        if (! $home) {
            throw new ApiProblem('NOT_FOUND', 404, 'Household reference is unavailable.');
        }

        return ['id' => (int) $home->id, 'barangay_id' => (int) $home->barangay_id, 'address' => $home->address,
            'map_x' => $home->map_x === null ? null : (float) $home->map_x, 'map_y' => $home->map_y === null ? null : (float) $home->map_y,
            'revision' => (int) $home->revision];
    }

    public function approved(EffectiveIdentity $actor, int $residentId, bool $locked = false): bool
    {
        $this->resident($actor, $residentId, $locked);
        $latest = $this->table('verifications', $locked)->where('resident_id', $residentId)->where('barangay_id', $actor->barangayId)
            ->orderByDesc('id')->first(['review_status']);

        return $latest?->review_status === 'Approved';
    }

    public function ownVerification(EffectiveIdentity $actor): ?array
    {
        $this->actor($actor);
        if ($actor->role !== 'resident') {
            return null;
        }
        $row = $this->table('verifications')->where('resident_id', $actor->id)->where('barangay_id', $actor->barangayId)
            ->orderByDesc('id')->first(['id', 'review_status', 'revision']);

        return $row ? ['id' => (int) $row->id, 'user_id' => $actor->id, 'review_status' => $row->review_status, 'revision' => (int) $row->revision] : null;
    }

    public function facilities(EffectiveIdentity $actor, bool $locked = false): array
    {
        if ($locked) {
            throw new \LogicException('Use a single facility reference after the ordered incident/facility locks.');
        }
        $this->actor($actor, $locked);

        return $this->table('facilities', $locked)->where(fn ($q) => $q->where('managed_by_barangay_id', $actor->barangayId)->orWhere('visibility', 'shared'))
            ->when($actor->role === 'resident', fn ($q) => $q->where('active', true))
            ->orderBy('id')->get(['id', 'managed_by_barangay_id', 'visibility', 'name', 'type', 'address', 'capacity', 'contact', 'active', 'map_x', 'map_y', 'map_scope', 'revision'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'managed_by_barangay_id' => (int) $row->managed_by_barangay_id,
                'barangay_id' => $row->visibility === 'shared' ? null : (int) $row->managed_by_barangay_id,
                'visibility' => $row->visibility, 'name' => $row->name, 'type' => $row->type, 'address' => $row->address,
                'capacity' => $row->capacity === null ? null : (int) $row->capacity, 'contact_number' => $row->contact,
                'is_active' => (bool) $row->active, 'map_x' => $row->map_x === null ? null : (float) $row->map_x,
                'map_y' => $row->map_y === null ? null : (float) $row->map_y, 'map_scope' => $row->map_scope, 'revision' => (int) $row->revision])->all();
    }

    public function facility(EffectiveIdentity $actor, int $id, bool $locked = false): ?array
    {
        $this->actor($actor, $locked);
        $row = $this->table('facilities', $locked)->where('id', $id)
            ->where(fn ($query) => $query->where('managed_by_barangay_id', $actor->barangayId)->orWhere('visibility', 'shared'))
            ->first(['id', 'managed_by_barangay_id', 'visibility', 'name', 'type', 'address', 'capacity', 'contact', 'active', 'map_x', 'map_y', 'map_scope', 'revision']);
        if (! $row) {
            return null;
        }

        return ['id' => (int) $row->id, 'managed_by_barangay_id' => (int) $row->managed_by_barangay_id,
            'visibility' => $row->visibility, 'name' => $row->name, 'type' => $row->type, 'address' => $row->address,
            'capacity' => $row->capacity === null ? null : (int) $row->capacity, 'contact_number' => $row->contact,
            'is_active' => (bool) $row->active, 'map_x' => $row->map_x === null ? null : (float) $row->map_x,
            'map_y' => $row->map_y === null ? null : (float) $row->map_y, 'map_scope' => $row->map_scope, 'revision' => (int) $row->revision];
    }

    public function people(EffectiveIdentity $actor): array
    {
        $this->actor($actor);
        $this->administrator($actor);

        return User::on(config('integration.connection', 'mysql'))->where('barangay_id', $actor->barangayId)
            ->with(['appointment', 'tanodMembership'])->orderBy('id')->get()->map(fn ($user) => array_merge([
                'id' => $user->id, 'barangay_id' => $user->barangay_id, 'full_name' => $user->full_name,
                'role' => EffectiveRole::of($user), 'account_status' => $user->account_status,
            ], EffectiveRole::flags($user)))->all();
    }

    public function personnel(EffectiveIdentity $actor): array
    {
        $this->actor($actor);
        if ($actor->role !== 'captain') {
            throw new ApiProblem('FORBIDDEN', 403, 'Personnel report references are restricted to the Captain.');
        }

        return $this->table('personnel_appointments')->where('barangay_id', $actor->barangayId)->orderBy('id')
            ->get(['id', 'user_id', 'barangay_id', 'role', 'status', 'source', 'effective_date', 'revision'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'user_id' => (int) $row->user_id, 'barangay_id' => (int) $row->barangay_id,
                'role' => $row->role, 'status' => $row->status, 'source' => $row->source, 'effective_date' => $row->effective_date,
                'revision' => (int) $row->revision])->all();
    }

    public function verifications(EffectiveIdentity $actor): array
    {
        $this->actor($actor);
        $this->administrator($actor);

        return $this->table('verifications')->where('barangay_id', $actor->barangayId)->orderBy('id')
            ->get(['id', 'resident_id', 'barangay_id', 'review_status', 'deadline_at', 'reviewed_at', 'revision'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'resident_id' => (int) $row->resident_id, 'barangay_id' => (int) $row->barangay_id,
                'review_status' => $row->review_status, 'deadline_at' => $this->iso($row->deadline_at),
                'reviewed_at' => $this->iso($row->reviewed_at), 'revision' => (int) $row->revision])->all();
    }

    public function barangay(EffectiveIdentity $actor): array
    {
        $this->actor($actor);
        $row = $this->table('barangays')->where('id', $actor->barangayId)->first(['id', 'name', 'address', 'municipality', 'map_scope']);
        if (! $row) {
            throw new ApiProblem('NOT_FOUND', 404, 'Barangay reference is unavailable.');
        }

        return ['id' => (int) $row->id, 'name' => $row->name, 'address' => $row->address, 'municipality' => $row->municipality, 'map_scope' => $row->map_scope];
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->toISOString();
    }
}
