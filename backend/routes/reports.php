<?php

use App\Http\Controllers\P2\ReportController as Reports;
use App\Http\Middleware\P2Errors;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', P2Errors::class])->prefix('reports')->group(function () {
    Route::get('snapshot', [Reports::class, 'snapshot']);
    Route::get('summary', [Reports::class, 'summary']);
    Route::get('activity', [Reports::class, 'activity']);
    Route::get('performance', [Reports::class, 'performance']);
    Route::get('incidents', [Reports::class, 'incidents']);
    Route::get('incidents/{id}', [Reports::class, 'incident']);
    Route::get('incidents/{id}/export', [Reports::class, 'export']);
});
