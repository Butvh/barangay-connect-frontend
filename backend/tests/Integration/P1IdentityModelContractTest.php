<?php

namespace Tests\Integration;

use App\Http\Middleware\CurrentIdentity;
use App\Http\Resources\Identity\UserResource;
use App\Models\User;
use App\Services\Identity\EffectiveRole;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class P1IdentityModelContractTest extends MysqlDbaTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (! class_exists(EffectiveRole::class)) {
            $this->markTestSkipped('Run on the P1+P2+DBA combined checkout for the real P1 identity contract.');
        }
        $this->fixtures();
    }

    public function test_p1_role_and_resource_use_the_real_relational_model_and_hide_security_generation(): void
    {
        $user = User::findOrFail(3);
        $this->assertSame('responder', EffectiveRole::of($user));
        $dto = (new UserResource($user))->resolve(Request::create('/api/v1/me'));
        $this->assertTrue($dto['is_tanod']);
        $this->assertTrue($dto['is_resident']);
        $this->assertArrayNotHasKey('auth_version', $dto);
        $this->assertArrayNotHasKey('remember_token', $dto);
        DB::table('personnel_appointments')->where('user_id', 3)->update(['status' => 'Inactive']);
        $this->assertSame('resident', EffectiveRole::of($user->fresh()));
        DB::table('users')->where('id', 3)->update(['account_status' => 'Inactive']);
        $this->assertNull(EffectiveRole::of($user->fresh()));
    }

    public function test_p1_current_identity_rejects_a_persisted_generation_change(): void
    {
        config(['identity.enabled' => true]);
        $user = User::findOrFail(1);
        $request = Request::create('/api/v1/me');
        $request->setLaravelSession(app('session.store'));
        $request->session()->put(['identity_role' => 'captain', 'identity_version' => 0]);
        Auth::guard('web')->setUser($user);
        $middleware = new CurrentIdentity;
        $this->assertSame(200, $middleware->handle($request, fn () => response('', 200))->getStatusCode());
        DB::table('users')->where('id', $user->id)->increment('auth_version');
        Auth::guard('web')->setUser($user->fresh());
        $this->expectException(ApiProblem::class);
        $middleware->handle($request, fn () => response('', 200));
    }
}
