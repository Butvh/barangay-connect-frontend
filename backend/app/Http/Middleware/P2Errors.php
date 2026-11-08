<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\P2\Problem;
use Closure;
use Illuminate\Http\Request;

final class P2Errors
{
    public function handle(Request $request, Closure $next)
    {
        try {
            return $next($request);
        } catch (Problem $e) {
            return $e->render($request);
        }
        // P1's global renderer owns auth/CSRF/throttle and unexpected errors. Never expose SQL/provider details.
    }
}
