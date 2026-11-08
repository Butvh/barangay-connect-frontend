<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\Civic\CivicService;
use App\Services\Incidents\IncidentService;
use App\Services\P2\Actor;
use App\Services\P2\Problem;
use App\Services\P2\Rules;
use App\Services\P2\UsesScopedReferences;

final class ReportService
{
    use UsesScopedReferences;
    use UsesScopedReferences;

    public function __construct(private Store $store, private ReferenceData $refs, private \Closure $clock, private IncidentService $incidents, private CivicService $civic) {}

    private function month(string $month): array
    {
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D', $month)) {
            throw new Problem('VALIDATION', 'Choose a valid month.');
        } $start = new \DateTimeImmutable($month.'-01T00:00:00', new \DateTimeZone('Asia/Manila'));

        return [$start, $start->modify('+1 month')];
    }

    private function during(?string $time, array $range): bool
    {
        $t = Rules::time($time);

        return $t !== null && $t >= $range[0] && $t < $range[1];
    }

    public function summary(Actor $a, string $month): array
    {
        $a->allow(['captain']);
        $range = $this->month($month);
        $alerts = array_filter($this->store->select('emergency_alerts', ['barangay_id' => $a->barangayId]), fn ($r) => $this->during($r['created_at'], $range));
        $times = [];
        foreach ($alerts as $r) {
            $start = Rules::time($r['created_at']);
            $logs = $this->store->select('alert_responses', ['barangay_id' => $a->barangayId, 'alert_id' => $r['id']]);
            $dates = array_filter(array_map(fn ($log) => Rules::time($log['responded_at']), $logs), fn ($date) => $date !== null && $start !== null && $date >= $start);
            if ($dates) {
                sort($dates);
                $times[] = ($dates[0]->getTimestamp() - $start->getTimestamp()) / 60;
            }
        }
        $responses = array_filter($this->store->select('alert_responses', ['barangay_id' => $a->barangayId]), fn ($r) => $r['response_status'] === 'Completed' && $this->during($r['responded_at'], $range));
        $rescues = array_filter($this->store->select('rescues', ['barangay_id' => $a->barangayId]), fn ($r) => $r['rescue_status'] === 'Completed' && $this->during($r['rescued_at'], $range));
        $verification = array_filter($this->references($a)->verifications($a->barangayId), fn ($v) => in_array($v['review_status'], ['Approved', 'Rejected'], true) && $this->during($v['reviewed_at'] ?? null, $range));

        return ['month' => $month, 'incidents' => count($alerts), 'average_response_minutes' => $times ? (float) (array_sum($times) / count($times)) : null, 'response_measure' => 'Report to first recorded response; unknown/negative samples excluded.', 'response_samples' => count($times), 'completed_response_logs' => count($responses), 'completed_rescue_logs' => count($rescues), 'completed_verifications' => count($verification), 'types' => array_count_values(array_column($alerts, 'alert_type'))];
    }

    public function activity(Actor $a, array $options = []): array
    {
        $a->allow(['captain']);
        $range = isset($options['month']) ? $this->month($options['month']) : null;
        $q = mb_strtolower($options['q'] ?? '');
        $rows = array_filter($this->store->select('activity_logs', ['barangay_id' => $a->barangayId]), fn ($r) => (! $range || $this->during($r['created_at'], $range)) && (! isset($options['actor_id']) || $r['actor_id'] === (int) $options['actor_id']) && (! isset($options['type']) || $r['resource_type'] === $options['type']) && (! $q || str_contains(mb_strtolower($r['action'].' '.$r['resource_id']), $q)));
        usort($rows, fn ($x, $y) => strcmp($y['created_at'], $x['created_at']));

        return array_map(fn ($row) => $this->activityProjection($a, $row), array_values($rows));
    }

    private function activityProjection(Actor $a, array $row): array
    {
        $details = $row['summary'] ?? [];
        $summary = is_string($details) ? $details : implode(' · ', array_map(fn ($value) => (string) $value, array_filter([$details['reason'] ?? null, $details['status'] ?? null], fn ($value) => is_scalar($value) && $value !== '')));
        if ($summary === '') {
            $summary = ucfirst($row['resource_type']).' #'.$row['resource_id'];
        }
        $href = match ($row['resource_type']) {
            'alert' => 'official-alert.html?id='.$row['resource_id'],
            'announcement' => 'official-announcements.html?id='.$row['resource_id'],
            'feedback' => 'official-feedback.html?type='.($this->store->select('community_feedback', ['id' => $row['resource_id'], 'barangay_id' => $a->barangayId])[0]['type'] ?? 'complaint').'&id='.$row['resource_id'],
            default => null
        };

        return array_replace($row, ['summary' => $summary, 'summary_data' => $details, 'at' => $row['created_at'], 'entity' => $row['resource_type'], 'record_id' => $row['resource_id'], 'title' => $row['action'], 'actor_name' => isset($row['actor_id']) ? ($this->references($a)->person($row['actor_id'], $a->barangayId)['full_name'] ?? null) : null, 'href' => $href]);
    }

    public function snapshot(Actor $a): array
    {
        $a->allow(['captain']);
        // P1 gateway must return its explicit report DTOs, never raw Eloquent attributes.
        $activity = $this->activity($a);

        return ['alerts' => $this->incidents->list($a), 'verifications' => $this->references($a)->verifications($a->barangayId), 'feedback' => $this->civic->feedback($a), 'announcements' => $this->civic->announcements($a), 'facilities' => $this->references($a)->facilities($a->barangayId), 'users' => array_map(Rules::publicPerson(...), $this->references($a)->people($a->barangayId)), 'personnel' => $this->references($a)->personnel($a->barangayId), 'activity_logs' => $activity, 'barangays' => [$this->references($a)->barangay($a->barangayId)], 'at' => ($this->clock)(), 'barangay_id' => $a->barangayId];
    }

    public function performance(Actor $a, string $month, string $role): array
    {
        $a->allow(['captain']);
        Rules::choice($role, ['secretary', 'responder', 'rescuer'], 'role');
        $range = $this->month($month);
        $activity = $this->activity($a, ['month' => $month]);
        $people = [];
        foreach ($this->references($a)->people($a->barangayId) as $p) {
            if ($p['role'] === $role) {
                $people[$p['id']] = Rules::publicPerson($p) + ['activities' => 0, 'completed_responses' => 0, 'completed_rescues' => 0];
            }
        }
        foreach ($activity as $log) {
            if ($log['actor_role'] === $role) {
                $id = $log['actor_id'];
                $p = $this->references($a)->person($id, $a->barangayId);
                if (! $p) {
                    continue;
                } $people[$id] ??= Rules::publicPerson($p) + ['activities' => 0, 'completed_responses' => 0, 'completed_rescues' => 0];
                $people[$id]['activities']++;
            }
        }
        foreach (['alert_responses' => ['response_status', 'responded_at', 'responder_id', 'completed_responses'], 'rescues' => ['rescue_status', 'rescued_at', 'rescuer_id', 'completed_rescues']] as $table => [$status,$time,$person,$metric]) {
            foreach ($this->store->select($table, ['barangay_id' => $a->barangayId]) as $r) {
                if ($role === ($table === 'alert_responses' ? 'responder' : 'rescuer') && $r[$status] === 'Completed' && $this->during($r[$time], $range)) {
                    $id = $r[$person];
                    $p = $this->references($a)->person($id, $a->barangayId);
                    if (! $p) {
                        continue;
                    } $people[$id] ??= Rules::publicPerson($p) + ['activities' => 0, 'completed_responses' => 0, 'completed_rescues' => 0];
                    $people[$id][$metric]++;
                }
            }
        }

        return ['month' => $month, 'role' => $role, 'personnel' => array_values($people), 'summary' => $this->summary($a, $month)];
    }

    public static function csvCell(mixed $value): string
    {
        $s = (string) $value;
        if (preg_match('/^[\s]*[=+@-]/u', $s)) {
            $s = "'".$s;
        }

        return '"'.str_replace('"', '""', $s).'"';
    }
}
