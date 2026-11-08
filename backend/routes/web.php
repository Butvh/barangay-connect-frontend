<?php

use Illuminate\Support\Facades\Route;

// Keep session + request-forgery middleware on every API route, including login.
Route::prefix('api/v1')->group(__DIR__.'/api.php');
Route::get('/', fn () => redirect('/frontend/login.html'));
