<?php

namespace Tests\Feature;

use App\Models\Facility;
use App\Providers\IntegrationServiceProvider;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use App\Services\Identity\ProfileAdministration;
use App\Services\Identity\ResidentRegistration;
use App\Support\ApiProblem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

/** Actual P1 source events require the owner-supplied production writer; no substitute. */
final class CombinedAdministrativeTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_profile_is_self_only_and_rejects_authority_injection_without_mutation(): void
    {
        $user = $this->sourceUser('secretary');
        $identity = EffectiveIdentity::fromUser($user);
        $this->actingAs($user)->withSession($identity->sessionSnapshot());
        $this->getJson('/api/v1/profile')->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonMissingPath('data.password');
        $this->patchJson('/api/v1/profile', ['is_captain' => true, 'full_name' => 'Forged'])->assertUnprocessable();
        $this->patchJson('/api/v1/profile', ['address' => 'Official cannot change household through profile'])->assertUnprocessable();
        $this->assertSame($user->full_name, $user->fresh()->full_name);
    }

    public function test_named_mysql_connection_uses_utc_for_actual_consent_and_administrative_deadlines(): void
    {
        $this->assertSame('+00:00', config('database.connections.mysql.timezone'));
        $this->assertSame(0, (int) DB::selectOne('SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), CURRENT_TIMESTAMP()) AS offset_seconds')->offset_seconds);
    }

    public function test_facility_visibility_and_shared_read_never_grant_write_permission(): void
    {
        $captain = $this->sourceUser('captain');
        $resident = $this->sourceUser('resident', $captain->barangay_id);
        $foreign = $this->sourceUser();
        $local = Facility::forceCreate(['managed_by_barangay_id' => $captain->barangay_id, 'name' => 'Inactive local', 'type' => 'Hospital', 'address' => 'Fixture', 'active' => false]);
        $shared = Facility::forceCreate(['managed_by_barangay_id' => $foreign->barangay_id, 'visibility' => 'shared', 'name' => 'Shared referral', 'type' => 'Hospital', 'address' => 'Fixture', 'active' => true]);
        $service = app(FacilityAdministration::class);
        $items = $service->list(EffectiveIdentity::fromUser($resident), ['active_only' => false]);
        $this->assertNotContains($local->id, array_column($items, 'id'));
        $this->assertContains($shared->id, array_column($items, 'id'));
        $this->assertFalse($service->get(EffectiveIdentity::fromUser($captain), $shared->id)['can_manage']);
        $this->expectException(ApiProblem::class);
        $service->save(EffectiveIdentity::fromUser($captain), $shared->id, ['status' => 'Inactive', 'expected_revision' => 0]);
    }

    public function test_actual_profile_change_and_security_event_commit_through_the_production_writer(): void
    {
        $user = $this->sourceUser('secretary');
        $identity = EffectiveIdentity::fromUser($user);
        $profile = app(ProfileAdministration::class);
        $result = $profile->update($identity, ['full_name' => 'Ana Reyes', 'contact_number' => '(02) 8000-0000']);
        $this->assertSame('Ana Reyes', $result['full_name']);
        $this->assertSame(1, DB::table('outbox_events')->where('type', 'profile.updated.v2')->where('resource_id', $user->id)->count());
        $this->actingAs($user->fresh())->withSession($identity->sessionSnapshot());
        $this->postJson('/api/v1/account/password', ['current_password' => 'IntegrationTest123', 'password' => ' NewPassword123 ', 'password_confirmation' => ' NewPassword123 '])
            ->assertOk()->assertJsonPath('data.password_changed', true);
        $this->assertTrue(Hash::check(' NewPassword123 ', $user->fresh()->password));
        $this->assertSame(1, $user->fresh()->auth_version);
        $this->getJson('/api/v1/me')->assertOk();
        $this->assertSame(1, DB::table('outbox_events')->where('type', 'security.updated.v2')->where('resource_id', $user->id)->count());
    }

    public function test_actual_resident_registration_rejects_staff_injection_and_persists_only_resident_with_household(): void
    {
        $area = $this->sourceUser()->barangay_id;
        $input = ['full_name' => 'Maria Santos', 'email' => bin2hex(random_bytes(8)).'@example.invalid', 'password' => ' Registration123 ',
            'barangay_id' => $area, 'household_address' => '14 Riverside Street', 'map_x' => 0, 'map_y' => 0];
        $this->postJson('/api/v1/auth/register', $input + ['is_secretary' => false])->assertUnprocessable();
        $created = app(ResidentRegistration::class)->register($input);
        $this->assertSame('resident', $created['role']);
        $user = DB::table('users')->where('id', $created['id'])->first();
        $this->assertTrue(Hash::check($input['password'], $user->password));
        $this->assertSame(0, (int) $user->is_captain);
        $this->assertSame('14 Riverside Street', DB::table('households')->where('id', $user->household_id)->value('address'));
        $this->assertSame(0, DB::table('verifications')->where('resident_id', $user->id)->count());
    }

    public function test_actual_facility_mutation_revision_status_noop_and_event_are_atomic(): void
    {
        $captain = $this->sourceUser('captain');
        $actor = EffectiveIdentity::fromUser($captain);
        $service = app(FacilityAdministration::class);
        $created = $service->save($actor, null, ['name' => 'Sampaguita Elementary School', 'type' => 'EvacuationCenter', 'address' => 'School Street', 'capacity' => 250]);
        $this->assertTrue($created['can_manage']);
        $updated = $service->save($actor, $created['id'], ['status' => 'Inactive', 'expected_revision' => 0]);
        $this->assertSame(1, $updated['revision']);
        $this->assertSame('Inactive', $updated['status']);
        $before = DB::table('outbox_events')->where('type', 'facility.updated.v2')->where('resource_id', $created['id'])->count();
        $again = $service->save($actor, $created['id'], ['status' => 'Inactive', 'expected_revision' => 1]);
        $this->assertSame(1, $again['revision']);
        $this->assertSame($before, DB::table('outbox_events')->where('type', 'facility.updated.v2')->where('resource_id', $created['id'])->count());
        $this->expectException(ApiProblem::class);
        $service->save($actor, $created['id'], ['name' => 'Stale change', 'expected_revision' => 0]);
    }
}
