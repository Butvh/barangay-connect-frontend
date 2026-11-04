<?php

namespace App\Services\Facilities;

use App\Services\Administration\AdministrativeContext;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use Carbon\CarbonImmutable;

final class FacilityAdministration
{
    private const ROLES = ['captain', 'secretary', 'responder', 'rescuer', 'resident'];

    public function __construct(private AdministrativeContext $context) {}

    private function visible(EffectiveIdentity $actor)
    {
        return $this->context->db()->table('facilities')->where(fn ($q) => $q->where('managed_by_barangay_id', $actor->barangayId)->orWhere('visibility', 'shared'))
            ->when($actor->role === 'resident', fn ($q) => $q->where('active', true));
    }

    private function snapshot(object $row): array
    {
        return ['id' => (int) $row->id, 'name' => $row->name, 'type' => $row->type === 'Hospital' ? 'Hospital' : 'EvacuationCenter',
            'address' => $row->address, 'capacity' => $row->capacity === null ? null : (int) $row->capacity,
            'contact' => $row->contact ?? '', 'notes' => $row->notes ?? '', 'barangay_id' => $row->visibility === 'shared' ? null : (int) $row->managed_by_barangay_id,
            'status' => $row->active ? 'Active' : 'Inactive', 'map_x' => $row->map_x === null ? null : (float) $row->map_x,
            'map_y' => $row->map_y === null ? null : (float) $row->map_y];
    }

    private function project(object $row, EffectiveIdentity $actor): array
    {
        $manage = in_array($actor->role, ['captain', 'secretary'], true) && (int) $row->managed_by_barangay_id === $actor->barangayId;
        $result = $this->snapshot($row) + ['revision' => (int) $row->revision, 'can_manage' => $manage, 'map_scope' => $row->map_scope];
        if ($manage) {
            $history = $this->context->db()->table('activity_logs')->where('barangay_id', $actor->barangayId)
                ->where('resource_type', 'facility')->where('resource_id', $row->id)->orderBy('id')->get()
                ->map(fn ($h) => ['action' => $h->action, 'by' => $h->actor_id, 'by_name' => $h->actor_name,
                    'at' => $h->occurred_at ? CarbonImmutable::parse($h->occurred_at, 'UTC')->toISOString() : null])->all();
            $result += ['managed_by_barangay_id' => (int) $row->managed_by_barangay_id, 'created_at' => $row->created_at,
                'updated_at' => $row->updated_at, 'created_by' => $row->created_by, 'updated_by' => $row->updated_by, 'history' => $history];
        }

        return $result;
    }

    public function list(EffectiveIdentity $actor, array $options = []): array
    {
        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $options): array {
            $query = $this->visible($actor);
            if (($options['active_only'] ?? false) === true) {
                $query->where('active', true);
            }
            if (isset($options['type'])) {
                $query->where('type', $options['type'] === 'EvacuationCenter' ? 'Evacuation Center' : $options['type']);
            }

            return $query->orderBy('id')->get()->map(fn ($row) => $this->project($row, $actor))->all();
        });
    }

    public function get(EffectiveIdentity $actor, int $id): array
    {
        return $this->context->transaction($actor, self::ROLES, [], function () use ($actor, $id): array {
            $row = $this->visible($actor)->where('id', $id)->first() ?? throw new ApiProblem('NOT_FOUND', 404, 'Facility not found.');

            return $this->project($row, $actor);
        });
    }

    private function data(array $input, ?object $old, EffectiveIdentity $actor): array
    {
        $prior = $old ? $this->snapshot($old) : [];
        $next = array_replace($prior, $input);
        if (($next['type'] ?? null) === 'Evacuation Center') {
            $next['type'] = 'EvacuationCenter';
        }
        foreach (['capacity', 'map_x', 'map_y'] as $field) {
            if (($next[$field] ?? null) === '') {
                $next[$field] = null;
            }
        }
        $fields = $this->context->validate(array_intersect_key($next, array_flip(['name', 'type', 'address', 'capacity', 'contact', 'status', 'notes', 'map_x', 'map_y'])), [
            'name' => 'required|string|max:160', 'type' => 'required|in:EvacuationCenter,Hospital', 'address' => 'required|string|max:300',
            'capacity' => 'nullable|integer|min:1|max:999999', 'contact' => 'nullable|string|max:50', 'status' => 'sometimes|in:Active,Inactive',
            'notes' => 'nullable|string|max:300', 'map_x' => 'nullable|numeric|between:0,100', 'map_y' => 'nullable|numeric|between:0,100']);
        if ($fields['type'] === 'EvacuationCenter' && empty($fields['capacity'])) {
            throw new ApiProblem('VALIDATION', 422, 'Evacuation center capacity is required.', ['capacity' => 'Enter a valid capacity.']);
        }
        if (array_key_exists('map_x', $input) !== array_key_exists('map_y', $input) || (($fields['map_x'] ?? null) === null) !== (($fields['map_y'] ?? null) === null)) {
            throw new ApiProblem('VALIDATION', 422, 'Choose a complete map location.');
        }
        $scope = $this->context->db()->table('barangays')->where('id', $actor->barangayId)->value('map_scope');
        if (($fields['map_x'] ?? null) !== null && ! $scope) {
            throw new ApiProblem('VALIDATION', 422, 'Map coverage is not available for this barangay.');
        }

        return ['name' => trim($fields['name']), 'type' => $fields['type'] === 'Hospital' ? 'Hospital' : 'Evacuation Center',
            'address' => trim($fields['address']), 'capacity' => ($fields['capacity'] ?? null) === null ? null : (int) $fields['capacity'],
            'contact' => $fields['contact'] ?? null, 'notes' => $fields['notes'] ?? null, 'active' => ($fields['status'] ?? 'Active') === 'Active',
            'map_x' => $fields['map_x'] ?? null, 'map_y' => $fields['map_y'] ?? null,
            'map_scope' => ($fields['map_x'] ?? null) === null ? null : $scope];
    }

    public function save(EffectiveIdentity $actor, ?int $id, array $input): array
    {
        if ($id !== null && $id < 1) {
            throw new ApiProblem('NOT_FOUND', 404, 'Facility not found.');
        }
        $allowed = ['name', 'type', 'address', 'capacity', 'contact', 'status', 'notes', 'map_x', 'map_y', ...($id ? ['expected_revision'] : [])];
        if (array_diff(array_keys($input), $allowed)) {
            throw new ApiProblem('VALIDATION', 422, 'Only facility information can be changed.');
        }
        // Only legacy null snapshots need backfill. New P2 rescue writes already store immutable snapshots.
        $incidents = $id ? $this->context->db()->table('rescues')->where('facility_id', $id)->whereNull('destination_snapshot')->orderBy('alert_id')->pluck('alert_id')->unique()->all() : [];
        $keys = array_map(fn ($incident) => 'incident:'.$incident, $incidents);
        if ($id) {
            $keys[] = 'facility:'.$id;
        }

        return $this->context->transaction($actor, ['captain', 'secretary'], $keys, function () use ($actor, $id, $input, $incidents): array {
            $db = $this->context->db();
            $old = $id ? $db->table('facilities')->where('id', $id)->lockForUpdate()->first() : null;
            if ($id && ! $old) {
                throw new ApiProblem('NOT_FOUND', 404, 'Facility not found.');
            }
            if ($old && (int) $old->managed_by_barangay_id !== $actor->barangayId) {
                throw new ApiProblem('FORBIDDEN', 403, 'Only the managing barangay may change this facility.');
            }
            if ($old) {
                $this->context->revision($old, $input['expected_revision'] ?? null);
                if (! array_diff(array_keys($input), ['status', 'expected_revision']) && ($input['status'] ?? null) === ($old->active ? 'Active' : 'Inactive')) {
                    return $this->project($old, $actor);
                }
            }
            $data = $this->data($input, $old, $actor);
            if ($old) {
                $legacy = $db->table('rescues')->where('facility_id', $id)->whereNull('destination_snapshot')->lockForUpdate()->get();
                if ($legacy->contains(fn ($row) => ! in_array($row->alert_id, $incidents, true))) {
                    throw new ApiProblem('CONFLICT', 409, 'Destination history changed. Reload before editing.');
                }
                foreach ($legacy as $rescue) {
                    $db->table('rescues')->where('id', $rescue->id)->update(['destination_snapshot' => json_encode($this->snapshot($old), JSON_THROW_ON_ERROR)]);
                }
                $data += ['revision' => $old->revision + 1, 'updated_by' => $actor->id, 'updated_at' => now('UTC')];
                $db->table('facilities')->where('id', $id)->update($data);
                $action = (bool) $old->active !== $data['active'] ? ($data['active'] ? 'Reactivated' : 'Deactivated') : 'Edited';
            } else {
                $id = $db->table('facilities')->insertGetId($data + ['managed_by_barangay_id' => $actor->barangayId,
                    'visibility' => 'local', 'created_by' => $actor->id, 'updated_by' => $actor->id, 'created_at' => now('UTC'), 'updated_at' => now('UTC')]);
                $action = 'Created';
            }
            $row = $db->table('facilities')->where('id', $id)->first();
            $this->context->record($actor, 'facility', $id, 'facility.updated.v2', ['status' => $row->active ? 'Active' : 'Inactive'],
                $action, ['status' => $row->active ? 'Active' : 'Inactive', 'revision' => $row->revision], $this->context->administrators($actor->barangayId));

            return $this->project($row, $actor);
        });
    }
}
