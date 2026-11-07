<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Services\Identity\CurrentSmsConsent;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SmsEligibilityReferences;
use App\Support\ApiProblem;
use Illuminate\Http\Request;

final class NotificationPreferenceController extends Controller
{
    private function service(): CurrentSmsConsent
    {
        if (! app()->bound(SmsEligibilityReferences::class)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Current consent integration is unavailable.');
        }

        return app(CurrentSmsConsent::class);
    }

    public function show(Request $request, string $purpose, IdentityReferences $identity)
    {
        return response()->json(['data' => $this->service()->read($identity->current($request), $purpose)])->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, string $purpose, IdentityReferences $identity)
    {
        return response()->json(['data' => $this->service()->change($identity->current($request), $purpose, $request->all())])->header('Cache-Control', 'private, no-store');
    }
}
