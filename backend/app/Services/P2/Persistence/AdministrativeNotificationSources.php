<?php

declare(strict_types=1);

namespace App\Services\P2\Persistence;

use App\Services\P2\Actor;
use Illuminate\Support\Facades\DB;

/** Minimal source references only; display/delivery must never acquire new person locks. */
final class AdministrativeNotificationSources
{
    public const RESOURCES = ['user', 'household', 'verification', 'facility', 'personnel_appointment'];

    public static function row(string $resource, int $id, int $scope): ?array
    {
        [$table, $scopeField, $fields] = match ($resource) {
            'user' => ['users', 'barangay_id', ['id', 'barangay_id']],
            'household' => ['households', 'barangay_id', ['id', 'barangay_id']],
            'verification' => ['verifications', 'barangay_id', ['id', 'barangay_id', 'resident_id', 'review_status']],
            'facility' => ['facilities', 'managed_by_barangay_id', ['id', 'managed_by_barangay_id', 'active']],
            'personnel_appointment' => ['personnel_appointments', 'barangay_id', ['id', 'barangay_id', 'user_id', 'role', 'status']],
            default => [null, null, []],
        };
        if ($table === null) {
            return null;
        }
        $row = DB::table($table)->where('id', $id)->where($scopeField, $scope)->first($fields);

        return $row ? (array) $row : null;
    }

    public static function allowed(Actor $actor, string $resource, array $source): bool
    {
        return match ($resource) {
            'user' => (int) $source['id'] === $actor->id,
            'household' => $actor->role === 'resident' && DB::table('users')->where('id', $actor->id)
                ->where('barangay_id', $actor->barangayId)->where('household_id', $source['id'])->exists(),
            'verification' => $actor->administrator() || ($actor->role === 'resident' && (int) $source['resident_id'] === $actor->id),
            'facility' => $actor->administrator(),
            'personnel_appointment' => $actor->role === 'captain' || ((int) $source['user_id'] === $actor->id
                && $source['status'] === 'Active' && $source['role'] === $actor->role),
            default => false,
        };
    }

    public static function assertSnapshot(string $resource, array $source, array $payload): void
    {
        $expected = match ($resource) {
            'verification' => ['status' => $source['review_status']],
            'facility' => ['status' => $source['active'] ? 'Active' : 'Inactive'],
            'personnel_appointment' => ['role' => $source['role'], 'status' => $source['status']],
            default => $payload,
        };
        if ($payload !== $expected) {
            throw new \LogicException('Event snapshot does not match its exact persisted source.');
        }
    }
}
