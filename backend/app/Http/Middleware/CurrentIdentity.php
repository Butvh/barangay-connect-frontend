<?php

namespace App\Http\Middleware;

use App\Services\Identity\EffectiveIdentity;
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
        $identity = $user ? EffectiveIdentity::fromUser($user) : null;
        if (! $identity || ! $identity->matches($request->session()->all())) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            throw new ApiProblem('AUTH', 401, 'Sign in to continue.');
        }
        // Concurrency precondition only: the cookie/DB identity remains the authority.
        // An old tab must not submit its form as a newly signed-in account in another tab.
        $observed = $request->header('X-BC-Identity');
        $expected = $identity->id.':'.$identity->barangayId.':'.$identity->role;
        if (! $request->isMethodSafe() && $observed !== null && ! hash_equals($expected, $observed)) {
            throw new ApiProblem('CONFLICT', 409, 'Your account changed. Reload before continuing.');
        }
        $request->attributes->set('effective_identity', $identity);

        return $next($request);
    }
}
