<?php

use App\Http\Controllers\Identity\SessionController;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\Route;

Route::get('auth/csrf', [SessionController::class, 'csrf'])->middleware('throttle:csrf');
Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login');
Route::middleware('current.identity')->group(function () {
    Route::get('me', [SessionController::class, 'show']);
    Route::post('auth/logout', [SessionController::class, 'logout']);
    // Contract is published; no metadata schema, private-byte service or P2 policy is bound yet.
    Route::post('incident-photos', fn () => throw new ApiProblem('NOT_AVAILABLE', 503, 'Private incident photos are awaiting reviewed integration.'));
    Route::get('incident-photos/{id}/download', fn () => throw new ApiProblem('NOT_AVAILABLE', 503, 'Private incident photos are awaiting reviewed integration.'));
});
