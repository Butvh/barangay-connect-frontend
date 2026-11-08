<?php

namespace Tests\Feature;

use App\Models\CapacityGuard;
use App\Models\Facility;
use App\Models\Verification;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\IdentityReferences;
use App\Services\Identity\SourceReferences;
use App\Support\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedReferencesTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
    }

    public function test_household_and_approval_are_minimal_scoped_real_projections(): void
    {
        $user = $this->sourceUser();
        $actor = EffectiveIdentity::fromUser($user);
        $refs = new SourceReferences;
        $home = $refs->household($actor, $user->id);
        $this->assertSame(0.0, $home['map_x']);
        $this->assertSame(0.0, $home['map_y']);
        $this->assertSame($user->household_id, $home['id']);
        $this->assertArrayNotHasKey('email', $home);
        $this->assertFalse($refs->approved($actor, $user->id));
        Verification::forceCreate(['resident_id' => $user->id, 'barangay_id' => $user->barangay_id, 'review_status' => 'Approved']);
        $this->assertTrue($refs->approved($actor, $user->id));
        $other = $this->sourceUser('resident', $user->barangay_id);
        $this->expectException(ApiProblem::class);
        $refs->household($actor, $other->id);
    }

    public function test_admin_scope_does_not_authorize_other_barangay_households(): void
    {
        $actor = EffectiveIdentity::fromUser($this->sourceUser('captain'));
        $other = $this->sourceUser();
        try {
            (new SourceReferences)->household($actor, $other->id);
            $this->fail('Cross-scope household leaked.');
        } catch (ApiProblem $problem) {
            $this->assertSame(404, $problem->status);
        }
    }

    public function test_shared_facility_visibility_is_safe_and_does_not_imply_write_authority(): void
    {
        $actor = EffectiveIdentity::fromUser($this->sourceUser());
        $other = $this->sourceUser();
        foreach (['local', 'shared'] as $visibility) {
            Facility::forceCreate(['managed_by_barangay_id' => $other->barangay_id, 'visibility' => $visibility,
                'name' => 'Fictional '.$visibility, 'type' => 'Hospital', 'address' => 'Fictional address', 'contact' => 'Unavailable',
                'active' => false, 'notes' => 'Private internal note']);
        }
        $rows = (new SourceReferences)->facilities($actor);
        $this->assertCount(1, $rows);
        $this->assertFalse($rows[0]['is_active']);
        $this->assertSame('shared', $rows[0]['visibility']);
        $this->assertSame($other->barangay_id, $rows[0]['managed_by_barangay_id']);
        $this->assertArrayNotHasKey('notes', $rows[0]);
    }

    public function test_reports_receive_safe_personnel_and_verification_fields_only(): void
    {
        $captain = $this->sourceUser('captain');
        $staff = $this->sourceUser('responder', $captain->barangay_id);
        $refs = new SourceReferences;
        $rows = $refs->personnel(EffectiveIdentity::fromUser($captain));
        $this->assertCount(1, $rows);
        $this->assertSame($staff->id, $rows[0]['user_id']);
        $this->assertArrayNotHasKey('password', $rows[0]);
        $this->assertArrayNotHasKey('email', $rows[0]);
        $this->assertSame([], $refs->verifications(EffectiveIdentity::fromUser($captain)));
        $this->expectException(ApiProblem::class);
        $refs->personnel(EffectiveIdentity::fromUser($staff));
    }

    public function test_captured_request_generation_survives_until_locked_comparison(): void
    {
        $user = $this->sourceUser();
        $request = Request::create('/api/v1/test');
        $observed = EffectiveIdentity::fromUser($user);
        $request->attributes->set('effective_identity', $observed);
        $gateway = new IdentityReferences;
        $captured = $gateway->current($request);
        DB::table('users')->where('id', $user->id)->increment('auth_version');
        $this->assertSame($observed, $captured);
        $this->expectException(ApiProblem::class);
        DB::transaction(function () use ($user, $gateway, $captured) {
            CapacityGuard::lockPeople([$user->id]);
            $gateway->locked($captured);
        });
    }

    public function test_locked_projection_rejects_stale_generation_without_recreating_the_actor(): void
    {
        $user = $this->sourceUser();
        $actor = EffectiveIdentity::fromUser($user);
        DB::table('users')->where('id', $user->id)->increment('auth_version');
        $this->expectException(ApiProblem::class);
        DB::transaction(function () use ($user, $actor) {
            CapacityGuard::lockPeople([$user->id]);
            (new SourceReferences)->household($actor, $user->id, locked: true);
        });
    }

    public function test_generation_check_uses_a_current_read_after_an_older_snapshot(): void
    {
        $user = $this->sourceUser();
        $observed = EffectiveIdentity::fromUser($user);
        config(['database.connections.p1_competing' => config('database.connections.mysql')]);
        $other = DB::connection('p1_competing');
        try {
            $this->expectException(ApiProblem::class);
            DB::transaction(function () use ($user, $observed, $other) {
                DB::table('users')->where('id', $user->id)->first(); // Establish the old repeatable-read snapshot.
                $other->table('users')->where('id', $user->id)->increment('auth_version');
                CapacityGuard::lockPeople([$user->id]);
                (new IdentityReferences)->locked($observed);
            });
        } finally {
            DB::disconnect('p1_competing');
        }
    }

    public function test_operational_private_households_require_a_real_incident_policy_adapter(): void
    {
        $operator = $this->sourceUser('rescuer');
        $resident = $this->sourceUser('resident', $operator->barangay_id);
        try {
            (new SourceReferences)->household(EffectiveIdentity::fromUser($operator), $resident->id);
            $this->fail('An unbound incident policy must not authorize a household.');
        } catch (ApiProblem $problem) {
            $this->assertSame(503, $problem->status);
        }
    }
}
