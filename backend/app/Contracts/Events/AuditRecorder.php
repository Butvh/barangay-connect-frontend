<?php

namespace App\Contracts\Events;

interface AuditRecorder
{
    /** Must use the caller's open database transaction; no commit, queue, or HTTP call. */
    public function record(
        ?int $actor,
        ?string $roleAtAction,
        int $scope,
        ResourceReference $resource,
        string $action,
        string $summary,
    ): void;
}
