<?php

declare(strict_types=1);

namespace App\Services\Audit;

use App\Contracts\P2\Store;
use App\Services\P2\Actor;

final class AuditRecorder
{
    public function __construct(private Store $store, private \Closure $clock) {}

    public function record(Actor $actor, string $roleAtAction, int $scope, array $resource, string $action, array $summary = []): array
    {
        if (! $this->store->inTransaction() || $scope !== $actor->barangayId || $roleAtAction !== $actor->role) {
            throw new \LogicException('Audit must join an authorized domain transaction.');
        }
        // Callers supply bounded identifiers/statuses only, never submitted secrets or document contents.
        $safe = array_intersect_key($summary, array_flip(['status', 'assignment_id', 'previous_user_id', 'user_id', 'reason', 'revision']));

        return $this->store->insert('activity_logs', ['actor_id' => $actor->id, 'actor_role' => $roleAtAction, 'barangay_id' => $scope, 'resource_type' => $resource['type'], 'resource_id' => $resource['id'], 'action' => $action, 'summary' => $safe, 'created_at' => ($this->clock)(), 'evidence' => 'Recorded audit event']);
    }
}
