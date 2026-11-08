<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\Civic\CivicService;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use App\Services\Messaging\NotificationService;
use App\Services\P2\Problem;
use App\Services\Reports\ReportService;
use Illuminate\Http\Request;

final class RevisionController extends P2Controller
{
    public function __construct(ReferenceData $refs, private IncidentService $incidents, private CivicService $civic, private NotificationService $notifications, private ReportService $reports, private OverviewService $overview)
    {
        parent::__construct($refs);
    }

    public function show(Request $request, string $entity)
    {
        $actor = $this->actor($request);
        // Hash only authorized projections, including visibility changes. Never hash another user's scope.
        $value = match ($entity) {
            'alerts' => $actor->role === 'resident' ? ['own' => $this->incidents->list($actor), 'nearby' => $this->incidents->nearby($actor)] : $this->incidents->list($actor),
            'announcements' => $this->civic->announcements($actor),
            'feedback' => $this->civic->feedback($actor),
            'notifications' => $this->notifications->list($actor),
            'reports' => $this->reports->snapshot($actor),
            'dashboard' => $this->overview->dashboard($actor),
            'map' => $this->overview->map($actor),
            default => throw new Problem('NOT_FOUND', 'Refresh source unavailable.'),
        };
        if ($entity === 'reports') {
            unset($value['at']); // Snapshot response time is not a source revision.
        }

        return $this->data(['revision' => hash('sha256', json_encode([$actor->id, $actor->role, $actor->barangayId, $value], JSON_THROW_ON_ERROR))]);
    }
}
