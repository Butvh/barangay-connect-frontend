<?php

namespace Tests\Database;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class RelationalIntegrityTest extends MysqlDbaTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->fixtures();
    }

    public function test_one_current_appointment_per_user(): void
    {
        $row = (array) DB::table('personnel_appointments')->first();
        unset($row['id']);
        $this->expectException(QueryException::class);
        DB::table('personnel_appointments')->insert($row);
    }

    public function test_negative_or_excessive_victim_count_is_rejected(): void
    {
        $this->assertNull(DB::table('emergency_alerts')->where('id', 2)->value('victim_count'));
        $this->expectException(QueryException::class);
        DB::table('emergency_alerts')->where('id', 1)->update(['victim_count' => 10000]);
    }

    public function test_coordinates_outside_image_bounds_are_rejected(): void
    {
        $this->expectException(QueryException::class);
        DB::table('households')->where('id', 1)->update(['map_x' => 100.0001, 'map_y' => 50]);
    }

    public function test_documents_have_exactly_one_scoped_owner(): void
    {
        $this->expectException(QueryException::class);
        DB::table('documents')->where('id', 1)->update(['appointment_id' => 1]);
    }

    public function test_active_verification_application_uniqueness_is_enforced(): void
    {
        $this->expectException(QueryException::class);
        DB::table('verifications')->insert(['resident_id' => 5, 'barangay_id' => 1, 'review_status' => 'Pending']);
    }

    public function test_cross_tenant_household_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        DB::table('users')->where('id', 5)->update(['household_id' => 2]);
    }

    public function test_cross_tenant_event_recipient_is_rejected(): void
    {
        $event = $this->event();
        $this->expectException(QueryException::class);
        DB::table('outbox_recipients')->insert(['outbox_event_id' => $event->id, 'recipient_id' => 101, 'barangay_id' => 1]);
    }

    public function test_new_response_requires_explicit_boolean_and_assignment(): void
    {
        $this->expectException(QueryException::class);
        DB::table('alert_responses')->insert(['alert_id' => 1, 'responder_id' => 3, 'response_type' => 'Assessment', 'response_status' => 'Completed']);
    }

    public function test_email_case_and_rating_constraints(): void
    {
        $this->expectException(QueryException::class);
        DB::table('users')->where('id', 1)->update(['email' => 'UPPER@example.invalid']);
    }

    public function test_rating_out_of_range_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        DB::table('community_feedback')->where('kind', 'general')->update(['rating' => 6]);
    }
}
