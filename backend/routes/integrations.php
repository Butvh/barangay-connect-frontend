<?php

use App\Http\Controllers\Integrations\MakeSmsCommandController;
use Illuminate\Support\Facades\Route;

// P1 loads this inside the /api/v1 stateless API group; bearer auth is checked by FormRequest.
Route::post('integrations/make/sms-commands', MakeSmsCommandController::class)->middleware('throttle:30,1');
