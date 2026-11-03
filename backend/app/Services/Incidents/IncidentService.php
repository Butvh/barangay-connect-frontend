<?php

declare(strict_types=1);

namespace App\Services\Incidents;

use App\Contracts\P2\ActorReferences;
use App\Contracts\P2\DestinationReferences;
use App\Contracts\P2\EligibilityReferences;
use App\Services\P2\Actor;
use App\Services\P2\Module;
use App\Services\P2\Problem;
use App\Services\P2\Rules;

final class IncidentService extends Module
{
    public const STAGES = ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'];

    public const TYPES = ['Fire', 'Flood', 'Typhoon/Storm', 'Landslide', 'Earthquake', 'Other'];

    // Disabled until the team explicitly ratifies the documented emergency exception.
    public bool $capacityOverrideEnabled = false;

    public function list(Actor $actor, array $options = []): array
    {
        $where = ['barangay_id' => $actor->barangayId];
        if ($actor->role === 'resident') {
            $where['resident_id'] = $actor->id;
        }
        if (isset($options['resident_id'])) {
            $where['resident_id'] = (int) $options['resident_id'];
        }
        $rows = array_map(fn ($r) => $this->assignmentProjection($r), $this->store->select('emergency_alerts', $where));
        if ($actor->role === 'resident' && isset($options['resident_id']) && (int) $options['resident_id'] !== $actor->id) {
            throw new Problem('FORBIDDEN', 'View your own incidents.');
        }
        $q = mb_strtolower(trim((string) ($options['q'] ?? '')));
        $rows = array_filter($rows, fn ($r) => $this->readable($actor, $r) && (! isset($options['status']) || $options['status'] === $r['status']) && (! isset($options['alert_type']) || $options['alert_type'] === $r['alert_type']) && (! $q || str_contains(mb_strtolower('A-'.$r['id'].' '.$r['alert_type'].' '.$r['location_label']), $q)));
        usort($rows, fn ($a, $b) => strcmp($b['created_at'], $a['created_at']) ?: $b['id'] <=> $a['id']);
        if (($options['sort'] ?? 'newest') === 'oldest') {
            $rows = array_reverse($rows);
        }

        return array_map(fn ($r) => $this->project($actor, $r), array_values($rows));
    }

    private function readable(Actor $a, array $r): bool
    {
        return $r['barangay_id'] === $a->barangayId && ($a->administrator() || ($a->role === 'resident' ? $r['resident_id'] === $a->id : ($r['assigned_'.$a->role.'_id'] ?? null) === $a->id));
    }

    protected function row(string $table, int $id, Actor $actor): array
    {
        $row = parent::row($table, $id, $actor);

        return $table === 'emergency_alerts' ? $this->assignmentProjection($row) : $row;
    }

    /** Derived only from retained assignment rows; never written to emergency_alerts. */
    private function assignmentProjection(array $row): array
    {
        foreach (['responder', 'rescuer'] as $role) {
            $rows = $this->assignments($row, $role);
            usort($rows, fn ($a, $b) => $a['id'] <=> $b['id']);
            $last = $rows ? end($rows) : null;
            $row['assigned_'.$role.'_id'] = $last && in_array($last['status'], ['active', 'completed', 'closed'], true) ? $last['user_id'] : null;
        }

        return $row;
    }

    public function get(Actor $a, int $id): array
    {
        $r = $this->row('emergency_alerts', $id, $a);
        if (! $this->readable($a, $r)) {
            throw new Problem('NOT_FOUND', 'This incident is unavailable.');
        }

        return $this->project($a, $r);
    }

    public function nearby(Actor $a, array $options = []): array
    {
        $a->allow(['resident']);
        $name = $this->references($a)->barangay($a->barangayId)['name'];
        $rows = $this->store->select('emergency_alerts', ['barangay_id' => $a->barangayId]);

        $result = array_values(array_map(fn ($r) => ['id' => $r['id'], 'barangay_id' => $a->barangayId, 'alert_type' => $r['alert_type'], 'status' => $r['status'], 'created_at' => $r['created_at'], 'location_label' => $name, 'description' => $r['alert_type'].' incident reported in '.$name.'.', 'map_x' => $r['map_x'] === null ? null : (int) (round($r['map_x'] / 10) * 10), 'map_y' => $r['map_y'] === null ? null : (int) (round($r['map_y'] / 10) * 10)], array_filter($rows, fn ($r) => (! isset($options['status']) || $r['status'] === $options['status']) && (! isset($options['alert_type']) || $r['alert_type'] === $options['alert_type']))));
        $q = mb_strtolower(trim((string) ($options['q'] ?? '')));
        $result = array_values(array_filter($result, fn ($r) => ! $q || str_contains(mb_strtolower('A-'.$r['id'].' '.$r['alert_type'].' '.$r['location_label']), $q)));
        usort($result, fn ($x, $y) => strcmp($y['created_at'], $x['created_at']) ?: $y['id'] <=> $x['id']);

        return ($options['sort'] ?? 'newest') === 'oldest' ? array_reverse($result) : $result;
    }

    private function detailsInput(array $in, array $home, bool $partial = false): array
    {
        Rules::only($in, ['alert_type', 'description', 'location_label', 'victim_count', 'map_x', 'map_y']);
        $out = [];
        if (! $partial || isset($in['alert_type'])) {
            $out['alert_type'] = Rules::choice($in['alert_type'] ?? 'Other', self::TYPES, 'alert_type');
        }
        foreach (['description' => 2000, 'location_label' => 200] as $f => $max) {
            if (! $partial || array_key_exists($f, $in)) {
                $out[$f] = Rules::text($in[$f] ?? ($f === 'location_label' ? $home['address'] : ''), $f, $max, $f === 'location_label');
            }
        }
        if (! $partial || array_key_exists('victim_count', $in)) {
            $v = $in['victim_count'] ?? null;
            if ($v !== null && (! is_int($v) || $v < 0 || $v > 9999)) {
                throw new Problem('VALIDATION', 'Use a whole victim count or Not sure.');
            } $out['victim_count'] = $v;
        }
        if (array_key_exists('map_x', $in) !== array_key_exists('map_y', $in)) {
            throw new Problem('VALIDATION', 'Supply both map coordinates.');
        }
        foreach (['map_x', 'map_y'] as $f) {
            if (! $partial || array_key_exists($f, $in)) {
                $v = $in[$f] ?? ($home[$f] ?? null);
                if ($v !== null && (! is_numeric($v) || $v < 0 || $v > 100)) {
                    throw new Problem('VALIDATION', 'Choose a pin inside the illustrated map.');
                } $out[$f] = $v === null ? null : (float) $v;
            }
        }
        if (array_key_exists('map_x', $out) && (($out['map_x'] === null) !== ($out['map_y'] === null))) {
            throw new Problem('VALIDATION', 'Pin coordinates must both be set or both unknown.');
        }

        return $out;
    }

    public function create(Actor $a, array $in, string $key): array
    {
        $a->allow(['resident']);
        Rules::key($key);
        ksort($in);
        $hash = hash('sha256', json_encode($in, JSON_THROW_ON_ERROR));

        return $this->store->transaction(['person:'.$a->id, 'sos:'.$a->id], fn () => $this->atomic($a, [], null, function () use ($a, $key, $hash, $in) {
            if (! $this->references($a)->approved($a->id, $a->barangayId)) {
                throw new Problem('FORBIDDEN', 'Approved residency is required before SOS.');
            }
            $previous = $this->store->select('idempotency_requests', ['actor_id' => $a->id, 'route' => 'alerts.create', 'request_key' => $key]);
            if ($previous) {
                if ($previous[0]['request_hash'] !== $hash) {
                    throw new Problem('CONFLICT', 'Request key was used with different details.');
                }

                return $this->get($a, $previous[0]['resource_id']) + ['was_created' => false];
            }
            $refs = $this->references($a);
            $home = ($refs instanceof EligibilityReferences ? $refs->sosHousehold($a->id, $a->barangayId) : $refs->household($a->id, $a->barangayId)) ?? throw new Problem('FORBIDDEN', 'A registered household is required.');
            $details = $this->detailsInput($in, $home);
            $active = array_values(array_filter($this->store->select('emergency_alerts', ['barangay_id' => $a->barangayId, 'resident_id' => $a->id]), fn ($r) => $r['status'] !== 'Resolved'));
            $r = $active[0] ?? null;
            if (! $r) {
                $at = ($this->clock)();
                $r = $this->store->insert('emergency_alerts', array_merge($details, ['resident_id' => $a->id, 'household_id' => $home['id'], 'barangay_id' => $a->barangayId, 'status' => 'Pending', 'assignment_revision' => 0, 'acknowledged_by' => null, 'created_at' => $at, 'reported_at' => $at, 'address_snapshot' => $home['address'], 'acknowledged_at' => null, 'resolved_at' => null]));
                $this->history($a, $r, 'Pending', $at);
                $this->audit($a, 'alert', $r['id'], 'Incident reported');
                $this->event($a, 'incident.created', $r['id'], $this->officials($a));
            }
            $this->store->insert('idempotency_requests', ['actor_id' => $a->id, 'route' => 'alerts.create', 'request_key' => $key, 'request_hash' => $hash, 'resource_id' => $r['id']]);

            return $this->project($a, $r) + ['was_created' => ! $active];
        }));
    }

    public function details(Actor $a, int $id, array $in, ?string $key = null): array
    {
        return $key === null ? $this->detailsWrite($a, $id, $in)
            : $this->once($a, 'alerts.'.$id.'.details', $in, $key, fn () => $this->detailsWrite($a, $id, $in), fn ($resource) => $this->get($a, $resource));
    }

    private function detailsWrite(Actor $a, int $id, array $in): array
    {
        $a->allow(['resident']);

        return $this->atomic($a, [], $id, function () use ($a, $id, $in) {
            $r = $this->row('emergency_alerts', $id, $a);
            if ($r['resident_id'] !== $a->id) {
                throw new Problem('NOT_FOUND', 'This incident is unavailable.');
            }
            if (array_key_exists('expected_revision', $in)) {
                Rules::revision($r, $in, 'assignment_revision');
                unset($in['expected_revision']);
            }
            if ($r['status'] === 'Resolved') {
                throw new Problem('INVALID_STATE', 'This incident is resolved.');
            } $patch = $this->detailsInput($in, $this->references($a)->household($a->id, $a->barangayId) ?? [], true);
            $changed = array_filter($patch, fn ($value, $field) => $value !== $r[$field], ARRAY_FILTER_USE_BOTH);
            if (! $changed) {
                return $this->project($a, $r);
            }
            $r = $this->store->update('emergency_alerts', $id, $changed + ['assignment_revision' => $r['assignment_revision'] + 1]);
            $this->audit($a, 'alert', $id, 'Incident details updated');

            return $this->project($a, $r);
        });
    }

    private function assignments(array $r, ?string $role = null, bool $active = false): array
    {
        return array_values(array_filter($this->store->select('alert_assignments', ['alert_id' => $r['id'], 'barangay_id' => $r['barangay_id']]), fn ($x) => (! $role || $x['role'] === $role) && (! $active || $x['status'] === 'active')));
    }

    private function latestResponse(array $r): ?array
    {
        $assignments = array_values(array_filter($this->assignments($r, 'responder'), fn ($x) => $x['user_id'] === $r['assigned_responder_id']));
        $current = $assignments ? end($assignments) : null;
        if (! $current) {
            return null;
        }
        $rows = $this->store->select('alert_responses', ['alert_id' => $r['id'], 'barangay_id' => $r['barangay_id'], 'assignment_id' => $current['id'], 'responder_id' => $current['user_id']]);

        return $rows ? end($rows) : null;
    }

    public function assignmentOptions(Actor $a, int $id, string $role): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::choice($role, ['responder', 'rescuer'], 'role');
        $r = $this->row('emergency_alerts', $id, $a);
        $limit = $role === 'responder' ? 2 : 1;
        $people = [];
        $current = $this->assignments($r, $role, true)[0] ?? null;
        foreach ($this->references($a)->people($a->barangayId) as $p) {
            if ($p['role'] === $role && ($p['personnel_status'] ?? 'Active') === 'Active') {
                $work = count($this->store->select('alert_assignments', ['user_id' => $p['id'], 'role' => $role, 'status' => 'active']));
                $people[] = Rules::publicPerson($p) + ['workload' => $work, 'limit' => $limit, 'at_capacity' => $work >= $limit, 'assigned' => ($current['user_id'] ?? null) === $p['id'], 'available' => $work < $limit && ($current['user_id'] ?? null) !== $p['id']];
            }
        }
        $projection = $this->project($a, $r);

        return ['alert_id' => $id, 'role' => $role, 'limit' => $limit, 'personnel' => $people, 'alert_revision' => $r['assignment_revision'], 'current_assignment' => $current] + array_intersect_key($projection, array_flip(['active_responder_assignment', 'active_rescuer_assignment', 'can_assign_responder', 'can_assign_rescuer']));
    }

    public function assign(Actor $a, int $id, array $in, bool $acknowledge = false): array
    {
        $a->allow(['secretary', 'captain']);
        Rules::only($in, ['role', 'personnel_id', 'responder_id', 'expected_revision', 'override']);
        $role = Rules::choice($in['role'] ?? ($acknowledge ? 'responder' : null), ['responder', 'rescuer'], 'role');
        $person = Rules::id($in['personnel_id'] ?? $in['responder_id'] ?? null, 'personnel_id');

        return $this->atomic($a, [$person], $id, function () use ($a, $id, $in, $role, $person, $acknowledge) {
            $r = $this->row('emergency_alerts', $id, $a);
            Rules::revision($r, $in, 'assignment_revision');
            if ($r['status'] === 'Resolved' || ($acknowledge && ($r['status'] !== 'Pending' || $role !== 'responder')) || (! $acknowledge && $r['status'] === 'Pending')) {
                throw new Problem('INVALID_STATE', 'Acknowledge with a selected responder first.');
            }
            if ($this->assignments($r, $role, true)) {
                throw new Problem('INVALID_STATE', 'An active assignment already exists.');
            }
            if ($role === 'responder' && $r['assigned_responder_id'] !== null) {
                throw new Problem('INVALID_STATE', 'A responder was already assigned.');
            }
            if ($role === 'rescuer' && (! in_array($r['status'], ['Responding', 'Rescue in progress'], true) || ($this->latestResponse($r)['rescue_required'] ?? null) !== true || array_filter($this->assignments($r, $role), fn ($x) => in_array($x['status'], ['completed', 'closed'], true)))) {
                throw new Problem('INVALID_STATE', 'Record rescue-needed assessment first.');
            }
            $assignment = $this->addAssignment($a, $r, $role, $person, $in);
            $patch = ['assignment_revision' => $r['assignment_revision'] + 1];
            if ($acknowledge) {
                $patch += ['status' => 'Acknowledged', 'acknowledged_at' => ($this->clock)(), 'acknowledged_by' => $a->id];
            }
            $r = $this->store->update('emergency_alerts', $id, $patch);
            if ($acknowledge) {
                $this->history($a, $r, 'Acknowledged');
            }
            $this->audit($a, 'alert', $id, ucfirst($role).' assigned', ['assignment_id' => $assignment['id'], 'user_id' => $person, 'reason' => $assignment['override_reason']]);
            $this->event($a, 'incident.assigned', $id, [$this->references($a)->person($person, $a->barangayId), $this->references($a)->person($r['resident_id'], $a->barangayId), ...$this->officials($a)]);

            return $this->project($a, $r);
        });
    }

    private function addAssignment(Actor $a, array $r, string $role, int $person, array $in): array
    {
        $p = $this->eligiblePerson($a, $person);
        if (! $p || $p['role'] !== $role || ($p['personnel_status'] ?? 'Active') !== 'Active') {
            throw new Problem('VALIDATION', 'Choose active eligible local personnel.');
        }
        $limit = $role === 'responder' ? 2 : 1;
        $work = count($this->store->select('alert_assignments', ['user_id' => $person, 'role' => $role, 'status' => 'active']));
        $reason = null;
        if (isset($in['override'])) {
            if ($a->role !== 'captain' || ! $this->capacityOverrideEnabled) {
                throw new Problem('FORBIDDEN', 'Emergency capacity override is not enabled for this account.');
            } if (($in['override']['confirmed'] ?? null) !== true || $work < $limit) {
                throw new Problem('VALIDATION', 'Explicit confirmation is required at capacity.');
            } $reason = Rules::text($in['override']['reason'] ?? null, 'override_reason');
        } elseif ($work >= $limit) {
            throw new Problem('CAPACITY', 'This person is at assignment capacity.');
        }

        return $this->store->insert('alert_assignments', ['alert_id' => $r['id'], 'barangay_id' => $a->barangayId, 'role' => $role, 'user_id' => $person, 'personnel_name' => $p['full_name'], 'assigned_by' => $a->id, 'assigned_by_name' => $this->references($a)->person($a->id, $a->barangayId)['full_name'], 'assigned_at' => ($this->clock)(), 'status' => 'active', 'ended_at' => null, 'ended_by' => null, 'end_reason' => null, 'override_by' => $reason ? $a->id : null, 'override_reason' => $reason, 'override_at' => $reason ? ($this->clock)() : null]);
    }

    public function changeAssignment(Actor $a, int $assignmentId, array $in, bool $transfer): array
    {
        $a->allow(['captain']);
        Rules::only($in, ['expected_revision', 'reason', 'personnel_id', 'override']);
        $reason = Rules::text($in['reason'] ?? null, 'reason');
        $old = $this->row('alert_assignments', $assignmentId, $a);
        $next = $transfer ? Rules::id($in['personnel_id'] ?? null, 'personnel_id') : null;

        return $this->atomic($a, [$old['user_id'], ...($next ? [$next] : [])], $old['alert_id'], function () use ($a, $old, $in, $reason, $transfer, $next) {
            $r = $this->row('emergency_alerts', $old['alert_id'], $a);
            Rules::revision($r, $in, 'assignment_revision');
            $current = $this->row('alert_assignments', $old['id'], $a);
            if ($current['status'] !== 'active' || $r['status'] === 'Resolved' || $next === $current['user_id']) {
                throw new Problem('INVALID_STATE', 'This assignment cannot be changed.');
            }
            $this->end($a, $current, $transfer ? 'reassigned' : 'cancelled', $reason);
            if ($transfer) {
                $this->addAssignment($a, $r, $old['role'], $next, $in);
            }
            $r = $this->store->update('emergency_alerts', $r['id'], ['assignment_revision' => $r['assignment_revision'] + 1]);
            $this->audit($a, 'alert', $r['id'], $transfer ? 'Assignment transferred' : 'Assignment cancelled', ['previous_user_id' => $old['user_id'], 'user_id' => $next, 'reason' => $reason]);
            $this->event($a, 'incident.assigned', $r['id'], [$this->references($a)->person($old['user_id'], $a->barangayId), $next ? $this->references($a)->person($next, $a->barangayId) : null, ...$this->officials($a)]);

            return $this->project($a, $r);
        });
    }

    private function end(Actor $a, array $assignment, string $status, ?string $reason = null): void
    {
        $this->store->update('alert_assignments', $assignment['id'], ['status' => $status, 'ended_at' => ($this->clock)(), 'ended_by' => $a->id, 'end_reason' => $reason]);
    }

    public function response(Actor $a, int $id, array $in, string $key): array
    {
        return $this->once($a, 'alerts.'.$id.'.response', $in, $key, fn () => $this->responseWrite($a, $id, $in), fn ($resource) => $this->get($a, $resource));
    }

    private function responseWrite(Actor $a, int $id, array $in): array
    {
        $a->allow(['responder']);
        Rules::only($in, ['response_type', 'response_status', 'rescue_required', 'notes', 'expected_revision']);
        $type = Rules::choice($in['response_type'] ?? null, ['First aid', 'Assessment', 'Evacuation assistance', 'Other'], 'response_type');
        $status = Rules::choice($in['response_status'] ?? null, ['Responding', 'Completed'], 'response_status');
        if (! is_bool($in['rescue_required'] ?? null)) {
            throw new Problem('VALIDATION', 'Record whether rescue is required.');
        } $notes = Rules::text($in['notes'] ?? '', 'notes', 2000, false);

        return $this->atomic($a, [], $id, function () use ($a, $id, $in, $type, $status, $notes) {
            $r = $this->row('emergency_alerts', $id, $a);
            $assignment = $this->activeOwn($a, $r, 'responder');
            if (array_key_exists('expected_revision', $in)) {
                Rules::revision($r, $in, 'assignment_revision');
            }
            if (! in_array($r['status'], ['Acknowledged', 'Responding', 'Rescue in progress'], true)) {
                throw new Problem('INVALID_STATE', 'Response is unavailable at this stage.');
            }
            if ($in['rescue_required'] === false && $this->assignments($r, 'rescuer', true)) {
                throw new Problem('INVALID_STATE', 'Complete or cancel the active rescue before declaring rescue unnecessary.');
            }
            $this->store->insert('alert_responses', ['alert_id' => $id, 'barangay_id' => $a->barangayId, 'assignment_id' => $assignment['id'], 'responder_id' => $a->id, 'response_type' => $type, 'response_status' => $status, 'rescue_required' => $in['rescue_required'], 'notes' => $notes, 'responded_at' => ($this->clock)()]);
            if ($status === 'Completed') {
                $this->end($a, $assignment, 'completed');
            }
            $r = $this->advance($a, $r, $r['status'] === 'Rescue in progress' ? $r['status'] : 'Responding');
            $this->event($a, $in['rescue_required'] ? 'incident.rescue_required' : 'incident.status_changed', $id, [$this->references($a)->person($r['resident_id'], $a->barangayId), ...$this->officials($a)]);

            return $this->project($a, $r);
        });
    }

    public function rescue(Actor $a, int $id, array $in, string $key): array
    {
        return $this->once($a, 'alerts.'.$id.'.rescue', $in, $key, fn () => $this->rescueWrite($a, $id, $in), fn ($resource) => $this->get($a, $resource));
    }

    private function rescueWrite(Actor $a, int $id, array $in): array
    {
        $a->allow(['rescuer']);
        Rules::only($in, ['rescue_status', 'facility_id', 'notes', 'expected_revision']);
        $status = Rules::choice($in['rescue_status'] ?? null, ['In progress', 'Completed'], 'rescue_status');
        $facility = Rules::id($in['facility_id'] ?? null, 'facility_id');
        $notes = Rules::text($in['notes'] ?? '', 'notes', 2000, false);

        // Store must lock destination after person/incident guards, sharing this key with facility mutation.
        return $this->store->transaction(['person:'.$a->id, 'incident:'.$id, 'facility:'.$facility], function () use ($a, $id, $status, $facility, $notes, $in) {
            $fresh = $this->refs instanceof ActorReferences ? $this->refs->locked($a) : $this->refs->actorFor($a->id);
            if ($fresh->role !== $a->role || $fresh->barangayId !== $a->barangayId) {
                throw new Problem('FORBIDDEN', 'Account access changed.');
            }
            $r = $this->row('emergency_alerts', $id, $a);
            $assignment = $this->activeOwn($a, $r, 'rescuer');
            if (array_key_exists('expected_revision', $in)) {
                Rules::revision($r, $in, 'assignment_revision');
            }
            if (! in_array($r['status'], ['Responding', 'Rescue in progress'], true)) {
                throw new Problem('INVALID_STATE', 'Rescue is unavailable at this stage.');
            }
            $f = $this->refs instanceof DestinationReferences
                ? $this->references($a)->destination($facility, $a->barangayId)
                : (array_values(array_filter($this->references($a)->facilities($a->barangayId), fn ($f) => $f['id'] === $facility))[0] ?? null);
            if (! $f || $f['is_active'] !== true) {
                throw new Problem('VALIDATION', 'Choose an active visible destination.');
            }
            $snapshot = array_intersect_key($f, array_flip(['id', 'name', 'type', 'address', 'capacity', 'contact_number', 'map_x', 'map_y']));
            $this->store->insert('rescues', ['alert_id' => $id, 'barangay_id' => $a->barangayId, 'assignment_id' => $assignment['id'], 'rescuer_id' => $a->id, 'facility_id' => $facility, 'facility_snapshot' => $snapshot, 'rescue_status' => $status, 'notes' => $notes, 'rescued_at' => ($this->clock)()]);
            if ($status === 'Completed') {
                $this->end($a, $assignment, 'completed');
            } $r = $this->advance($a, $r, 'Rescue in progress');
            $this->event($a, 'incident.status_changed', $id, [$this->references($a)->person($r['resident_id'], $a->barangayId), ...$this->officials($a)]);

            return $this->project($a, $r);
        });
    }

    private function activeOwn(Actor $a, array $r, string $role): array
    {
        foreach ($this->assignments($r, $role, true) as $x) {
            if ($x['user_id'] === $a->id) {
                return $x;
            }
        } throw new Problem('FORBIDDEN', 'Only currently assigned personnel may log this work.');
    }

    public function resolve(Actor $a, int $id, array $in): array
    {
        $a->allow(['captain', 'secretary']);
        Rules::only($in, ['expected_revision']);
        $before = $this->row('emergency_alerts', $id, $a);
        $people = array_column($this->assignments($before, null, true), 'user_id');

        return $this->atomic($a, $people, $id, function () use ($a, $id, $in) {
            $r = $this->row('emergency_alerts', $id, $a);
            Rules::revision($r, $in, 'assignment_revision');
            $response = $this->latestResponse($r);
            $noRescue = $r['status'] === 'Responding' && ($response['response_status'] ?? null) === 'Completed' && ($response['rescue_required'] ?? null) === false && ! $this->assignments($r, 'rescuer', true);
            if (! $noRescue && $r['status'] !== 'Rescue in progress') {
                throw new Problem('INVALID_STATE', 'Complete the required workflow before resolution.');
            }
            foreach ($this->assignments($r, null, true) as $x) {
                $this->end($a, $x, 'closed');
            } $r = $this->advance($a, $r, 'Resolved');
            $this->event($a, 'incident.status_changed', $id, [$this->references($a)->person($r['resident_id'], $a->barangayId), ...$this->officials($a)]);

            return $this->project($a, $r);
        });
    }

    private function advance(Actor $a, array $r, string $status): array
    {
        $r = $this->store->update('emergency_alerts', $r['id'], ['status' => $status, 'assignment_revision' => $r['assignment_revision'] + 1] + ($status === 'Resolved' ? ['resolved_at' => ($this->clock)(), 'resolved_by' => $a->id] : []));
        $this->history($a, $r, $status);
        $this->audit($a, 'alert', $r['id'], 'Incident '.$status, ['status' => $status]);

        return $r;
    }

    private function history(Actor $a, array $r, string $status, ?string $at = null): void
    {
        $this->store->insert('incident_status_history', ['alert_id' => $r['id'], 'barangay_id' => $a->barangayId, 'status' => $status, 'actor_id' => $a->id, 'actor_role' => $a->role, 'occurred_at' => $at ?? ($this->clock)()]);
    }

    private function project(Actor $a, array $r): array
    {
        $r = $this->assignmentProjection($r);
        $assignments = $this->assignments($r);
        $assignments = array_map(fn ($x) => $x + ['assigned_by_name' => isset($x['assigned_by']) ? ($this->references($a)->person($x['assigned_by'], $r['barangay_id'])['full_name'] ?? null) : null], $assignments);
        $responses = $this->store->select('alert_responses', ['alert_id' => $r['id'], 'barangay_id' => $r['barangay_id']]);
        $rescues = $this->store->select('rescues', ['alert_id' => $r['id'], 'barangay_id' => $r['barangay_id']]);
        $history = $this->store->select('incident_status_history', ['alert_id' => $r['id'], 'barangay_id' => $r['barangay_id']]);
        $r['resident'] = Rules::publicPerson($this->references($a)->person($r['resident_id'], $r['barangay_id']));
        $r['household'] = $this->references($a)->household($r['resident_id'], $r['barangay_id']);
        foreach (['responder', 'rescuer'] as $role) {
            $r['assigned_'.$role] = isset($r['assigned_'.$role.'_id']) ? Rules::publicPerson($this->references($a)->person($r['assigned_'.$role.'_id'], $r['barangay_id'])) : null;
            $xs = array_values(array_filter($assignments, fn ($x) => $x['role'] === $role));
            $last = $xs ? end($xs) : null;
            $r['active_'.$role.'_assignment'] = (bool) array_filter($xs, fn ($x) => $x['status'] === 'active');
            $r[$role.'_assignment_status'] = $last['status'] ?? null;
            $r[$role.'_assigned_at'] = $last['assigned_at'] ?? null;
            $r[$role.'_assigned_by_name'] = $last['assigned_by_name'] ?? null;
        }
        $last = $this->latestResponse($r);
        $r['rescue_required'] = $last['rescue_required'] ?? null;
        $r['response_completed'] = ($r['responder_assignment_status'] ?? null) === 'completed';
        $r['can_assign_responder'] = $r['status'] !== 'Pending' && $r['status'] !== 'Resolved' && $r['assigned_responder_id'] === null;
        $r['can_assign_rescuer'] = in_array($r['status'], ['Responding', 'Rescue in progress'], true) && $r['rescue_required'] === true && ! $r['active_rescuer_assignment'] && ! in_array($r['rescuer_assignment_status'], ['completed', 'closed'], true);
        $r['responses'] = array_map(fn ($x) => $x + ['responder' => Rules::publicPerson($this->references($a)->person($x['responder_id'], $r['barangay_id']))], $responses);
        $r['rescues'] = array_map(fn ($x) => $x + ['rescuer' => Rules::publicPerson($this->references($a)->person($x['rescuer_id'], $r['barangay_id'])), 'facility' => $x['facility_snapshot']], $rescues);
        $r['timeline'] = array_map(function ($stage) use ($r, $history) {
            $match = array_values(array_filter($history, fn ($h) => $h['status'] === $stage));

            return ['status' => $stage, 'at' => $match[0]['occurred_at'] ?? null, 'current' => $r['status'] === $stage];
        }, self::STAGES);
        if ($a->administrator()) {
            $r['assignments'] = $assignments;
        }

        return $r;
    }
}
