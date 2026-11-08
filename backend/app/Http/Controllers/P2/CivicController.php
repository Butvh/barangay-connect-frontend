<?php

declare(strict_types=1);

namespace App\Http\Controllers\P2;

use App\Contracts\P2\ReferenceData;
use App\Services\Civic\CivicService;
use Illuminate\Http\Request;

final class CivicController extends P2Controller
{
    public function expire(Request $r)
    {
        return $this->data($this->civic->expireOverdue($this->actor($r)));
    }

    public function __construct(ReferenceData $refs, private CivicService $civic)
    {
        parent::__construct($refs);
    }

    public function announcements(Request $r)
    {
        return $this->listing($this->civic->announcements($this->actor($r), $this->query($r, ['q', 'status'])));
    }

    public function announcement(Request $r, string $id)
    {
        return $this->data($this->civic->announcement($this->actor($r), $this->id($id)));
    }

    public function publish(Request $r)
    {
        return $this->data($this->civic->publish($this->actor($r), $this->body($r), $this->key($r)));
    }

    public function edit(Request $r, string $id)
    {
        return $this->data($this->civic->edit($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function archive(Request $r, string $id)
    {
        return $this->data($this->civic->archive($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function retract(Request $r, string $id)
    {
        return $this->data($this->civic->retract($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function feedback(Request $r)
    {
        return $this->listing($this->civic->feedback($this->actor($r), $this->query($r, ['q', 'type', 'status', 'rating', 'resident_id', 'sort', 'archive'])));
    }

    public function feedbackItem(Request $r, string $id)
    {
        return $this->data($this->civic->feedbackItem($this->actor($r), $this->id($id)));
    }

    public function submit(Request $r)
    {
        return $this->data($this->civic->submitFeedback($this->actor($r), $this->body($r), $this->key($r)));
    }

    public function assignFeedback(Request $r, string $id)
    {
        return $this->data($this->civic->assignFeedback($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function feedbackAssignmentOptions(Request $r, string $id)
    {
        return $this->data($this->civic->feedbackAssignmentOptions($this->actor($r), $this->id($id)));
    }

    public function resolveFeedback(Request $r, string $id)
    {
        return $this->data($this->civic->resolveFeedback($this->actor($r), $this->id($id), $this->body($r)));
    }

    public function reviewFeedback(Request $r, string $id)
    {
        return $this->data($this->civic->reviewFeedback($this->actor($r), $this->id($id), $this->body($r), $this->key($r)));
    }

    public function archiveFeedback(Request $r, string $id)
    {
        return $this->data($this->civic->archiveFeedback($this->actor($r), $this->id($id), $this->body($r), $this->key($r)));
    }
}
