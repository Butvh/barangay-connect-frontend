<?php

use App\Http\Controllers\P2\CivicController as Civic;
use App\Http\Controllers\P2\NotificationController as Notifications;
use App\Http\Middleware\CurrentIdentity;
use App\Http\Middleware\P2Enabled;
use App\Http\Middleware\P2Errors;
use Illuminate\Support\Facades\Route;

Route::middleware([CurrentIdentity::class, P2Errors::class, P2Enabled::class])->group(function () {
    Route::get('announcements', [Civic::class, 'announcements']);
    Route::post('announcements', [Civic::class, 'publish']);
    Route::post('announcements/expire-overdue', [Civic::class, 'expire']);
    Route::get('announcements/{id}', [Civic::class, 'announcement']);
    Route::patch('announcements/{id}', [Civic::class, 'edit']);
    Route::post('announcements/{id}/archive', [Civic::class, 'archive']);
    Route::post('announcements/{id}/retract', [Civic::class, 'retract']);
    Route::get('feedback', [Civic::class, 'feedback']);
    Route::post('feedback', [Civic::class, 'submit']);
    Route::get('feedback/{id}', [Civic::class, 'feedbackItem']);
    Route::post('feedback/{id}/assignment', [Civic::class, 'assignFeedback']);
    Route::post('feedback/{id}/resolution', [Civic::class, 'resolveFeedback']);
    Route::get('notifications', [Notifications::class, 'index']);
    Route::post('notifications/clear-read', [Notifications::class, 'clearRead']);
    Route::post('notifications/mark-all-read', [Notifications::class, 'readAll']);
    Route::get('notifications/{id}', [Notifications::class, 'show']);
    Route::patch('notifications/{id}', [Notifications::class, 'update']);
    Route::delete('notifications/{id}', [Notifications::class, 'dismiss']);
});
