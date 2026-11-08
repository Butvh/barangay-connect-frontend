<?php

namespace Tests\Feature;

use App\Services\Identity\EffectiveIdentity;
use Illuminate\Support\Facades\Auth;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedSessionObservationTest extends TestCase
{
    use CombinedMysql;

    public function test_same_user_same_role_reauthentication_rejects_the_original_browser_observation(): void
    {
        $this->combinedMysql();
        config(['session.driver' => 'database', 'session.connection' => 'mysql']);
        Auth::forgetGuards();
        $user = $this->sourceUser();
        $login = function () use ($user): string {
            $response = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'IntegrationTest123', 'portal' => (EffectiveIdentity::fromUser($user)?->role === 'resident' ? 'resident' : 'official')])
                ->assertOk()->assertJsonMissingPath('data.auth_version');
            $nonce = $response->json('meta.session_observation');
            $this->assertIsString($nonce);
            $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/D', $nonce);
            $cookie = $response->getCookie(config('session.cookie'), false);
            $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
            Auth::forgetGuards();

            return $nonce;
        };
        $first = $login();
        $second = $login();
        $this->assertNotSame($first, $second);
        $this->withHeader('X-BC-Identity', $user->id.':'.$user->barangay_id.':resident')
            ->withHeader('X-BC-Observation', $first)->postJson('/api/v1/auth/logout')->assertConflict();
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->withHeader('X-BC-Observation', $second)->postJson('/api/v1/auth/logout')->assertOk();
    }
}
