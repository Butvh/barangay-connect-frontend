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
            return response()->json(['code' => $e->errorCode, 'message' => $e->getMessage(), 'fields' => (object) $e->fields, 'request_id' => bin2hex(random_bytes(12))], $e->status());
        }
        // P1's global renderer owns auth/CSRF/throttle and unexpected errors. Never expose SQL/provider details.
    }
}
