<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
        $ids = array_unique(array_map('intval', $userIds));
        sort($ids, SORT_NUMERIC);
        foreach ($ids as $id) {
            self::lockScope('person', $id, $kind);
        }
    }

    public static function lockScope(string $type, int $id, string $kind): void
    {
        if (DB::transactionLevel() === 0 || $id < 1) {
            throw new \LogicException('guard_requires_transaction_and_id');
        }
        // The unique upsert is itself serialized on first use; the subsequent SELECT retains the row lock.
        DB::table('capacity_guards')->insertOrIgnore(['scope_type' => $type, 'scope_id' => $id, 'kind' => $kind]);
        DB::table('capacity_guards')->where(['scope_type' => $type, 'scope_id' => $id, 'kind' => $kind])->lockForUpdate()->firstOrFail();
    }
}
