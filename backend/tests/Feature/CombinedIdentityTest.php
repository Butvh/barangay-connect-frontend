<?php

namespace Tests\Feature;

use App\Http\Resources\Identity\UserResource;
use App\Models\Barangay;
use App\Models\PersonnelAppointment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Runs only in the pinned private snapshot against an explicitly disposable genuine MySQL DB. */
final class CombinedIdentityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('P1_COMBINED_TESTS') !== '1' || getenv('DB_TEST_DISPOSABLE') !== '1') {
            $this->markTestSkipped('Use the pinned combined snapshot and disposable MySQL job.');
        }
        $name = DB::connection('mysql')->getDatabaseName();
        if (! str_starts_with($name, 'bc_dba_p1_') || $name !== getenv('DB_TEST_DATABASE')) {
            throw new \LogicException('P1 combined tests refuse a shared or unconfirmed database.');
        }
        $version = DB::selectOne('SELECT VERSION() AS v')->v;
        $this->assertStringStartsWith('8.4.', $version);
        $this->assertStringNotContainsStringIgnoringCase('mariadb', $version);
        if (! Schema::hasTable('users')) {
            foreach (glob(database_path('migrations/*.php')) as $file) {
                (require $file)->up();
            }
        }
        config(['identity.enabled' => true, 'session.driver' => 'database', 'session.connection' => 'mysql']);
        Auth::forgetGuards();
    }

    private function ready(): void
    {
        if (! Schema::hasColumn('users', 'auth_version') || ! in_array((new User)->getCasts()['auth_version'] ?? null, ['int', 'integer'], true)) {
            $this->markTestSkipped('DBA request: additive users.auth_version and integer cast missing. No replacement schema/model added.');
        }
    }

    private function fixture(bool $staff = false): User
    {
        $area = Barangay::forceCreate(['name' => 'Fictional P1 integration area']);
        $data = ['barangay_id' => $area->id, 'full_name' => 'Fictional P1 test resident',
            'email' => bin2hex(random_bytes(8)).'@example.invalid', 'password' => Hash::make('IntegrationTest123'),
            'is_resident' => true, 'is_captain' => false, 'account_status' => 'Active'];
        if (Schema::hasColumn('users', 'auth_version')) {
            $data['auth_version'] = 0;
        }
        $user = User::forceCreate($data);
        if ($staff) {
            PersonnelAppointment::forceCreate(['user_id' => $user->id, 'barangay_id' => $area->id,
                'role' => 'secretary', 'status' => 'Active', 'source' => 'external']);
        }

        return $user;
    }

    public function test_actual_dba_model_missing_generation_denies_login(): void
    {
        if (Schema::hasColumn('users', 'auth_version')) {
            $this->assertContains((new User)->getCasts()['auth_version'] ?? null, ['int', 'integer']);

            return;
        }
        $user = $this->fixture(true);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'IntegrationTest123'])
            ->assertUnauthorized()->assertJsonPath('code', 'AUTH');
        $this->assertGuest();
    }

    public function test_actual_model_projection_and_guest_csrf_boundary(): void
    {
        $user = $this->fixture(true);
        $dto = (new UserResource($user))->resolve(Request::create('/api/v1/me'));
        $this->assertTrue($dto['is_secretary']);
        $this->assertSame('secretary', $dto['role']);
        $this->assertArrayNotHasKey('password', $dto);
        $this->assertArrayNotHasKey('remember_token', $dto);
        $this->assertArrayNotHasKey('auth_version', $dto);
        $this->getJson('/api/v1/me')->assertUnauthorized();
        $this->app['env'] = 'local';
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'IntegrationTest123'])
            ->assertStatus(419)->assertJsonPath('code', 'CSRF');
    }

    private function login(User $user): void
    {
        $response = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'IntegrationTest123'])
            ->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonMissingPath('data.password');
        $cookie = $response->getCookie(config('session.cookie'), false);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
        $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
        Auth::forgetGuards();
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_real_dba_login_me_logout_with_shared_cookie_session(): void
    {
        $this->ready();
        $this->login($this->fixture());
        $this->postJson('/api/v1/auth/logout')->assertOk()->assertJsonPath('data.signed_out', true);
        Auth::forgetGuards();
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public static function revocations(): array
    {
        return [['generation'], ['role'], ['account_status'], ['appointment_status'], ['tenant']];
    }

    #[DataProvider('revocations')]
    public function test_real_model_revocations(string $change): void
    {
        $this->ready();
        $user = $this->fixture(in_array($change, ['role', 'appointment_status'], true));
        $this->login($user);
        match ($change) {
            'generation' => DB::table('users')->where('id', $user->id)->increment('auth_version'),
            'role' => DB::table('personnel_appointments')->where('user_id', $user->id)->update(['role' => 'responder']),
            'account_status' => DB::table('users')->where('id', $user->id)->update(['account_status' => 'Inactive']),
            'appointment_status' => DB::table('personnel_appointments')->where('user_id', $user->id)->update(['status' => 'Inactive']),
            'tenant' => DB::table('users')->where('id', $user->id)->update(['barangay_id' => Barangay::forceCreate(['name' => 'Other fictional P1 area'])->id]),
        };
        Auth::forgetGuards();
        $this->getJson('/api/v1/me')->assertUnauthorized()->assertJsonPath('code', 'AUTH');
    }
}
