<?php

namespace Tests\Database;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\MysqlDbaTestCase;

class ActiveAssignmentConstraintTest extends MysqlDbaTestCase
{
    public function test_duplicate_active_role_is_rejected_by_mysql(): void
    {
        $this->fixtures();
        $assignment = (array) DB::table('alert_assignments')->first();
        unset($assignment['id'], $assignment['active_role']);
        $this->expectException(QueryException::class);
        DB::table('alert_assignments')->insert($assignment);
    }

    public function test_historical_assignments_coexist_but_cross_scope_assignees_are_rejected(): void
    {
        $this->fixtures();
        $assignment = (array) DB::table('alert_assignments')->first();
        unset($assignment['id'], $assignment['active_role']);
        $assignment['status'] = 'completed';
        $before = DB::table('alert_assignments')->where('status', 'completed')->count();
        DB::table('alert_assignments')->insert($assignment);
        DB::table('alert_assignments')->insert($assignment);
        $this->assertSame($before + 2, DB::table('alert_assignments')->where('status', 'completed')->count());
        $assignment['user_id'] = 103;
        $this->expectException(QueryException::class);
        DB::table('alert_assignments')->insert($assignment);
    }

    public function test_zero_coordinates_and_unknown_pair_survive_but_half_pin_fails(): void
    {
        $this->fixtures();
        $this->assertSame('0.0000', DB::table('households')->where('id', 1)->value('map_x'));
        DB::table('households')->where('id', 1)->update(['map_x' => null, 'map_y' => null]);
        $this->expectException(QueryException::class);
        DB::table('households')->where('id', 1)->update(['map_x' => 1]);
    }

    public function test_general_feedback_cannot_acquire_workflow_state(): void
    {
        $this->fixtures();
        $this->expectException(QueryException::class);
        DB::table('community_feedback')->where('kind', 'general')->update(['status' => 'Pending']);
    }

    public function test_current_submission_cannot_point_to_another_application(): void
    {
        $this->fixtures();
        $this->expectException(QueryException::class);
        DB::table('verifications')->where('id', 1)->update(['current_submission_id' => 2]);
    }

    public function test_referenced_users_cannot_be_physically_deleted(): void
    {
        $this->fixtures();
        $this->expectException(QueryException::class);
        DB::table('users')->where('id', 3)->delete();
    }
}
