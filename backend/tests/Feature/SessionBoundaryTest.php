<?php

namespace Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\Support\ArrayUserProvider;
use Tests\TestCase;

final class SessionBoundaryTest extends TestCase
{
    private ArrayUserProvider $users;

    protected function setUp(): void
    {
        parent::setUp();
        $this->users = new ArrayUserProvider;
        Auth::provider('test-users', fn () => $this->users);
        config(['auth.providers.users.driver' => 'test-users']);
    }

    public function test_session_login_uses_guard_and_preserves_password_bytes(): void
    {
        config(['identity.enabled' => true]);
        $password = ' Password123 ';
        $this->users->users[42] = $this->user(['password' => Hash::make($password)]);
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'PERSON@example.test', 'password' => $password])
            ->assertOk()->assertJsonPath('data.id', 42)->assertSessionHas('identity_role', 'secretary')
            ->assertSessionHas('identity_version', 2)->assertJsonMissingPath('data.password');
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.id', 42);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_guest_and_forged_demo_id_cannot_read_me(): void
    {
        $this->withSession(['barangay-connect:session:v1' => 1])
            ->getJson('/api/v1/me')->assertUnauthorized()
            ->assertJsonPath('code', 'AUTH')->assertJsonStructure(['request_id', 'fields']);
    }

    public function test_schema_dependency_is_explicit_and_no_password_is_echoed(): void
    {
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'person@example.test', 'password' => 'PrivatePassword123'])
            ->assertStatus(503)->assertJsonPath('code', 'NOT_AVAILABLE')
            ->assertDontSee('PrivatePassword123')->assertDontSee('App\\Models');
    }

    public function test_login_rejects_unknown_protected_fields(): void
    {
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'person@example.test', 'password' => 'PrivatePassword123', 'is_captain' => true])
            ->assertUnprocessable()->assertJsonPath('code', 'VALIDATION');
    }

    public function test_malformed_login_fields_fail_validation_without_internal_error(): void
    {
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => ['not-a-string'], 'password' => ['not-a-string']])
            ->assertUnprocessable()->assertJsonPath('code', 'VALIDATION');
    }

    public function test_login_has_independent_account_rate_limit(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'limited@example.test', 'password' => 'TestPassword123'])
                ->assertStatus(503);
        }
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'limited@example.test', 'password' => 'TestPassword123'])
            ->assertStatus(429)->assertJsonPath('code', 'RATE_LIMIT')->assertHeader('Retry-After');
    }

    public function test_real_guard_identity_is_projected_without_secret_columns(): void
    {
        config(['identity.enabled' => true]);
        $user = $this->user();
        $this->actingAs($user)->withSession(['identity_scope' => 7, 'identity_role' => 'secretary', 'identity_version' => 2])
            ->getJson('/api/v1/me')->assertOk()
            ->assertJsonPath('data.id', 42)->assertJsonPath('data.role', 'secretary')
            ->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.remember_token')
            ->assertJsonMissingPath('data.internal_secret')->assertJsonStructure(['meta' => ['server_time']])
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_changed_role_or_security_version_revokes_session(): void
    {
        config(['identity.enabled' => true]);
        $this->actingAs($this->user())->withSession(['identity_scope' => 7, 'identity_role' => 'secretary', 'identity_version' => 1])
            ->getJson('/api/v1/me')->assertUnauthorized()->assertJsonPath('code', 'AUTH');
        $this->assertGuest();
    }

    public function test_tenant_change_revokes_even_when_role_and_generation_match(): void
    {
        config(['identity.enabled' => true]);
        $this->actingAs($this->user())->withSession(['identity_role' => 'secretary', 'identity_version' => 2, 'identity_scope' => 8])
            ->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_negative_security_generation_cannot_authenticate(): void
    {
        config(['identity.enabled' => true]);
        $this->users->users[42] = $this->user(['auth_version' => -1, 'password' => Hash::make('TestPassword123')]);
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'person@example.test', 'password' => 'TestPassword123'])
            ->assertUnauthorized();
    }

    public function test_stale_tab_actor_context_cannot_mutate_as_a_different_cookie_account(): void
    {
        config(['identity.enabled' => true]);
        $this->actingAs($this->user())->withSession(['identity_role' => 'secretary', 'identity_version' => 2, 'identity_scope' => 7])
            ->withHeader('X-BC-Identity', '99:7:secretary')->postJson('/api/v1/auth/logout')
            ->assertConflict()->assertJsonPath('code', 'CONFLICT');
        $this->assertAuthenticated();
    }

    public function test_inactive_staff_does_not_keep_official_session(): void
    {
        config(['identity.enabled' => true]);
        $user = $this->user(['appointment' => (object) ['role' => 'secretary', 'status' => 'Inactive', 'barangay_id' => 7], 'is_resident' => true]);
        $this->actingAs($user)->withSession(['identity_scope' => 7, 'identity_role' => 'secretary', 'identity_version' => 2])
            ->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_inactive_account_cannot_use_even_a_matching_portal_session(): void
    {
        config(['identity.enabled' => true]);
        $this->actingAs($this->user(['account_status' => 'Inactive']))
            ->withSession(['identity_scope' => 7, 'identity_role' => 'secretary', 'identity_version' => 2])
            ->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_logout_invalidates_session_and_rotates_csrf(): void
    {
        config(['identity.enabled' => true]);
        $this->actingAs($this->user())->withSession(['identity_scope' => 7, 'identity_role' => 'secretary', 'identity_version' => 2, 'old_private_value' => 'remove'])
            ->postJson('/api/v1/auth/logout')->assertOk()->assertJsonPath('data.signed_out', true)
            ->assertSessionMissing('old_private_value')->assertSessionHas('_token');
        $this->assertGuest();
    }

    public function test_csrf_stays_enabled_outside_laravel_test_bypass(): void
    {
        // Laravel normally skips CSRF in unit tests; simulate a normal local request.
        $this->app['env'] = 'local';
        $this->postJson('/api/v1/auth/login', ['portal' => 'official', 'email' => 'person@example.test', 'password' => 'PrivatePassword123'])
            ->assertStatus(419)->assertJsonPath('code', 'CSRF');
    }

    public function test_bootstrap_supplies_csrf_and_server_time_without_identity(): void
    {
        $this->getJson('/api/v1/auth/csrf')->assertOk()
            ->assertJsonStructure(['data' => ['csrf_token'], 'meta' => ['server_time']])
            ->assertJsonMissingPath('data.user')->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_unexpected_errors_never_disclose_exception_details(): void
    {
        Route::get('/api/v1/test-error', fn () => throw new \RuntimeException('private database credentials'));
        $this->getJson('/api/v1/test-error')->assertStatus(500)->assertJsonPath('code', 'SERVER')
            ->assertDontSee('private database credentials')->assertJsonStructure(['request_id']);
    }

    public function test_unknown_api_route_has_consistent_envelope(): void
    {
        $this->getJson('/api/v1/does-not-exist')->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
    }

    private function user(array $extra = []): GenericUser
    {
        return new GenericUser(array_replace([
            'id' => 42, 'full_name' => 'Test Secretary', 'email' => 'person@example.test',
            'barangay_id' => 7, 'household_id' => null, 'contact_number' => null,
            'is_captain' => false, 'is_resident' => false, 'account_status' => 'Active',
            'appointment' => (object) ['role' => 'secretary', 'status' => 'Active', 'barangay_id' => 7],
            'tanodMembership' => null, 'auth_version' => 2, 'created_at' => null,
            'password' => 'never-output', 'remember_token' => 'never-output', 'internal_secret' => 'never-output',
        ], $extra));
    }
}
