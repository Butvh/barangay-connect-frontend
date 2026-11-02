<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\Incidents\IncidentService;
use App\Services\Incidents\OverviewService;
use Illuminate\Http\Request;

final class IncidentController extends P2Controller
{
    public function __construct(ReferenceData $refs, private IncidentService $incidents, private OverviewService $overview)
    {
        parent::__construct($refs);
    }

    public function index(Request $r)
    {
        return $this->listing($this->incidents->list($this->actor($r), $this->query($r, ['q', 'status', 'alert_type', 'resident_id', 'sort'])));
    }

    public function show(Request $r, string $id)
    {
        return $this->data($this->incidents->get($this->actor($r), $this->id($id)));
    }

    public function create(Request $r)
    {
        return $this->data($this->incidents->create($this->actor($r), $this->body($r), $this->key($r)));
    }

    public function details(Request $r, string $id)
    {
        return $this->data($this->incidents->details($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function options(Request $r, string $id)
    {
        $q = $this->query($r, ['role']);

        return $this->data($this->incidents->assignmentOptions($this->actor($r), $this->id($id), $q['role'] ?? ''));
    }

    public function acknowledge(Request $r, string $id)
    {
        return $this->data($this->incidents->assign($this->actor($r), $this->id($id), $this->body($r), true));
    }

    public function assign(Request $r, string $id)
    {
        return $this->data($this->incidents->assign($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function transfer(Request $r, string $id)
    {
        return $this->data($this->incidents->changeAssignment($this->actor($r), $this->id($id), $this->body($r), true));
    }

    public function cancel(Request $r, string $id)
    {
        return $this->data($this->incidents->changeAssignment($this->actor($r), $this->id($id), $this->body($r), false));
    }

    public function respond(Request $r, string $id)
    {
        return $this->data($this->incidents->response($this->actor($r), $this->id($id), $this->body($r), $this->key($r)));
    }

    public function rescue(Request $r, string $id)
    {
        return $this->data($this->incidents->rescue($this->actor($r), $this->id($id), $this->body($r), $this->key($r)));
    }

    public function resolve(Request $r, string $id)
    {
        return $this->data($this->incidents->resolve($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function nearby(Request $r)
    {
        return $this->listing($this->incidents->nearby($this->actor($r), $this->query($r, ['q', 'status', 'alert_type', 'sort'])));
    }

    public function map(Request $r)
    {
        return $this->data($this->overview->map($this->actor($r), $this->query($r, ['q', 'status', 'alert_type', 'sort'])));
    }

    public function dashboard(Request $r)
    {
        return $this->data($this->overview->dashboard($this->actor($r)));
    }
}
