<?php

use App\Http\Middleware\CurrentIdentity;
use App\Http\Middleware\RequestContext;
use App\Support\ApiExceptions;
use App\Support\ApiProblem;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            $integrations = __DIR__.'/../routes/integrations.php';
            if (is_file($integrations)) {
                // DBA bearer-authenticated callbacks are stateless. Browser API
                // routes above keep their session and CSRF boundary unchanged.
                Route::middleware('api')->prefix('api/v1')->group($integrations);
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(RequestContext::class);
        $middleware->alias(['current.identity' => CurrentIdentity::class]);
        // Password bytes must survive unchanged, including surrounding spaces.
        $middleware->trimStrings(except: ['password', 'password_confirmation', 'current_password']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(ApiExceptions::render(...));
        $exceptions->dontReport([ApiProblem::class]);
        $exceptions->dontFlash(['current_password', 'password', 'password_confirmation', 'code', 'reset_authorization']);
    })->create();
