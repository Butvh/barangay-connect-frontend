<?php

use App\Http\Controllers\Identity\OperationalReferencesController;
use Illuminate\Support\Facades\Route;

Route::middleware('current.identity')->prefix('references')->group(function (): void {
    Route::get('users/{id}', [OperationalReferencesController::class, 'user'])->whereNumber('id');
    Route::get('barangays', [OperationalReferencesController::class, 'barangays']);
    Route::get('facilities/{id?}', [OperationalReferencesController::class, 'facilities'])->whereNumber('id');
    Route::get('revisions/{entity}', [OperationalReferencesController::class, 'revision'])->where('entity', 'users|verification|facilities|barangays');
});
