<?php

declare(strict_types=1);

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\P2\Actor;
use App\Services\P2\Problem;

final class MemoryStore implements Store
{
    public array $rows = [];

    public ?string $failTable = null;

    public array $locks = [];

    private int $depth = 0;

    public function inTransaction(): bool
    {
        return $this->depth > 0;
    }

    public function transaction(array $keys, Closure $work): mixed
    {
        $copy = $this->rows;
        $this->locks[] = $keys;
        $this->depth++;
        try {
            return $work();
        } catch (Throwable $e) {
            $this->rows = $copy;
            throw $e;
        } finally {
            $this->depth--;
        }
    }

    public function select(string $table, array $where = []): array
    {
        return array_values(array_filter($this->rows[$table] ?? [], function ($r) use ($where) {
            foreach ($where as $k => $v) {
                if (! array_key_exists($k, $r) || $r[$k] !== $v) {
                    return false;
                }
            }

            return true;
        }));
    }

    public function insert(string $table, array $row): array
    {
        if ($this->failTable === $table) {
            throw new RuntimeException('Storage failure');
        } if ($table === 'alert_assignments' && $row['status'] === 'active' && $this->select($table, ['alert_id' => $row['alert_id'], 'role' => $row['role'], 'status' => 'active'])) {
            throw new RuntimeException('Duplicate active incident/role');
        } $row['id'] = count($this->rows[$table] ?? []) + 1;
        $this->rows[$table][] = $row;

        return $row;
    }

    public function update(string $table, int $id, array $patch): array
    {
        foreach ($this->rows[$table] ?? [] as $k => $row) {
            if ($row['id'] === $id) {
                return $this->rows[$table][$k] = array_replace($row, $patch);
            }
        } throw new RuntimeException('Missing fixture');
    }
}
final class References implements ReferenceData
{
    public string $homeAddress = 'Private Street';

    public bool $approved = true;

    public bool $activeFacility = true;

    public array $inactive = [];

    public array $roles = [];

    public function actorFor(int $id): Actor
    {
        $p = $this->person($id, $id === 9 ? 2 : 1);
        if (! $p || $p['personnel_status'] !== 'Active') {
            throw new Problem('FORBIDDEN', 'Account inactive.');
        }

        return new Actor($id, $p['barangay_id'], $p['role']);
    }

    public function person(int $id, int $barangay): ?array
    {
        $roles = $this->roles + [1 => 'resident', 2 => 'secretary', 3 => 'captain', 4 => 'responder', 5 => 'rescuer', 6 => 'tanod', 7 => 'responder', 8 => 'resident', 9 => 'secretary'];
        if (! isset($roles[$id]) || ($id === 9 ? 2 : 1) !== $barangay) {
            return null;
        }

        return ['id' => $id, 'barangay_id' => $barangay, 'full_name' => 'Person '.$id, 'role' => $roles[$id], 'personnel_status' => in_array($id, $this->inactive, true) ? 'Inactive' : 'Active', 'is_'.$roles[$id] => true];
    }

    public function people(int $barangay): array
    {
        return array_values(array_filter(array_map(fn ($id) => $this->person($id, $barangay), range(1, 9))));
    }

    public function household(int $userId, int $barangay): ?array
    {
        return ['id' => $userId, 'barangay_id' => $barangay, 'address' => $this->homeAddress, 'map_x' => 34.0, 'map_y' => 66.0];
    }

    public function approved(int $userId, int $barangay): bool
    {
        return $this->approved;
    }

    public function facilities(int $barangay): array
    {
        return [['id' => 1, 'barangay_id' => $barangay, 'name' => 'School', 'type' => 'EvacuationCenter', 'address' => 'School Road', 'is_active' => $this->activeFacility, 'map_x' => 15, 'map_y' => 30]];
    }

    public function verifications(int $barangay): array
    {
        return [];
    }

    public function personnel(int $barangay): array
    {
        return ['people' => array_values(array_filter($this->people($barangay), fn ($p) => in_array($p['role'], ['secretary', 'responder', 'rescuer']))), 'capacities' => []];
    }

    public function barangay(int $id): array
    {
        return ['id' => $id, 'name' => 'Barangay One'];
    }
}
