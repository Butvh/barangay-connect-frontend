<?php

namespace App\Http\Controllers\Identity;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\ProfileAdministration;
use App\Services\Identity\ResidentRegistration;
use App\Services\Identity\SessionObservation;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class AdministrationController extends Controller
{
    public function __construct(private IdentityReferences $identity) {}

    private function service(string $class): object
    {
        if (! config('integration.admin_test_bindings')) {
            throw new ApiProblem('NOT_AVAILABLE', 503, 'Administration integration is awaiting reviewed acceptance.');
        }

        return app($class);
    }

    private function response(mixed $data, int $status = 200)
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }

    public function barangays()
    {
        $this->service(ResidentRegistration::class);

        return $this->response(DB::connection(config('integration.connection'))->table('barangays')->orderBy('id')->get(['id', 'name', 'map_scope'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'name' => $row->name, 'map_available' => $row->map_scope !== null])->all());
    }

    public function register(Request $request)
    {
        $service = $this->service(ResidentRegistration::class);
        if (Auth::guard('web')->check()) {
            throw new ApiProblem('CONFLICT', 409, 'Sign out before creating a separate resident account.');
        }

        return $this->response($service->register($request->all(), $request->header('Idempotency-Key', '')), 201);
    }

    public function profile(Request $request)
    {
        return $this->response($this->service(ProfileAdministration::class)->get($this->identity->current($request)));
    }

    public function updateProfile(Request $request)
    {
        return $this->response($this->service(ProfileAdministration::class)->update($this->identity->current($request), $request->all()));
    }

    public function household(Request $request)
    {
        return $this->response($this->service(ProfileAdministration::class)->get($this->identity->current($request))['household']);
    }

    public function updateHousehold(Request $request)
    {
        $actor = $this->identity->current($request);
        $input = $request->all();
        if ($actor->role !== 'resident' || array_diff(array_keys($input), ['address', 'map_x', 'map_y', 'expected_revision']) ||
            ! is_int($input['expected_revision'] ?? null) || $input['expected_revision'] < 0) {
            throw new ApiProblem('VALIDATION', 422, 'Use your original household revision and permitted household fields.');
        }
        $revision = $input['expected_revision'];
        unset($input['expected_revision']);

        return $this->response($this->service(ProfileAdministration::class)->update($actor, $input, $revision)['household']);
    }

    public function security(Request $request)
    {
        $this->service(ProfileAdministration::class);
        $this->identity->assertCurrent($this->identity->current($request));

        return $this->response(['password_change_available' => true]);
    }

    public function password(Request $request)
    {
        $actor = $this->identity->current($request);
        $result = $this->service(ProfileAdministration::class)->changePassword($actor, $request->all());
        $user = User::on(config('integration.connection'))->with('appointment')->findOrFail($actor->id);
        Auth::guard('web')->setUser($user);
        $request->session()->regenerate();
        $request->session()->put(EffectiveIdentity::fromUser($user)->sessionSnapshot());
        SessionObservation::rotate($request);

        return $this->response($result);
    }

    public function facilities(Request $request)
    {
        $options = $request->only(['type']);
        $options['active_only'] = $request->boolean('active_only');

        return $this->response($this->service(FacilityAdministration::class)->list($this->identity->current($request), $options));
    }

    public function facility(Request $request, int $id)
    {
        return $this->response($this->service(FacilityAdministration::class)->get($this->identity->current($request), $id));
    }

    public function saveFacility(Request $request, ?int $id = null)
    {
        $allowed = str_ends_with($request->path(), '/status') ? ['status', 'expected_revision'] :
            (str_ends_with($request->path(), '/location') ? ['map_x', 'map_y', 'expected_revision'] : null);
        if ($allowed && array_diff(array_keys($request->all()), $allowed)) {
            throw new ApiProblem('VALIDATION', 422, 'Use only the fields allowed by this facility action.');
        }

        return $this->response($this->service(FacilityAdministration::class)->save($this->identity->current($request), $id, $request->all(), $request->header('Idempotency-Key')), $id === null ? 201 : 200);
    }
}
