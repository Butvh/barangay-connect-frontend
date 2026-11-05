<?php

namespace Tests\Database;

use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class MigrationUpgradeTest extends MysqlDbaTestCase
{
    public function test_fresh_seeded_upgrade_and_reversible_migration(): void
    {
        $this->fixtures();
        $this->assertSame(40, DB::table('users')->count());
        $this->assertSame(10, DB::table('verifications')->count());
        $this->assertSame(4, DB::table('tanod_memberships')->count());
        $this->assertNull(DB::table('personnel_appointments')->where('user_id', 2)->value('effective_date'));
        $this->migrateDown();
        $this->assertSame([], DB::select('SHOW TABLES'));
        $this->migrateUp();
        $this->fixtures();
        $this->assertSame(40, DB::table('users')->count());
    }

    public function test_ordered_upgrade_preserves_committed_identity_records(): void
    {
        $this->migrateDown();
        $files = glob(__DIR__.'/../../database/migrations/*.php');
        (require array_shift($files))->up();
        DB::table('barangays')->insert(['id' => 1, 'name' => 'Fictional upgrade fixture']);
        DB::table('households')->insert(['id' => 1, 'barangay_id' => 1, 'address' => 'Fictional address', 'map_x' => 0, 'map_y' => 0]);
        DB::table('users')->insert(['id' => 1, 'barangay_id' => 1, 'household_id' => 1, 'full_name' => 'Fictional upgrade resident', 'email' => 'upgrade@example.invalid', 'password' => password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT, ['cost' => 4]), 'is_resident' => true]);
        foreach ($files as $file) {
            (require $file)->up();
        }
        $this->assertSame('upgrade@example.invalid', DB::table('users')->where('id', 1)->value('email'));
        $this->assertSame('0.0000', DB::table('households')->where('id', 1)->value('map_x'));
    }
}
