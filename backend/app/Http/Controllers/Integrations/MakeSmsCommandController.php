<?php

namespace App\Http\Controllers\Integrations;

use App\Http\Requests\Integrations\MakeSmsCommandRequest;
use App\Services\Messaging\MakeSmsCommandService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class MakeSmsCommandController extends Controller
{
    public function __invoke(MakeSmsCommandRequest $request, MakeSmsCommandService $service): JsonResponse
    {
        try {
            $created = $service->accept($request->validated());
        } catch (HttpException $e) {
            return response()->json(['code' => $e->getStatusCode() === 409 ? 'CONFLICT' : 'FORBIDDEN', 'message' => $e->getMessage(), 'fields' => (object) [], 'request_id' => (string) Str::uuid()], $e->getStatusCode());
        }

        return response()->json(['data' => ['event_id' => $request->validated('event_id'), 'accepted' => true, 'duplicate' => ! $created]], 202);
    }
}
