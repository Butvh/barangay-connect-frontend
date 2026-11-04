<?php

namespace App\Http\Controllers\Identity;

use App\Contracts\Photos\IncidentPhotos;
use App\Http\Controllers\Controller;
use App\Services\Identity\IdentityReferences;
use App\Support\ApiProblem;
use Illuminate\Http\Request;

final class IncidentPhotoController extends Controller
{
    private function service(): IncidentPhotos
    {
        if (! app()->bound(IncidentPhotos::class)) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Private incident photos are awaiting reviewed integration.');
        }

        return app(IncidentPhotos::class);
    }

    public function stage(Request $request, IdentityReferences $identity)
    {
        $service = $this->service();
        if (array_diff(array_keys($request->all()), ['photo']) || ! $request->hasFile('photo') || is_array($request->file('photo'))) {
            throw new ApiProblem('VALIDATION', 422, 'Provide one actual photo and no additional fields.');
        }

        return response()->json(['data' => $service->stage($identity->current($request), $request->file('photo'),
            (string) $request->header('Idempotency-Key', ''))->toArray()], 201)->header('Cache-Control', 'private, no-store');
    }

    public function download(Request $request, int $id, IdentityReferences $identity)
    {
        return $this->service()->download($identity->current($request), $id);
    }
}
