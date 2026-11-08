<?php

namespace Tests\Unit;

use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\SourceReferences;
use App\Support\ApiProblem;
use Illuminate\Auth\GenericUser;
use Tests\TestCase;

final class SourceReferenceBoundaryTest extends TestCase
{
    public function test_missing_source_authority_cannot_be_replaced_with_empty_success(): void
    {
        config(['identity.enabled' => false]);
        $actor = EffectiveIdentity::fromUser(new GenericUser([
            'id' => 1, 'barangay_id' => 1, 'is_resident' => true, 'is_captain' => false, 'appointment' => null, 'account_status' => 'Active', 'auth_version' => 0,
        ]));
        $this->expectException(ApiProblem::class);
        (new SourceReferences)->household($actor, 1);
    }
}
