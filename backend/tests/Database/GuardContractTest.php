<?php

namespace Tests\Database;

use App\Models\CapacityGuard;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class GuardContractTest extends MysqlDbaTestCase
{
    public function test_guard_identifiers_are_not_silently_coerced(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        DB::transaction(fn () => CapacityGuard::lockPeople(['7invalid']));
    }

    public function test_invalid_scope_kind_cannot_create_an_ignored_enum_guard(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        DB::transaction(fn () => CapacityGuard::lockScope('barangay', 1, 'operations'));
    }

    public function test_current_locked_read_observes_revocation_after_an_old_repeatable_read_snapshot(): void
    {
        $this->fixtures();
        config(['database.connections.peer' => config('database.connections.mysql')]);
        $peer = DB::connection('peer');
        DB::beginTransaction();
        try {
            $this->assertSame('Active', DB::table('personnel_appointments')->where('user_id', 3)->value('status'));
            $peer->transaction(function () use ($peer) {
                $peer->table('capacity_guards')->insertOrIgnore(['scope_type' => 'person', 'scope_id' => 3, 'kind' => 'operations']);
                $peer->table('capacity_guards')->where(['scope_type' => 'person', 'scope_id' => 3, 'kind' => 'operations'])->lockForUpdate()->first();
                $peer->table('personnel_appointments')->where('user_id', 3)->update(['status' => 'Inactive']);
            });
            CapacityGuard::lockPeople([3]);
            $id = DB::table('personnel_appointments')->where('user_id', 3)->value('id');
            $rows = CapacityGuard::lockRows('personnel_appointments', [$id]);
            $this->assertSame('Inactive', $rows->first()->status, 'Mutations require current locking reads after guard waits.');
        } finally {
            DB::rollBack();
            $peer->disconnect();
        }
    }
}
