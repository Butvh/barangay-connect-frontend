<?php

use App\Http\Controllers\P2\IncidentController as Incidents;
use App\Http\Controllers\P2\RevisionController;
use App\Http\Middleware\CurrentIdentity;
use App\Http\Middleware\P2Enabled;
use App\Http\Middleware\P2Errors;
use Illuminate\Support\Facades\Route;

// P1 includes this file inside the authenticated /api/v1 API group.
Route::middleware([CurrentIdentity::class, P2Errors::class, P2Enabled::class])->group(function () {
    Route::get('revisions/{entity}', [RevisionController::class, 'show']);
    Route::get('dashboard', [Incidents::class, 'dashboard']);
    Route::get('map', [Incidents::class, 'map']);
    Route::get('nearby-alerts', [Incidents::class, 'nearby']);
    Route::get('alerts', [Incidents::class, 'index']);
    Route::post('alerts', [Incidents::class, 'create']);
    Route::get('alerts/{id}', [Incidents::class, 'show']);
    Route::patch('alerts/{id}', [Incidents::class, 'details']);
    Route::get('alerts/{id}/assignment-options', [Incidents::class, 'options']);
    Route::post('alerts/{id}/acknowledgments', [Incidents::class, 'acknowledge']);
    Route::post('alerts/{id}/assignments', [Incidents::class, 'assign']);
    Route::post('assignments/{id}/transfers', [Incidents::class, 'transfer']);
    Route::post('assignments/{id}/cancellations', [Incidents::class, 'cancel']);
    Route::post('alerts/{id}/responses', [Incidents::class, 'respond']);
    Route::post('alerts/{id}/rescues', [Incidents::class, 'rescue']);
    Route::post('alerts/{id}/resolution', [Incidents::class, 'resolve']);
});
