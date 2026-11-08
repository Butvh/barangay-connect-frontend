<?php

use App\Support\ApiProblem;
use Illuminate\Support\Facades\Route;

require __DIR__.'/identity.php';

if (is_file(__DIR__.'/civic-admin.php')) {
    require __DIR__.'/civic-admin.php';
}

Route::middleware('current.identity')->group(function (): void {
    if (config('integration.p2_enabled')) {
        foreach (['operations.php', 'communications.php', 'reports.php'] as $file) {
            if (! is_file(__DIR__.'/'.$file)) {
                throw new LogicException('A reviewed P2 route fragment is missing.');
            }
            require __DIR__.'/'.$file;
        }
    } else {
        // Explicit unavailable responses; no P2 business logic or fake empty DTOs.
        Route::any('{module}/{remainder?}', fn () => throw new ApiProblem(
            'NOT_AVAILABLE', 503, 'This backend module is awaiting reviewed integration.',
        ))->where('module', 'dashboard|map|nearby-alerts|alerts|assignments|announcements|feedback|notifications|reports|revisions')
            ->where('remainder', '.*');
    }
});
