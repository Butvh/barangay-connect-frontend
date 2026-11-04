<?php

use App\Http\Controllers\Identity\IncidentPhotoController;
use App\Http\Controllers\Identity\SessionController;
use Illuminate\Support\Facades\Route;

Route::get('auth/csrf', [SessionController::class, 'csrf'])->middleware('throttle:csrf');
Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login');
Route::middleware('current.identity')->group(function () {
    Route::get('me', [SessionController::class, 'show']);
    Route::post('auth/logout', [SessionController::class, 'logout']);
    // Real service exists; positive integration stays unavailable unless explicitly reviewed/bound.
    Route::post('incident-photos', [IncidentPhotoController::class, 'stage'])->middleware('throttle:photo-upload');
    Route::get('incident-photos/{id}/download', [IncidentPhotoController::class, 'download'])->whereNumber('id');
});
