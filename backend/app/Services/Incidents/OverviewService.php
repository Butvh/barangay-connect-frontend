<?php

declare(strict_types=1);

namespace App\Services\Incidents;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\Civic\CivicService;
use App\Services\P2\Actor;
use App\Services\P2\Rules;

final class OverviewService
{
    public function __construct(private Store $store, private ReferenceData $refs, private IncidentService $incidents, private CivicService $civic, private \Closure $clock) {}

    public function dashboard(Actor $actor): array
    {
        $alerts = $this->incidents->list($actor);
        if ($actor->role === 'resident') {
            return ['alerts' => $alerts, 'nearby_alerts' => $this->incidents->nearby($actor), 'announcements' => array_slice($this->civic->announcements($actor), 0, 1)];
        }
        $day = Rules::time(($this->clock)())->setTimezone(new \DateTimeZone('Asia/Manila'))->format('Y-m-d');
        $today = fn ($at) => ($t = Rules::time($at)) && $t->setTimezone(new \DateTimeZone('Asia/Manila'))->format('Y-m-d') === $day;
        $active = array_filter($alerts, fn ($r) => $actor->administrator() ? $r['status'] !== 'Resolved' : $r['active_'.$actor->role.'_assignment']);
        $pending = null;
        $open = null;
        if ($actor->administrator()) {
            $latest = [];
            foreach ($this->refs->verifications($actor->barangayId) as $v) {
                $id = $v['user_id'];
                if (! isset($latest[$id]) || $v['id'] > $latest[$id]['id']) {
                    $latest[$id] = $v;
                }
            }
            $pending = count(array_filter($latest, fn ($v) => $v['review_status'] === 'Pending'));
            $open = count(array_filter($this->civic->feedback($actor), fn ($f) => $f['type'] !== 'general' && $f['status'] !== 'Resolved'));
        }

        return ['active_alerts' => count($active), 'pending_verifications' => $pending, 'open_feedback' => $open, 'resolved_today' => count(array_filter($alerts, fn ($r) => $today($r['resolved_at']))), 'assigned_today' => count(array_filter($this->store->select('alert_assignments', ['barangay_id' => $actor->barangayId, 'user_id' => $actor->id]), fn ($r) => $today($r['assigned_at']))), 'active_rescues' => count(array_filter($alerts, fn ($r) => $r['assigned_rescuer_id'] === $actor->id && $r['active_rescuer_assignment']))];
    }

    public function map(Actor $actor, array $options = []): array
    {
        return ['alerts' => $actor->role === 'resident' ? $this->incidents->nearby($actor, $options) : $this->incidents->list($actor, $options), 'facilities' => $this->refs->facilities($actor->barangayId), 'household' => $actor->role === 'resident' ? $this->refs->household($actor->id, $actor->barangayId) : null, 'barangay' => $this->refs->barangay($actor->barangayId)];
    }
}
