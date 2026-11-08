<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Services\Identity\IdentityReferences;
use App\Services\Verification\PrivateDocumentUploads;
use App\Services\Verification\VerificationAdministration;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

final class VerificationController extends Controller
{
    public function __construct(private IdentityReferences $identity) {}

    private function service(): VerificationAdministration
    {
        if (! config('integration.admin_test_bindings')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Verification integration is awaiting reviewed acceptance.');
        }

        return app(VerificationAdministration::class);
    }

    private function response(mixed $data, int $status = 200)
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request)
    {
        return $this->response($this->service()->list($this->identity->current($request), $request->only('status')));
    }

    public function show(Request $request, int $id)
    {
        return $this->response($this->service()->get($this->identity->current($request), $id));
    }

    public function submit(Request $request, ?int $id = null)
    {
        $service = $this->service();
        $validId = $request->file('valid_id');
        $proof = $request->file('proof_of_residence');
        if (! $validId instanceof UploadedFile || ! $proof instanceof UploadedFile) {
            throw new ApiProblem('VALIDATION', 422, 'Upload your actual valid ID and proof of residence.');
        }
        $input = $request->except(['valid_id', 'proof_of_residence']);
        // Multipart fields have string representations; accept only the canonical
        // unsigned integer, never decimal/scientific/trailing-junk coercions.
        if (! $request->isJson() && isset($input['expected_revision']) && is_string($input['expected_revision']) && preg_match('/^(0|[1-9][0-9]{0,8})$/D', $input['expected_revision'])) {
            $input['expected_revision'] = (int) $input['expected_revision'];
        }

        return $this->response($service->submit($this->identity->current($request), $id, $input, $validId, $proof, $request->header('Idempotency-Key', '')), $id === null ? 201 : 200);
    }

    public function review(Request $request, int $id)
    {
        return $this->response($this->service()->review($this->identity->current($request), $id, $request->all()));
    }

    public function expire(Request $request)
    {
        return $this->response(['expired' => $this->service()->expireOverdue($this->identity->current($request))]);
    }

    public function download(Request $request, int $id)
    {
        $doc = $this->service()->document($this->identity->current($request), $id);
        $path = app(PrivateDocumentUploads::class)->verified($doc);

        return response()->download($path, $doc->original_name, ['Content-Type' => $doc->mime,
            'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }
}
