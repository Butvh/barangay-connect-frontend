<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Services\Administration\PersonnelAdministration;
use App\Services\Identity\IdentityReferences;
use App\Services\Verification\PrivateDocumentUploads;
use App\Support\ApiProblem;
use Illuminate\Http\Request;

final class PersonnelController extends Controller
{
    public function __construct(private IdentityReferences $identity) {}

    private function service(): PersonnelAdministration
    {
        if (! config('integration.admin_test_bindings')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Personnel integration is awaiting reviewed acceptance.');
        }

        return app(PersonnelAdministration::class);
    }

    private function response(mixed $data, int $status = 200)
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request)
    {
        return $this->response($this->service()->list($this->identity->current($request)));
    }

    public function show(Request $request, int $id)
    {
        return $this->response($this->service()->get($this->identity->current($request), $id));
    }

    public function create(Request $request)
    {
        $files = $request->file('requirements', []);
        if (! is_array($files) || ($request->has('requirements') && ! $files)) {
            throw new ApiProblem('VALIDATION', 422, 'Upload actual requirement files rather than file metadata.');
        }

        return $this->response($this->service()->addExternal($this->identity->current($request), $request->except('requirements'),
            $files, $request->header('Idempotency-Key', '')), 201);
    }

    public function change(Request $request, int $id, string $action)
    {
        return $this->response($this->service()->change($this->identity->current($request), $id, $action, $request->all()));
    }

    public function download(Request $request, int $id)
    {
        $doc = $this->service()->document($this->identity->current($request), $id);

        return response()->download(app(PrivateDocumentUploads::class)->verified($doc), $doc->original_name,
            ['Content-Type' => $doc->mime, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }
}
