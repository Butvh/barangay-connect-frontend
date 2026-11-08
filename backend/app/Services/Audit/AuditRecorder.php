<?php

declare(strict_types=1);

namespace App\Services\Audit;

use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Contracts\P2\Store;
use App\Services\P2\Actor;

final class AuditRecorder
{
    public function __construct(private Store $store, private \Closure $clock, private ?\App\Contracts\Events\AuditRecorder $typed = null) {}

    public function record(Actor $actor, string $roleAtAction, int $scope, array $resource, string $action, array $summary = []): array
    {
        if (! $this->store->inTransaction() || $scope !== $actor->barangayId || $roleAtAction !== $actor->role) {
            throw new \LogicException('Audit must join an authorized domain transaction.');
        }
        // Callers supply bounded identifiers/statuses only, never submitted secrets or document contents.
        if (array_diff(array_keys($summary), ['status', 'assignment_id', 'previous_user_id', 'user_id', 'reason', 'revision'])) {
            throw new \InvalidArgumentException('Unknown audit metadata.');
        }
        $safe = $summary;

        if ($this->typed) {
            $this->typed->record($actor->id, $roleAtAction, $scope, new ResourceReference($resource['type'], $resource['id']), $action, new AuditSummary($safe));

            return [];
        }

        return $this->store->insert('activity_logs', ['actor_id' => $actor->id, 'actor_role' => $roleAtAction, 'barangay_id' => $scope, 'resource_type' => $resource['type'], 'resource_id' => $resource['id'], 'action' => $action, 'summary' => $safe, 'created_at' => ($this->clock)(), 'evidence' => 'Recorded audit event']);
    }
}
