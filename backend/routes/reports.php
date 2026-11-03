<?php

use App\Http\Controllers\P2\ReportController as Reports;
use App\Http\Middleware\CurrentIdentity;
use App\Http\Middleware\P2Enabled;
use App\Http\Middleware\P2Errors;
use Illuminate\Support\Facades\Route;

Route::middleware([CurrentIdentity::class, P2Errors::class, P2Enabled::class])->prefix('reports')->group(function () {
    Route::get('snapshot', [Reports::class, 'snapshot']);
    Route::get('summary', [Reports::class, 'summary']);
    Route::get('activity', [Reports::class, 'activity']);
    Route::get('performance', [Reports::class, 'performance']);
    Route::get('incidents', [Reports::class, 'incidents']);
    Route::get('incidents/{id}', [Reports::class, 'incident']);
    Route::get('incidents/{id}/export', [Reports::class, 'export']);
});
