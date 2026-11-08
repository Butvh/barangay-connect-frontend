<?php

namespace App\Services\Photos;

use App\Contracts\P2\IncidentPhotoAuthorization;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Support\Facades\DB;

/** Authorized display metadata only; download independently rechecks the same source. */
final class IncidentPhotoReferences
{
    public function __construct(private IncidentPhotoAuthorization $policy) {}

    public function forIncident(EffectiveIdentity $observed, int $incidentId): array
    {
        $this->policy->assertDownload($observed, $incidentId);

        return DB::connection(config('integration.connection'))->table('incident_photos')
            ->where('incident_id', $incidentId)->where('barangay_id', $observed->barangayId)->where('state', 'attached')
            ->orderBy('id')->get(['id', 'mime', 'bytes'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'mime' => $row->mime, 'bytes' => (int) $row->bytes])->all();
    }
}
