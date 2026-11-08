<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Http\Resources\Identity\UserResource;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Support\ApiProblem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Minimal original-page reads, never a users/households directory or mutation service. */
final class OperationalReferencesController extends Controller
{
    public function __construct(private IdentityReferences $identity, private SourceReferences $sources) {}

    private function own(Request $request): array
    {
        $actor = $this->identity->current($request);
        $this->identity->assertCurrent($actor);

        return (new UserResource(Auth::guard('web')->user()))->resolve($request) + [
            'household' => $actor->role === 'resident' ? $this->sources->household($actor, $actor->id) : null,
            'verification' => $this->sources->ownVerification($actor),
        ];
    }

    public function user(Request $request, string $id): JsonResponse
    {
        if ((string) $this->identity->current($request)->id !== $id) {
            throw new ApiProblem('NOT_FOUND', 404, 'This reference is unavailable.');
        }

        return $this->response($this->own($request));
    }

    public function barangays(Request $request): JsonResponse
    {
        return $this->response([$this->sources->barangay($this->identity->current($request))]);
    }

    public function facilities(Request $request, ?string $id = null): JsonResponse
    {
        $actor = $this->identity->current($request);
        if ($id === null) {
            return $this->response($this->facilityDirectory($request));
        }
        $row = $this->sources->facility($actor, (int) $id);
        if (! $row || ($actor->role === 'resident' && ! $row['is_active'])) {
            throw new ApiProblem('NOT_FOUND', 404, 'This reference is unavailable.');
        }

        return $this->response($row);
    }

    public function revision(Request $request, string $entity): JsonResponse
    {
        $data = match ($entity) {
            'users' => $this->own($request),
            'verification' => $this->sources->ownVerification($this->identity->current($request)),
            'facilities' => $this->facilityDirectory($request),
            'barangays' => $this->sources->barangay($this->identity->current($request)),
        };

        return $this->response(['revision' => hash('sha256', json_encode($data, JSON_THROW_ON_ERROR))]);
    }

    private function facilityDirectory(Request $request): array
    {
        $actor = $this->identity->current($request);
        $rows = $this->sources->facilities($actor);

        // Internal source references retain authorized historical destinations;
        // the resident directory only offers facilities currently in service.
        return $actor->role === 'resident' ? array_values(array_filter($rows, fn ($row) => $row['is_active'])) : $rows;
    }

    private function response(mixed $data): JsonResponse
    {
        return response()->json(['data' => $data, 'meta' => ['server_time' => now('UTC')->toISOString()]]);
    }
}
