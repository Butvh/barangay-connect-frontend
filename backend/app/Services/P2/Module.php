<?php

declare(strict_types=1);

namespace App\Services\P2;

use App\Contracts\P2\ActorReferences;
use App\Contracts\P2\EligibilityReferences;
use App\Contracts\P2\ReferenceData;
use App\Contracts\P2\ScopedReferences;
use App\Contracts\P2\Store;
use App\Services\Audit\AuditRecorder;
use App\Services\Messaging\OutboxWriter;

abstract class Module
{
    use UsesScopedReferences;

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
            $fresh = $this->refs instanceof ActorReferences ? $this->refs->locked($actor) : $this->refs->actorFor($actor->id);
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

    protected function officials(Actor $actor): array
    {
        if ($this->refs instanceof ScopedReferences) {
            return $this->refs->officialRecipients($actor);
        }

        return array_values(array_filter($this->refs->people($actor->barangayId), fn ($p) => in_array($p['role'], ['captain', 'secretary'], true) && ($p['personnel_status'] ?? 'Active') === 'Active'));
    }

    protected function eligiblePerson(Actor $actor, int $id): ?array
    {
        $refs = $this->references($actor);

        return $refs instanceof EligibilityReferences ? $refs->eligiblePerson($id, $actor->barangayId) : $refs->person($id, $actor->barangayId);
    }

    protected function event(Actor $actor, string $type, int $id, array $people): array
    {
        $recipients = [];
        foreach ($people as $p) {
            if (! $p || $p['barangay_id'] !== $actor->barangayId || ! in_array($p['role'], ['resident', 'captain', 'secretary', 'responder', 'rescuer'], true) || ($p['account_status'] ?? 'Active') !== 'Active' || ($p['personnel_status'] ?? 'Active') !== 'Active') {
                continue;
            } $recipients[$p['id']] = ['user_id' => $p['id'], 'audience' => $p['role'] === 'resident' ? 'resident' : 'official', 'channels' => ['in_app']];
        }

        $context = str_starts_with($type, 'incident.') ? ['status' => $this->row('emergency_alerts', $id, $actor)['status']] : [];

        $at = $type === 'incident.created' ? $this->row('emergency_alerts', $id, $actor)['reported_at'] : ($this->clock)();

        $result = [];
        foreach (array_chunk(array_values($recipients), 1000) ?: [[]] as $chunk) {
            $bytes = random_bytes(16);
            $bytes[6] = chr((ord($bytes[6]) & 15) | 64);
            $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
            $hex = bin2hex($bytes);
            $uuid = substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20);
            $result = $this->outbox->record($uuid, $type, $actor->barangayId, $id, $chunk, $at, $context);
        }

        return $result;
    }

    protected function audit(Actor $a, string $type, int $id, string $action, array $summary = []): void
    {
        $this->audit->record($a, $a->role, $a->barangayId, ['type' => $type, 'id' => $id], $action, $summary);
    }
}
