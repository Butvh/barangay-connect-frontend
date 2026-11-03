<?php

namespace Tests\Support;

use App\Models\Barangay;
use App\Models\Household;
use App\Models\PersonnelAppointment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

trait CombinedMysql
{
    protected function combinedMysql(): void
    {
        if (getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1') {
            $this->markTestSkipped('Requires the pinned combined disposable MySQL job.');
        }
        $name = DB::connection('mysql')->getDatabaseName();
        if (! str_starts_with($name, 'bc_dba_p1_') || $name !== getenv('DB_TEST_DATABASE')) {
            throw new \LogicException('Refusing an unconfirmed/shared database.');
        }
        $this->assertStringStartsWith('8.4.', DB::selectOne('SELECT VERSION() AS v')->v);
        if (! Schema::hasTable('users')) {
            foreach (glob(database_path('migrations/*.php')) as $file) {
                (require $file)->up();
            }
        }
        $this->assertTrue(Schema::hasColumn('users', 'auth_version'));
        config(['identity.enabled' => true]);
    }

    protected function sourceUser(string $role = 'resident', ?int $scope = null): User
    {
        $scope ??= Barangay::forceCreate(['name' => 'Fictional P1 reference area'])->id;
        $home = Household::forceCreate(['barangay_id' => $scope, 'address' => 'Fictional reference street', 'map_x' => 0, 'map_y' => 0]);
        $user = User::forceCreate(['barangay_id' => $scope, 'household_id' => $home->id, 'full_name' => 'Fictional reference person',
            'email' => bin2hex(random_bytes(10)).'@example.invalid', 'password' => Hash::make('IntegrationTest123'),
            'is_resident' => true, 'is_captain' => $role === 'captain', 'account_status' => 'Active']);
        if (in_array($role, ['secretary', 'responder', 'rescuer'], true)) {
            PersonnelAppointment::forceCreate(['user_id' => $user->id, 'barangay_id' => $scope, 'role' => $role, 'status' => 'Active', 'source' => 'external']);
        }

        return $user->fresh();
    }
}
