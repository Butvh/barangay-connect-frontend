<?php

namespace App\Http\Middleware;

use App\Services\P2\Problem;

final class P2Enabled
{
    public function handle($request, \Closure $next)
    {
        if (! config('integration.p2_enabled', false)) {
            throw new Problem('UNAVAILABLE', 'P2 integration is awaiting the shared acceptance gates.');
        }

        return $next($request);
    }
}
