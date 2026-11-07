<?php

namespace Tests\Feature;

use App\Models\Facility;
use App\Models\Verification;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedOperationalReferencesTest extends TestCase
{
    use CombinedMysql;

    public function test_original_report_reads_only_own_household_and_latest_verification(): void
    {
        $this->combinedMysql();
        $user = $this->sourceUser();
        $other = $this->sourceUser('resident', $user->barangay_id);
        Verification::forceCreate(['resident_id' => $user->id, 'barangay_id' => $user->barangay_id, 'review_status' => 'Approved']);
        $this->actingAs($user)->withSession(['identity_role' => 'resident', 'identity_scope' => $user->barangay_id, 'identity_version' => 0]);
        $data = $this->getJson('/api/v1/references/users/'.$user->id)->assertOk()
            ->assertJsonPath('data.household.address', 'Fictional reference street')->assertJsonPath('data.verification.review_status', 'Approved')->json('data');
        foreach (['password', 'remember_token', 'auth_version'] as $field) {
            $this->assertArrayNotHasKey($field, $data);
        }
        $this->getJson('/api/v1/references/users/'.$other->id)->assertNotFound();
        $this->getJson('/api/v1/references/barangays')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $user->barangay_id);
        $first = $this->getJson('/api/v1/references/revisions/users')->assertOk()->json('data.revision');
        $this->assertSame($first, $this->getJson('/api/v1/references/revisions/users')->assertOk()->json('data.revision'));
    }

    public function test_facility_reader_is_scoped_and_administrative_mutations_stay_unavailable(): void
    {
        $this->combinedMysql();
        $user = $this->sourceUser('rescuer');
        $other = $this->sourceUser();
        $visible = Facility::forceCreate(['managed_by_barangay_id' => $user->barangay_id, 'name' => 'Visible fixture', 'type' => 'Hospital', 'address' => 'Fixture', 'contact' => '(02) 8000-0000', 'active' => true]);
        $hidden = Facility::forceCreate(['managed_by_barangay_id' => $other->barangay_id, 'name' => 'Hidden fixture', 'type' => 'Hospital', 'address' => 'Fixture', 'active' => true]);
        $this->actingAs($user)->withSession(['identity_role' => 'rescuer', 'identity_scope' => $user->barangay_id, 'identity_version' => 0]);
        $ids = array_column($this->getJson('/api/v1/references/facilities')->assertOk()->json('data'), 'id');
        $this->assertContains($visible->id, $ids);
        $this->assertNotContains($hidden->id, $ids);
        $this->getJson('/api/v1/references/facilities/'.$visible->id)->assertOk()->assertJsonPath('data.contact_number', '(02) 8000-0000');
        $this->getJson('/api/v1/references/facilities/'.$hidden->id)->assertNotFound();
        $this->postJson('/api/v1/references/facilities', [])->assertStatus(405);
        $this->getJson('/api/v1/references/revisions/personnel')->assertNotFound();
    }
}
