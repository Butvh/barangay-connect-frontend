<?php

declare(strict_types=1);

namespace App\Services\P2;

use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\Store;
use App\Services\Audit\AuditRecorder;
use App\Services\Messaging\OutboxWriter;

abstract class Module
{
    public function __construct(protected Store $store, protected ReferenceData $refs, protected AuditRecorder $audit, protected OutboxWriter $outbox, protected \Closure $clock) {}

    protected function row(string $table, int $id, Actor $actor): array
    {
        return $this->store->select($table, ['id' => $id, 'barangay_id' => $actor->barangayId])[0] ?? throw new Problem('NOT_FOUND', 'This record is unavailable.');
    }

    protected function atomic(Actor $actor, array $people, ?int $incident, \Closure $work): mixed
    {
        $people = array_unique([$actor->id, ...$people]);
        sort($people, SORT_NUMERIC);
        $locks = array_map(fn ($id) => 'person:'.$id, $people);
        if ($incident !== null) {
            $locks[] = 'incident:'.$incident;
        }

        return $this->store->transaction($locks, function () use ($actor, $work) {
            $fresh = $this->refs->actorFor($actor->id);
            if ($fresh->role !== $actor->role || $fresh->barangayId !== $actor->barangayId) {
                throw new Problem('FORBIDDEN', 'Account access changed. Sign in again.');
            }

            return $work();
        });
    }

    /** Person guard serializes retries; nested domain work joins this transaction. */
    protected function once(Actor $actor, string $route, array $input, string $key, \Closure $write, \Closure $read): array
    {
        Rules::key($key);
        $canonical = function (array $value) use (&$canonical): array {
            ksort($value);
            foreach ($value as &$v) {
                if (is_array($v)) {
                    $v = $canonical($v);
                }
            }

            return $value;
        };
        $hash = hash('sha256', json_encode($canonical($input), JSON_THROW_ON_ERROR));

        return $this->atomic($actor, [], null, function () use ($actor, $route, $hash, $key, $write, $read) {
            $old = $this->store->select('idempotency_requests', ['actor_id' => $actor->id, 'route' => $route, 'request_key' => $key])[0] ?? null;
            if ($old) {
                if ($old['request_hash'] !== $hash) {
                    throw new Problem('CONFLICT', 'Request key was used with different details.');
                }

                return $read($old['resource_id']);
            }
            $result = $write();
            $this->store->insert('idempotency_requests', ['actor_id' => $actor->id, 'route' => $route, 'request_key' => $key, 'request_hash' => $hash, 'resource_id' => $result['id']]);

            return $result;
        });
    }

    protected function officials(int $scope): array
    {
        return array_values(array_filter($this->refs->people($scope), fn ($p) => in_array($p['role'], ['captain', 'secretary'], true) && ($p['personnel_status'] ?? 'Active') === 'Active'));
    }

    protected function event(Actor $actor, string $type, int $id, array $people): array
    {
        $recipients = [];
        foreach ($people as $p) {
            if (! $p || $p['barangay_id'] !== $actor->barangayId) {
                continue;
            } $recipients[$p['id']] = ['user_id' => $p['id'], 'audience' => $p['role'] === 'resident' ? 'resident' : 'official', 'channels' => ['in_app', 'sms']];
        }

        $context = str_starts_with($type, 'incident.') ? ['status' => $this->row('emergency_alerts', $id, $actor)['status']] : [];

        return $this->outbox->record(bin2hex(random_bytes(16)), $type, $actor->barangayId, $id, array_values($recipients), ($this->clock)(), $context);
    }

    protected function audit(Actor $a, string $type, int $id, string $action, array $summary = []): void
    {
        $this->audit->record($a, $a->role, $a->barangayId, ['type' => $type, 'id' => $id], $action, $summary);
    }
}
