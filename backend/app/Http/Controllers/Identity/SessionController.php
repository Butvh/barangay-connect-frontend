<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Http\Requests\Identity\LoginRequest;
use App\Http\Resources\Identity\UserResource;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final class SessionController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json(['data' => ['csrf_token' => $request->session()->token()], 'meta' => $this->meta()]);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (! config('identity.enabled')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Identity integration is not available yet.');
        }
        $guard = Auth::guard('web');
        // No remember cookie. The DBA User model must use Laravel's full-length Argon2id hash.
        if (! $guard->attempt($request->safe()->only(['email', 'password']), false)) {
            throw new ApiProblem('AUTH', 401, 'Email or password is incorrect.');
        }
        $user = $guard->user();
        $identity = EffectiveIdentity::fromUser($user);
        if (! $identity) {
            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            throw new ApiProblem('AUTH', 401, 'Email or password is incorrect.');
        }
        $request->session()->regenerate();
        $request->session()->put($identity->sessionSnapshot());

        return $this->show($request);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => (new UserResource(Auth::guard('web')->user()))->resolve($request), 'meta' => $this->meta()]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => ['signed_out' => true], 'meta' => $this->meta()]);
    }

    private function meta(): array
    {
        return ['server_time' => now('UTC')->toISOString()];
    }
}
