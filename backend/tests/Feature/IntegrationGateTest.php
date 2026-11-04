<?php

namespace Tests\Feature;

use App\Providers\IntegrationServiceProvider;
use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Auth;
use Tests\Support\ArrayUserProvider;
use Tests\TestCase;

final class IntegrationGateTest extends TestCase
{
    public function test_prepared_bindings_cannot_load_in_a_production_environment(): void
    {
        config(['integration.test_bindings' => true, 'integration.p2_enabled' => false]);
        $this->app->instance('env', 'production');
        $this->expectException(\LogicException::class);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_unavailable_module_still_requires_a_real_session(): void
    {
        $this->getJson('/api/v1/alerts')->assertUnauthorized()->assertJsonPath('code', 'AUTH');
        $this->getJson('/api/v1/references/users/1')->assertUnauthorized();
    }

    public function test_authenticated_incomplete_module_is_explicitly_unavailable(): void
    {
        config(['identity.enabled' => true]);
        Auth::provider('test-users', fn () => new ArrayUserProvider);
        config(['auth.providers.users.driver' => 'test-users']);
        $this->actingAs(new GenericUser(['id' => 42, 'barangay_id' => 7, 'account_status' => 'Active',
            'is_captain' => true, 'is_resident' => false, 'auth_version' => 2, 'remember_token' => null]))
            ->withSession(['identity_role' => 'captain', 'identity_version' => 2, 'identity_scope' => 7])
            ->getJson('/api/v1/alerts')->assertStatus(503)->assertJsonPath('code', 'NOT_AVAILABLE');
        $this->getJson('/api/v1/revisions/alerts')->assertStatus(503)->assertJsonPath('code', 'NOT_AVAILABLE');
    }

    public function test_only_web_cookie_guard_is_selected_and_dispatch_is_disabled(): void
    {
        $this->assertSame('web', config('auth.defaults.guard'));
        $this->assertFalse((bool) config('integration.p2_enabled'));
        $this->assertFalse((bool) config('integration.dispatch_enabled'));
        $this->assertSame(180, config('queue.connections.database.retry_after'));
    }

    public function test_enabled_flag_cannot_bypass_unreviewed_owner_bindings(): void
    {
        config(['integration.p2_enabled' => true, 'identity.enabled' => true]);
        $this->expectException(\LogicException::class);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_dispatch_cannot_start_without_modules_and_real_handler(): void
    {
        config(['integration.p2_enabled' => false, 'integration.dispatch_enabled' => true]);
        $this->expectException(\LogicException::class);
        (new IntegrationServiceProvider($this->app))->register();
    }
}
