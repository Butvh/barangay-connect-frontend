<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Services\Identity\PasswordRecovery;
use App\Support\ApiProblem;
use Illuminate\Http\Request;

final class RecoveryController extends Controller
{
    public function command(Request $request, string $action)
    {
        if (! config('integration.admin_test_bindings')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Recovery integration is awaiting reviewed acceptance.');
        }
        $service = app(PasswordRecovery::class);
        $data = match ($action) {
            'requests' => $service->request($request->all()),
            'verifications' => $service->verify($request->all()),
            'resets' => $service->reset($request->all()),
        };

        return response()->json(['data' => $data])->header('Cache-Control', 'private, no-store');
    }
}
