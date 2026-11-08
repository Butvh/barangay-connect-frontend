<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\P2\GuardedStore;
use App\Contracts\P2\IncidentPhotoAuthorization;
use App\Contracts\P2\Store;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Services\P2\Problem;
use App\Services\P2\Rules;
use Illuminate\Support\Facades\DB;

/** Unbound candidate; proves exact source authority, never storage/token or byte validity. */
final class IncidentPhotoPolicy implements IncidentPhotoAuthorization
{
    public function __construct(private Store $store, private IdentityReferences $identity, private SourceReferences $sources) {}

    private function guarded(): GuardedStore
    {
        if (! $this->store instanceof GuardedStore || DB::connection()->getName() !== config('integration.connection', 'mysql')) {
            throw new \LogicException('Photo authorization requires the shared guarded MySQL Store.');
        }

        return $this->store;
    }

    private function source(EffectiveIdentity $observed, int $id): object
    {
        $guard = $this->guarded();
        $guard->assertPersonLocked($observed->id);
        $guard->assertIncidentLocked($id);
        $this->identity->locked($observed);
        $row = DB::connection(config('integration.connection', 'mysql'))->table('emergency_alerts')
            ->where('id', $id)->where('barangay_id', $observed->barangayId)->lockForUpdate()
            ->first(['id', 'resident_id', 'status', 'assignment_revision']);

        return $row ?? throw new Problem('NOT_FOUND', 'This incident is unavailable.');
    }

    public function assertAttach(EffectiveIdentity $observed, int $incidentId, int $expectedRevision): void
    {
        $row = $this->source($observed, $incidentId);
        if ($observed->role !== 'resident' || (int) $row->resident_id !== $observed->id) {
            throw new Problem('NOT_FOUND', 'This incident is unavailable.');
        }
        if (! $this->sources->approved($observed, $observed->id, true)) {
            throw new Problem('FORBIDDEN', 'Current approved residency is required.');
        }
        Rules::revision(['assignment_revision' => (int) $row->assignment_revision], ['expected_revision' => $expectedRevision], 'assignment_revision');
        if (! in_array($row->status, ['Pending', 'Acknowledged'], true)) {
            throw new Problem('INVALID_STATE', 'Photos can only be attached before response begins.');
        }
    }

    public function assertDownload(EffectiveIdentity $observed, int $incidentId): void
    {
        if ($this->store->inTransaction()) {
            throw new \LogicException('Start photo read authorization outside an existing transaction.');
        }
        $this->guarded()->transaction(['person:'.$observed->id, 'incident:'.$incidentId], function () use ($observed, $incidentId) {
            $row = $this->source($observed, $incidentId);
            if (in_array($observed->role, ['captain', 'secretary'], true) || ($observed->role === 'resident' && (int) $row->resident_id === $observed->id)) {
                return;
            }
            if ($row->status !== 'Resolved' && in_array($observed->role, ['responder', 'rescuer'], true)) {
                $latest = DB::connection(config('integration.connection', 'mysql'))->table('alert_assignments')
                    ->where('alert_id', $incidentId)->where('barangay_id', $observed->barangayId)->where('role', $observed->role)
                    ->orderByDesc('id')->lockForUpdate()->first(['user_id', 'status']);
                if ($latest && (int) $latest->user_id === $observed->id && $latest->status === 'active') {
                    return;
                }
            }
            throw new Problem('NOT_FOUND', 'This incident is unavailable.');
        });
    }
}
