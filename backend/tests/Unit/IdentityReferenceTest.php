<?php

namespace Tests\Unit;

use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Support\ApiProblem;
use Illuminate\Auth\GenericUser;
use Illuminate\Http\Request;
use Tests\TestCase;

final class IdentityReferenceTest extends TestCase
{
    private function identity(): EffectiveIdentity
    {
        return EffectiveIdentity::fromUser(new GenericUser(['id' => 42, 'barangay_id' => 7, 'is_captain' => true,
            'account_status' => 'Active', 'auth_version' => 2]));
    }

    public function test_verified_reference_excludes_security_generation_from_json(): void
    {
        config(['identity.enabled' => true]);
        $request = Request::create('/api/v1/test');
        $request->attributes->set('effective_identity', $this->identity());
        $reference = (new IdentityReferences)->current($request);
        $this->assertSame(['id' => 42, 'barangayId' => 7, 'role' => 'captain'], json_decode(json_encode($reference), true));
        $this->assertTrue($reference->matches(['identity_scope' => 7, 'identity_role' => 'captain', 'identity_version' => 2]));
        $this->assertFalse($reference->matches(['identity_scope' => 8, 'identity_role' => 'captain', 'identity_version' => 2]));
    }

    public function test_request_body_cannot_supply_the_authenticated_reference(): void
    {
        config(['identity.enabled' => true]);
        $this->expectException(ApiProblem::class);
        (new IdentityReferences)->current(Request::create('/api/v1/test', 'POST', ['effective_identity' => ['role' => 'captain']]));
    }

    public function test_locked_identity_refuses_to_read_outside_callers_transaction(): void
    {
        $this->expectException(\LogicException::class);
        (new IdentityReferences)->locked($this->identity());
    }

    public function test_unavailable_p1_reference_is_never_a_successful_empty_projection(): void
    {
        $this->expectException(ApiProblem::class);
        (new IdentityReferences)->unavailable('personnel');
    }
}
