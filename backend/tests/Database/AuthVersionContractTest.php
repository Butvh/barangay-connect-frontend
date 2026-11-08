<?php

namespace Tests\Database;

use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class AuthVersionContractTest extends MysqlDbaTestCase
{
    public function test_auth_version_defaults_to_integer_zero_and_missing_generation_stays_null(): void
    {
        $this->fixtures();
        $this->assertSame(0, User::findOrFail(1)->auth_version);
        $this->assertNull((new User)->auth_version, 'A missing security generation must never become zero in PHP.');
        $user = User::findOrFail(3);
        $this->assertIsInt($user->barangay_id);
        $this->assertSame('responder', $user->appointment->role);
        $this->assertNotNull($user->tanodMembership);
    }

    public function test_negative_generation_is_rejected_by_mysql(): void
    {
        $this->fixtures();
        $this->expectException(QueryException::class);
        DB::table('users')->where('id', 1)->update(['auth_version' => -1]);
    }

    public function test_additive_security_generation_upgrade_and_disposable_rollback_preserve_users(): void
    {
        $this->fixtures();
        $migration = require __DIR__.'/../../database/migrations/2026_11_03_000100_add_user_auth_version.php';
        $migration->down();
        $this->assertSame(40, DB::table('users')->count());
        $migration->up();
        $this->assertSame(40, DB::table('users')->count());
        $this->assertSame(0, User::findOrFail(1)->auth_version);
    }

    public function test_authenticatable_and_remember_token_contract_remain_usable(): void
    {
        $this->fixtures();
        $user = User::findOrFail(1);
        $this->assertInstanceOf(Authenticatable::class, $user);
        $this->assertSame('remember_token', $user->getRememberTokenName());
        $user->setRememberToken('fictional-test-token');
        $user->save();
        $this->assertSame('fictional-test-token', $user->fresh()->getRememberToken());
        $this->assertArrayNotHasKey('remember_token', $user->fresh()->toArray());
    }
}
