<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Models\Facility;
use App\Providers\IntegrationServiceProvider;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

/** Regression preparation for the proposed PR51 map contract; real MySQL and HTTP. */
final class Pr51MapScopeTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    private function signIn($user, string $role): void
    {
        $this->actingAs($user)->withSession(['identity_role' => $role, 'identity_scope' => $user->barangay_id, 'identity_version' => 0]);
    }

    public function test_public_reference_declares_exact_scope_and_never_equates_unknown_with_available(): void
    {
        $supported = Barangay::forceCreate(['name' => 'Fictional declared artwork', 'map_scope' => 'sampaguita']);
        $unknown = Barangay::forceCreate(['name' => 'Barangay Sampaguita', 'map_scope' => 'unknown-artwork']);
        $missing = Barangay::forceCreate(['name' => 'Barangay Sampaguita', 'map_scope' => null]);
        $rows = $this->getJson('/api/v1/barangays')->assertOk()->json('data');
        $rows = collect($rows)->keyBy('id');
        $this->assertSame('sampaguita', $rows[$supported->id]['map_scope'] ?? null);
        $this->assertSame('unknown-artwork', $rows[$unknown->id]['map_scope'] ?? null);
        $this->assertFalse($rows[$unknown->id]['map_available']);
        $this->assertNull($rows[$missing->id]['map_scope']);
        $this->assertFalse($rows[$missing->id]['map_available']);
    }

    public function test_current_reference_cannot_be_switched_to_another_tenant_by_query_input(): void
    {
        $resident = $this->sourceUser();
        $foreign = Barangay::forceCreate(['name' => 'Foreign declared artwork', 'map_scope' => 'sampaguita']);
        $this->signIn($resident, 'resident');
        $rows = $this->getJson('/api/v1/references/barangays?barangay_id='.$foreign->id.'&map_scope=sampaguita')->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($resident->barangay_id, $rows[0]['id']);
        $this->assertNull($rows[0]['map_scope']);
    }

    public function test_unknown_scope_cannot_accept_a_new_facility_pin(): void
    {
        $captain = $this->sourceUser('captain');
        DB::table('barangays')->where('id', $captain->barangay_id)->update(['map_scope' => 'unknown-artwork']);
        $this->signIn($captain, 'captain');
        $this->postJson('/api/v1/facilities', ['name' => 'Fictional unsupported pin', 'type' => 'Hospital', 'address' => 'Fictional street', 'map_x' => 0, 'map_y' => 100], ['Idempotency-Key' => 'pr51-unknown-'.bin2hex(random_bytes(8))])
            ->assertUnprocessable()->assertJsonPath('fields.map_x', 'Map coverage is not available for this barangay.');
        $this->assertSame(0, Facility::where('managed_by_barangay_id', $captain->barangay_id)->count());
    }

    public function test_supported_non_one_tenant_accepts_zero_edges_and_preserves_http_history_and_stale_revisions(): void
    {
        Barangay::forceCreate(['name' => 'Fictional ID padding']);
        foreach (['captain', 'secretary'] as $role) {
            $user = $this->sourceUser($role);
            $this->assertNotSame(1, $user->barangay_id);
            DB::table('barangays')->where('id', $user->barangay_id)->update(['map_scope' => 'sampaguita']);
            $this->signIn($user, $role);
            $input = ['name' => 'Fictional '.$role.' hospital', 'type' => 'Hospital', 'address' => 'Fictional street', 'map_x' => 0, 'map_y' => 100];
            $key = ['Idempotency-Key' => 'pr51-create-'.bin2hex(random_bytes(8))];
            $row = $this->postJson('/api/v1/facilities', $input, $key)->assertCreated()->json('data');
            $again = $this->postJson('/api/v1/facilities', $input, $key)->assertCreated()->json('data');
            $this->assertSame($row['id'], $again['id']);
            $this->assertSame('sampaguita', $row['map_scope']);
            $this->assertEquals(0, $row['map_x']);
            $this->assertEquals(100, $row['map_y']);
            $url = '/api/v1/facilities/'.$row['id'];
            $this->patchJson($url, ['map_x' => 100, 'map_y' => 0, 'expected_revision' => 0])->assertOk();
            $this->patchJson($url, ['name' => 'Stale write', 'expected_revision' => 0])->assertConflict();
            $this->patchJson($url.'/status', ['status' => 'Inactive', 'expected_revision' => 1])->assertOk();
            $final = $this->patchJson($url.'/status', ['status' => 'Active', 'expected_revision' => 2])->assertOk()->json('data');
            $this->assertSame(['Created', 'Edited', 'Deactivated', 'Reactivated'], array_column($final['history'], 'action'));
            $this->assertEquals(0, $final['history'][0]['snapshot']['map_x']);
            $this->assertEquals(100, $final['history'][0]['snapshot']['map_y']);
            $this->assertSame('sampaguita', $final['history'][0]['snapshot']['map_scope']);
            $this->assertSame(3, $final['revision']);
        }
    }

    public function test_client_cannot_choose_coverage_or_manager_when_creating_a_facility(): void
    {
        $captain = $this->sourceUser('captain');
        $foreign = Barangay::forceCreate(['name' => 'Foreign scope', 'map_scope' => 'sampaguita']);
        $this->signIn($captain, 'captain');
        foreach (['map_scope' => 'sampaguita', 'map_available' => true, 'barangay_id' => $foreign->id, 'managed_by_barangay_id' => $foreign->id] as $field => $value) {
            $this->postJson('/api/v1/facilities', ['name' => 'Forged coverage', 'type' => 'Hospital', 'address' => 'Fictional street', $field => $value], ['Idempotency-Key' => 'pr51-forged-'.bin2hex(random_bytes(8))])->assertUnprocessable();
        }
        $this->assertSame(0, Facility::where('managed_by_barangay_id', $captain->barangay_id)->count());
    }

    public function test_legacy_pin_is_never_relabelled_by_unrelated_edits_and_can_be_explicitly_cleared(): void
    {
        $captain = $this->sourceUser('captain');
        $this->signIn($captain, 'captain');
        $legacy = Facility::forceCreate(['managed_by_barangay_id' => $captain->barangay_id, 'name' => 'Legacy unknown artwork', 'type' => 'Hospital', 'address' => 'Fictional street', 'map_x' => 0, 'map_y' => 100, 'map_scope' => 'legacy-artwork']);
        $url = '/api/v1/facilities/'.$legacy->id;
        $row = $this->patchJson($url, ['name' => 'Unrelated rename', 'map_x' => 0, 'map_y' => 100, 'expected_revision' => 0])->assertOk()->json('data');
        $this->assertSame('legacy-artwork', $row['map_scope']);
        $this->assertEquals(0, $row['map_x']);
        $this->assertEquals(100, $row['map_y']);
        $this->patchJson($url, ['map_x' => 1, 'map_y' => 99, 'expected_revision' => 1])->assertUnprocessable();
        $cleared = $this->patchJson($url, ['map_x' => null, 'map_y' => null, 'expected_revision' => 1])->assertOk()->json('data');
        $this->assertNull($cleared['map_scope']);
        $this->assertNull($cleared['map_x']);
        $this->assertSame('legacy-artwork', $cleared['history'][0]['snapshot']['map_scope']);
        $this->assertSame(2, $cleared['revision']);
    }
}
