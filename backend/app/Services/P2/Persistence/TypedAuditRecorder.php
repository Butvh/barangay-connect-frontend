<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Contracts\Events\AuditRecorder;
use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\Identity\EffectiveRole;
use Illuminate\Support\Facades\DB;

final class TypedAuditRecorder implements AuditRecorder
{
    public function record(?int $actor, ?string $roleAtAction, int $scope, ResourceReference $resource, string $action, AuditSummary $summary): void
    {
        if (DB::transactionLevel() === 0 || $scope < 1 || $resource->id < 1 || mb_strlen($action) > 100 || strlen(json_encode($summary->values, JSON_THROW_ON_ERROR)) > 4096) {
            throw new \LogicException('Invalid transactional audit evidence.');
        }
        $user = $actor === null ? null : User::query()->where(['id' => $actor, 'barangay_id' => $scope])->firstOrFail();
        if (($actor === null) !== ($roleAtAction === null) || ($user && EffectiveRole::of($user) !== $roleAtAction)) {
            throw new \LogicException('Audit actor and role mismatch.');
        }
        (new ActivityLog)->forceFill(['actor_id' => $actor, 'actor_name' => $user?->full_name, 'role_at_action' => $roleAtAction, 'barangay_id' => $scope, 'resource_type' => $resource->type, 'resource_id' => $resource->id, 'action' => $action, 'evidence' => 'Recorded audit event', 'summary' => $summary->values, 'occurred_at' => now()])->save();
    }
}
