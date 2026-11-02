<?php

namespace App\Http\Middleware;

use App\Services\Identity\EffectiveRole;
use App\Support\ApiProblem;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class CurrentIdentity
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('identity.enabled')) {
            // Anonymous bootstrap must work before the DBA model is available.
            if (! $request->session()->has(Auth::guard('web')->getName())) {
                throw new ApiProblem('AUTH', 401, 'Sign in to continue.');
            }
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Identity integration is not available yet.');
        }
        // Laravel's provider rereads the database on each new HTTP request.
        $user = Auth::guard('web')->user();
        $role = $user ? EffectiveRole::of($user) : null;
        if (! $role || $request->session()->get('identity_role') !== $role ||
            ! is_int($user->auth_version) || $request->session()->get('identity_version') !== $user->auth_version) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            throw new ApiProblem('AUTH', 401, 'Sign in to continue.');
        }

        return $next($request);
    }
}
