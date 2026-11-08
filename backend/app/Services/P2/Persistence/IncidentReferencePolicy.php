<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\References\IncidentReferenceAuthorization;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Support\Facades\DB;

/** P1 validates the observed identity; P2 proves the current source assignment. */
final class IncidentReferencePolicy implements IncidentReferenceAuthorization
{
    public function allows(EffectiveIdentity $observed, int $residentId, bool $locked): bool
    {
        if (! in_array($observed->role, ['responder', 'rescuer'], true)) {
            return false;
        }
        $query = DB::connection(config('integration.connection', 'mysql'))->table('alert_assignments as a')
            ->join('emergency_alerts as e', 'e.id', '=', 'a.alert_id')
            ->where('a.barangay_id', $observed->barangayId)->where('e.barangay_id', $observed->barangayId)
            ->where('e.resident_id', $residentId)->where('a.user_id', $observed->id)->where('a.role', $observed->role)
            ->whereIn('a.status', ['active', 'completed', 'closed'])
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('alert_assignments as later')
                ->whereColumn('later.alert_id', 'a.alert_id')->whereColumn('later.role', 'a.role')->whereColumn('later.id', '>', 'a.id'));
        if ($locked) {
            $query->lockForUpdate();
        }

        return $query->first(['a.id']) !== null;
    }
}
