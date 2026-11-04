<?php

use App\Http\Controllers\Identity\AdministrationController;
use App\Http\Controllers\Identity\IncidentPhotoController;
use App\Http\Controllers\Identity\NotificationPreferenceController;
use App\Http\Controllers\Identity\SessionController;
use Illuminate\Support\Facades\Route;

Route::get('auth/csrf', [SessionController::class, 'csrf'])->middleware('throttle:csrf');
Route::post('auth/login', [SessionController::class, 'login'])->middleware('throttle:login');
Route::get('barangays', [AdministrationController::class, 'barangays']);
Route::post('auth/register', [AdministrationController::class, 'register'])->middleware('throttle:registration');
Route::middleware('current.identity')->group(function () {
    Route::get('me', [SessionController::class, 'show']);
    Route::post('auth/logout', [SessionController::class, 'logout']);
    Route::get('profile', [AdministrationController::class, 'profile']);
    Route::patch('profile', [AdministrationController::class, 'updateProfile']);
    Route::get('household', [AdministrationController::class, 'household']);
    Route::patch('household', [AdministrationController::class, 'updateHousehold']);
    Route::get('account/security', [AdministrationController::class, 'security']);
    Route::post('account/password', [AdministrationController::class, 'password'])->middleware('throttle:password-change');
    Route::get('me/notification-preferences/{purpose}', [NotificationPreferenceController::class, 'show']);
    Route::put('me/notification-preferences/{purpose}', [NotificationPreferenceController::class, 'update'])->middleware('throttle:consent-write');
    // Real service exists; positive integration stays unavailable unless explicitly reviewed/bound.
    Route::post('incident-photos', [IncidentPhotoController::class, 'stage'])->middleware('throttle:photo-upload');
    Route::get('incident-photos/{id}/download', [IncidentPhotoController::class, 'download'])->whereNumber('id');
});
