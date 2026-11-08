<?php

namespace Tests\Feature;

use App\Models\Facility;
use App\Providers\IntegrationServiceProvider;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Tests\Support\CombinedMysql;
use Tests\TestCase;

final class CombinedFacilityHistoryTest extends TestCase
{
    use CombinedMysql;

    protected function setUp(): void
    {
        parent::setUp();
        $this->combinedMysql();
        config(['integration.test_bindings' => true, 'integration.admin_test_bindings' => true]);
        (new IntegrationServiceProvider($this->app))->register();
    }

    public function test_original_create_retry_edits_pins_and_status_changes_retain_full_immutable_display_history(): void
    {
        $captain = $this->sourceUser('captain');
        DB::table('barangays')->where('id', $captain->barangay_id)->update(['map_scope' => 'sampaguita']);
        $actor = EffectiveIdentity::fromUser($captain);
        $service = app(FacilityAdministration::class);
        $input = ['name' => str_repeat('ñ', 160), 'type' => 'Hospital', 'address' => str_repeat('家', 300), 'contact' => str_repeat('1', 50), 'notes' => str_repeat('🌿', 300)];
        $key = 'facility-history-'.bin2hex(random_bytes(8));
        $first = $service->save($actor, null, $input, $key);
        $this->assertSame($first['id'], $service->save($actor, null, $input, $key)['id']);
        $this->assertCount(1, $first['history']);
        $id = $first['id'];
        $service->save($actor, $id, ['name' => 'Updated facility', 'map_x' => 0, 'map_y' => 100, 'expected_revision' => 0]);
        $service->save($actor, $id, ['status' => 'Inactive', 'expected_revision' => 1]);
        $final = $service->save($actor, $id, ['status' => 'Active', 'expected_revision' => 2]);
        $same = $service->save($actor, $id, ['status' => 'Active', 'expected_revision' => 3]);
        $this->assertCount(4, $same['history']);
        $this->assertSame(['Created', 'Edited', 'Deactivated', 'Reactivated'], array_column($final['history'], 'action'));
        $this->assertSame([0, 1, 2, 3], array_column($final['history'], 'revision'));
        $this->assertSame($input['name'], $final['history'][0]['snapshot']['name']);
        $this->assertNull($final['history'][0]['snapshot']['map_x']);
        $this->assertEquals(0, $final['history'][1]['snapshot']['map_x']);
        $this->assertEquals(100, $final['history'][1]['snapshot']['map_y']);
        $this->assertSame('Inactive', $final['history'][2]['snapshot']['status']);
        $this->assertSame($captain->full_name, $final['history'][3]['by_name']);
        $this->assertSame('captain', $final['history'][3]['role_at_action']);
        $this->assertSame($captain->barangay_id, $final['history'][0]['snapshot']['managed_by_barangay_id']);
    }

    public function test_history_source_audit_outbox_and_create_receipt_rollback_in_the_same_actual_transaction(): void
    {
        $captain = $this->sourceUser('captain');
        $actor = EffectiveIdentity::fromUser($captain);
        $service = app(FacilityAdministration::class);
        $input = ['name' => 'Original facility', 'type' => 'Hospital', 'address' => 'Fictional street'];
        $first = $service->save($actor, null, $input, 'history-before-'.bin2hex(random_bytes(8)));
        $tables = ['facilities', 'facility_history', 'activity_logs', 'outbox_events', 'idempotency_requests'];
        $counts = fn () => array_map(fn ($table) => DB::table($table)->count(), $tables);
        $before = $counts();
        DB::listen(function (QueryExecuted $query): void {
            if (str_starts_with(strtolower($query->sql), 'insert into `outbox_events`') && in_array('facility.updated.v2', $query->bindings, true)) {
                throw new \RuntimeException('fixture-after-real-facility-outbox');
            }
        });
        foreach ([false, true] as $create) {
            try {
                $service->save($actor, $create ? null : $first['id'], $create ? $input : ['name' => 'Must roll back', 'expected_revision' => 0], 'rollback-create-'.bin2hex(random_bytes(8)));
                $this->fail('The injected actual outbox failure must abort the complete source command.');
            } catch (\RuntimeException $failure) {
                $this->assertSame('fixture-after-real-facility-outbox', $failure->getMessage());
            }
            $this->assertSame($before, $counts());
            $this->assertSame(0, (int) DB::table('facilities')->where('id', $first['id'])->value('revision'));
            $this->assertSame('Original facility', DB::table('facilities')->where('id', $first['id'])->value('name'));
        }
    }

    public function test_legacy_history_is_not_fabricated_and_shared_directory_read_reveals_no_manager_history(): void
    {
        $manager = $this->sourceUser('captain');
        $viewer = $this->sourceUser('captain');
        $legacy = Facility::forceCreate(['managed_by_barangay_id' => $manager->barangay_id, 'visibility' => 'shared', 'name' => 'Legacy shared referral', 'type' => 'Hospital', 'address' => 'Fictional street', 'revision' => 7]);
        try {
            $service = app(FacilityAdministration::class);
            $actor = EffectiveIdentity::fromUser($manager);
            $this->assertSame([], $service->get($actor, $legacy->id)['history']);
            $updated = $service->save($actor, $legacy->id, ['name' => 'Recorded new name', 'expected_revision' => 7]);
            $this->assertCount(1, $updated['history']);
            $this->assertSame('Edited', $updated['history'][0]['action']);
            $this->assertSame(8, $updated['history'][0]['revision']);
            $visible = $service->get(EffectiveIdentity::fromUser($viewer), $legacy->id);
            $this->assertFalse($visible['can_manage']);
            $this->assertArrayNotHasKey('history', $visible);
        } finally {
            // End only this fixture's globally visible referral. Immutable
            // history stays retained; no other suite inherits shared visibility.
            DB::table('facilities')->where('id', $legacy->id)->update(['visibility' => 'local']);
        }
    }
}
