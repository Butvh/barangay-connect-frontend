<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\Incidents\IncidentService;
use App\Services\Reports\ReportService;
use Illuminate\Http\Request;

final class ReportController extends P2Controller
{
    public function __construct(ReferenceData $refs, private ReportService $reports, private IncidentService $incidents)
    {
        parent::__construct($refs);
    }

    public function snapshot(Request $r)
    {
        return $this->data($this->reports->snapshot($this->actor($r)));
    }

    public function summary(Request $r)
    {
        $q = $this->query($r, ['month']);

        return $this->data($this->reports->summary($this->actor($r), $q['month'] ?? ''));
    }

    public function activity(Request $r)
    {
        return $this->listing($this->reports->activity($this->actor($r), $this->query($r, ['month', 'actor_id', 'type', 'q'])));
    }

    public function performance(Request $r)
    {
        $q = $this->query($r, ['month', 'role']);

        return $this->data($this->reports->performance($this->actor($r), $q['month'] ?? '', $q['role'] ?? ''));
    }

    public function incidents(Request $r)
    {
        $a = $this->actor($r);
        $a->allow(['captain']);

        return $this->listing($this->incidents->list($a, $this->query($r, ['q', 'status', 'alert_type', 'sort'])));
    }

    public function incident(Request $r, string $id)
    {
        $a = $this->actor($r);
        $a->allow(['captain']);

        return $this->data($this->incidents->get($a, $this->id($id)));
    }

    public function export(Request $r, string $id)
    {
        $a = $this->actor($r);
        $a->allow(['captain']);
        $row = $this->incidents->get($a, $this->id($id));
        $cells = ['A-'.$row['id'], $row['alert_type'], $row['location_label'], $row['status'], $row['victim_count'] ?? 'Unknown', $row['created_at'], $row['resolved_at'] ?? 'Unknown'];
        $csv = "Report ID,Type,Location,Status,Victims,Reported,Resolved\r\n".implode(',', array_map(ReportService::csvCell(...), $cells))."\r\n";

        return response($csv, 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="incident-'.$row['id'].'.csv"', 'Cache-Control' => 'private, no-store']);
    }
}
