<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CapacityGuard extends Model
{
    use HasFactory;

    protected $table = 'capacity_guards';

    protected $guarded = ['*'];

    public $timestamps = false;

    /** Caller owns the transaction and all policy/capacity decisions. */
    public static function lockPeople(array $userIds, string $kind = 'operations'): void
    {
        $ids = self::orderedIds($userIds);
        foreach ($ids as $id) {
            self::lockScope('person', $id, $kind);
        }
    }

    public static function lockScope(string $type, int $id, string $kind): void
    {
        if (DB::transactionLevel() === 0 || $id < 1) {
            throw new \LogicException('guard_requires_transaction_and_id');
        }
        if (! (($type === 'barangay' && $kind === 'staffing') || ($type === 'person' && in_array($kind, ['operations', 'verification', 'sos', 'recovery'], true)))) {
            throw new \InvalidArgumentException('unsupported_guard_key');
        }
        // The unique upsert is itself serialized on first use; the subsequent SELECT retains the row lock.
        DB::table('capacity_guards')->insertOrIgnore(['scope_type' => $type, 'scope_id' => $id, 'kind' => $kind]);
        DB::table('capacity_guards')->where(['scope_type' => $type, 'scope_id' => $id, 'kind' => $kind])->lockForUpdate()->firstOrFail();
    }

    /** Current reads only; caller supplies authorized IDs and enforces the documented global table order. */
    public static function lockRows(string $table, array $ids): Collection
    {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('row_lock_requires_transaction');
        }
        if (! in_array($table, ['users', 'personnel_appointments', 'emergency_alerts', 'alert_assignments', 'facilities', 'verifications', 'verification_submissions', 'announcements', 'community_feedback'], true)) {
            throw new \InvalidArgumentException('unsupported_lock_table');
        }

        return DB::table($table)->whereIn('id', self::orderedIds($ids))->orderBy('id')->lockForUpdate()->get();
    }

    private static function orderedIds(array $ids): array
    {
        foreach ($ids as $id) {
            if (! is_int($id) || $id < 1) {
                throw new \InvalidArgumentException('guard_id_must_be_positive_integer');
            }
        }
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_NUMERIC);

        return $ids;
    }
}
