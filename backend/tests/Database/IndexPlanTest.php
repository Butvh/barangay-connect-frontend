<?php

namespace Tests\Database;

use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class IndexPlanTest extends MysqlDbaTestCase
{
    public function test_ready_delivery_and_scoped_incident_indexes_on_synthetic_volume(): void
    {
        $this->fixtures();
        $at = now()->format('Y-m-d H:i:s');
        // One resolved historical incident per synthetic user is unnecessary: resolved rows can share a reporter.
        for ($chunk = 0; $chunk < 20; $chunk++) {
            $rows = [];
            for ($i = 0; $i < 250; $i++) {
                $rows[] = ['barangay_id' => 1, 'resident_id' => 5, 'household_id' => 1, 'alert_type' => 'Other', 'location_label' => 'Fictional district', 'status' => 'Resolved', 'reported_at' => $at];
            }
            DB::table('emergency_alerts')->insert($rows);
        }
        DB::statement('ANALYZE TABLE emergency_alerts');
        $plan = DB::select("EXPLAIN SELECT id FROM emergency_alerts WHERE barangay_id = 1 AND status = 'Pending' AND reported_at >= ?", [$at]);
        $this->assertSame('emergency_alerts_barangay_id_status_reported_at_index', $plan[0]->key);
        $this->assertLessThan(100, (int) $plan[0]->rows);
        $outbox = DB::select('EXPLAIN SELECT id FROM outbox_events WHERE dispatched_at IS NULL AND next_attempt_at IS NULL');
        $this->assertStringContainsString('outbox_ready_index', $outbox[0]->possible_keys ?? '');
    }
}
