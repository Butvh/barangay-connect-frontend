<?php

namespace Tests\Feature;

use App\Models\AlertAssignment;
use App\Models\EmergencyAlert;
use App\Models\TanodMembership;
use App\Providers\IntegrationServiceProvider;
use App\Services\Administration\PersonnelAdministration;
use App\Services\Identity\EffectiveIdentity;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedPersonnelAdministrationTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_capacity_counts_inactive_appointments_and_tanod_pool_is_read_only(): void
    {
        $captain = $this->sourceUser('captain');
        $person = $this->sourceUser('secretary', $captain->barangay_id);
        DB::table('personnel_appointments')->where('user_id', $person->id)->update(['status' => 'Inactive']);
        TanodMembership::forceCreate(['user_id' => $person->id, 'barangay_id' => $captain->barangay_id, 'active' => true]);
        $result = app(PersonnelAdministration::class)->list(EffectiveIdentity::fromUser($captain));
        $this->assertSame(['used' => 1, 'limit' => 3, 'available' => 2], $result['capacities']['secretary']);
        $this->assertSame($person->id, $result['tanods'][0]['id']);
        $this->assertSame('Inactive', $result['tanods'][0]['status']);
        $this->assertSame([], $result['activity']);
        $this->assertSame([], $result['records'][0]['requirements']);
    }

    public function test_non_captain_cannot_read_or_mutate_staffing(): void
    {
        $actor = EffectiveIdentity::fromUser($this->sourceUser('secretary'));
        $this->expectException(ApiProblem::class);
        app(PersonnelAdministration::class)->list($actor);
    }

    public function test_capacity_denial_precedes_source_mutation_and_keeps_all_memberships(): void
    {
        $captain = $this->sourceUser('captain');
        for ($i = 0; $i < 3; $i++) {
            $this->sourceUser('secretary', $captain->barangay_id);
        }
        $tanod = $this->sourceUser('resident', $captain->barangay_id);
        TanodMembership::forceCreate(['user_id' => $tanod->id, 'barangay_id' => $captain->barangay_id, 'active' => true]);
        try {
            app(PersonnelAdministration::class)->change(EffectiveIdentity::fromUser($captain), $tanod->id, 'appoint', ['role' => 'secretary',
                'effective_date' => now('Asia/Manila')->format('Y-m-d'), 'expected_revision' => 0]);
            $this->fail('Capacity must reject a fourth Secretary.');
        } catch (ApiProblem $error) {
            $this->assertSame('CAPACITY', $error->errorCode);
        }
        $this->assertSame(0, DB::table('personnel_appointments')->where('user_id', $tanod->id)->count());
        $this->assertSame(0, $tanod->fresh()->auth_version);
        $this->assertTrue($tanod->fresh()->is_resident);
        $this->assertSame(1, DB::table('tanod_memberships')->where('user_id', $tanod->id)->count());
    }

    public function test_actual_appointment_reassignment_removal_preserve_membership_and_revoke_original_identity(): void
    {
        $captain = $this->sourceUser('captain');
        $tanod = $this->sourceUser('resident', $captain->barangay_id);
        TanodMembership::forceCreate(['user_id' => $tanod->id, 'barangay_id' => $captain->barangay_id, 'active' => true]);
        $old = EffectiveIdentity::fromUser($tanod);
        $service = app(PersonnelAdministration::class);
        $actor = EffectiveIdentity::fromUser($captain);
        $date = now('Asia/Manila')->format('Y-m-d');
        $appointed = $service->change($actor, $tanod->id, 'appoint', ['role' => 'responder', 'effective_date' => $date, 'expected_revision' => 0]);
        $this->assertSame('responder', $appointed['role']);
        $this->assertFalse($old->sameAs(EffectiveIdentity::fromUser($tanod->fresh())));
        $reassigned = $service->change($actor, $tanod->id, 'reassign', ['role' => 'rescuer', 'effective_date' => $date, 'expected_revision' => $appointed['revision']]);
        $removed = $service->change($actor, $tanod->id, 'remove', ['effective_date' => $date, 'expected_revision' => $reassigned['revision']]);
        $this->assertNull($removed['role']);
        $this->assertSame('Unassigned', $removed['status']);
        $this->assertSame(['Appointed', 'Reassigned', 'Removed'], array_column($removed['history'], 'action'));
        $this->assertSame('resident', EffectiveIdentity::fromUser($tanod->fresh())->role);
        $this->assertSame(3, $tanod->fresh()->auth_version);
        $this->assertTrue($tanod->fresh()->is_resident);
        $this->assertSame(1, DB::table('tanod_memberships')->where('user_id', $tanod->id)->count());
    }

    public function test_busy_operational_assignment_blocks_role_removal_without_changing_identity_or_history(): void
    {
        $captain = $this->sourceUser('captain');
        $rescuer = $this->sourceUser('rescuer', $captain->barangay_id);
        $resident = $this->sourceUser('resident', $captain->barangay_id);
        $alert = EmergencyAlert::forceCreate(['resident_id' => $resident->id, 'household_id' => $resident->household_id,
            'barangay_id' => $captain->barangay_id, 'alert_type' => 'Flood', 'location_label' => 'Fictional test street', 'status' => 'Rescue in progress', 'reported_at' => now('UTC')]);
        AlertAssignment::forceCreate(['alert_id' => $alert->id, 'barangay_id' => $captain->barangay_id, 'user_id' => $rescuer->id,
            'role' => 'rescuer', 'status' => 'active', 'assigned_by' => $captain->id, 'assigned_at' => now('UTC')]);
        try {
            app(PersonnelAdministration::class)->change(EffectiveIdentity::fromUser($captain), $rescuer->id, 'remove',
                ['effective_date' => now('Asia/Manila')->format('Y-m-d'), 'expected_revision' => 0]);
            $this->fail('Unresolved rescue responsibility must block removal.');
        } catch (ApiProblem $error) {
            $this->assertSame('BUSY', $error->errorCode);
        }
        $this->assertSame(0, $rescuer->fresh()->auth_version);
        $this->assertSame('rescuer', $rescuer->fresh()->appointment->role);
        $this->assertSame(0, DB::table('personnel_history')->where('appointment_id', $rescuer->appointment->id)->count());
    }
}
