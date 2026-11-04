<?php

use App\Http\Controllers\Identity\AdministrationController;
use App\Http\Controllers\Identity\OperationalReferencesController;
use App\Http\Controllers\Identity\VerificationController;
use Illuminate\Support\Facades\Route;

Route::middleware('current.identity')->group(function (): void {
    Route::get('verifications', [VerificationController::class, 'index']);
    Route::post('verifications/expire-overdue', [VerificationController::class, 'expire']);
    Route::get('verifications/{id}', [VerificationController::class, 'show'])->whereNumber('id');
    Route::post('me/verifications', [VerificationController::class, 'submit'])->middleware('throttle:private-documents');
    Route::post('verifications/{id}/submissions', [VerificationController::class, 'submit'])->whereNumber('id')->middleware('throttle:private-documents');
    Route::post('verifications/{id}/decisions', [VerificationController::class, 'review'])->whereNumber('id');
    Route::get('private-documents/{id}', [VerificationController::class, 'download'])->whereNumber('id');
    Route::get('facilities', [AdministrationController::class, 'facilities']);
    Route::get('facilities/{id}', [AdministrationController::class, 'facility'])->whereNumber('id');
    Route::post('facilities', [AdministrationController::class, 'saveFacility']);
    Route::patch('facilities/{id}', [AdministrationController::class, 'saveFacility'])->whereNumber('id');
    Route::patch('facilities/{id}/status', [AdministrationController::class, 'saveFacility'])->whereNumber('id');
    Route::patch('facilities/{id}/location', [AdministrationController::class, 'saveFacility'])->whereNumber('id');
});

Route::middleware('current.identity')->prefix('references')->group(function (): void {
    Route::get('users/{id}', [OperationalReferencesController::class, 'user'])->whereNumber('id');
    Route::get('barangays', [OperationalReferencesController::class, 'barangays']);
    Route::get('facilities/{id?}', [OperationalReferencesController::class, 'facilities'])->whereNumber('id');
    Route::get('revisions/{entity}', [OperationalReferencesController::class, 'revision'])->where('entity', 'users|verification|facilities|barangays');
});
