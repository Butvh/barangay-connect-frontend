<?php

namespace Tests\Database;

use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Models\CommunityFeedback;
use App\Services\P2\Persistence\TypedAuditRecorder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\MysqlDbaTestCase;

class GeneralFeedbackLifecycleTest extends MysqlDbaTestCase
{
    private function expansion(): object
    {
        return require __DIR__.'/../../database/migrations/2026_11_08_000100_add_general_feedback_lifecycle.php';
    }

    private function general(): object
    {
        return DB::table('community_feedback')->where('kind', 'general')->orderBy('id')->first();
    }

    public function test_populated_upgrade_preserves_full_legacy_content_and_does_not_invent_markers(): void
    {
        $this->fixtures();
        $this->expansion()->down();
        $id = $this->general()->id;
        DB::table('community_feedback')->where('id', $id)->update(['comment' => str_repeat('界', 2000), 'rating' => 5, 'revision' => 7]);
        $columns = Schema::getColumnListing('community_feedback');
        $before = DB::table('community_feedback')->orderBy('id')->get($columns)->toJson();
        $this->expansion()->up();
        $this->expansion()->up();
        $this->assertSame($before, DB::table('community_feedback')->orderBy('id')->get($columns)->toJson());
        $this->assertSame(0, DB::table('community_feedback')->whereNotNull('reviewed_by')->orWhereNotNull('reviewed_at')->orWhereNotNull('archived_by')->orWhereNotNull('archived_at')->count());
        $this->assertSame(0, DB::table('activity_logs')->count());
        $this->assertSame(0, DB::table('outbox_events')->count());
    }

    public function test_direct_archive_without_review_and_model_relationships_retain_the_original_submission(): void
    {
        $this->fixtures();
        $row = $this->general();
        DB::table('community_feedback')->where('id', $row->id)->update(['archived_by' => 1, 'archived_at' => '2026-11-08 12:00:00.123456']);
        $model = CommunityFeedback::findOrFail($row->id);
        $this->assertNull($model->reviewed_at);
        $this->assertNull($model->status);
        $this->assertSame($row->comment, $model->comment);
        $this->assertSame($row->rating, $model->rating);
        $this->assertSame('2026-11-08 12:00:00.123456', $model->archived_at->format('Y-m-d H:i:s.u'));
        $this->assertSame(1, $model->archiver->id);
        $this->assertNull($model->reviewer);
    }

    public static function invalidMarkers(): array
    {
        return [
            'review actor without time' => [['reviewed_by' => 1]],
            'review time without actor' => [['reviewed_at' => '2026-11-08 10:00:00']],
            'archive actor without time' => [['archived_by' => 1]],
            'archive time without actor' => [['archived_at' => '2026-11-08 10:00:00']],
            'orphan review actor' => [['reviewed_by' => 999999, 'reviewed_at' => '2026-11-08 10:00:00']],
            'foreign review actor' => [['reviewed_by' => 101, 'reviewed_at' => '2026-11-08 10:00:00']],
            'foreign archive actor' => [['archived_by' => 101, 'archived_at' => '2026-11-08 10:00:00']],
            'archive before recorded review' => [['reviewed_by' => 1, 'reviewed_at' => '2026-11-08 11:00:00', 'archived_by' => 2, 'archived_at' => '2026-11-08 10:00:00']],
        ];
    }

    #[DataProvider('invalidMarkers')]
    public function test_mysql_rejects_invalid_markers_without_changing_the_submission(array $patch): void
    {
        $this->fixtures();
        $row = $this->general();
        try {
            DB::table('community_feedback')->where('id', $row->id)->update($patch);
            $this->fail('Invalid lifecycle metadata must be rejected.');
        } catch (QueryException $error) {
            $this->assertContains((int) $error->errorInfo[1], [1452, 3819]);
        }
        $this->assertSame((array) $row, (array) $this->general());
    }

    public function test_operational_feedback_cannot_acquire_general_markers(): void
    {
        $this->fixtures();
        foreach (['complaint', 'suggestion'] as $kind) {
            $row = DB::table('community_feedback')->where('kind', $kind)->first();
            try {
                DB::table('community_feedback')->where('id', $row->id)->update(['reviewed_by' => 1, 'reviewed_at' => '2026-11-08 10:00:00']);
                $this->fail('Operational feedback must retain its own workflow.');
            } catch (QueryException $error) {
                $this->assertSame(3819, (int) $error->errorInfo[1]);
            }
            $this->assertSame((array) $row, (array) DB::table('community_feedback')->where('id', $row->id)->first());
        }
    }

    public function test_actor_references_and_recorded_audit_survive_appointment_role_changes(): void
    {
        $this->fixtures();
        $row = $this->general();
        $name = DB::table('users')->where('id', 2)->value('full_name');
        DB::transaction(function () use ($row) {
            DB::table('community_feedback')->where('id', $row->id)->update(['reviewed_by' => 2, 'reviewed_at' => now(), 'revision' => 1]);
            (new TypedAuditRecorder)->record(2, 'secretary', 1,
                new ResourceReference('feedback', $row->id), 'General feedback reviewed',
                new AuditSummary(['revision' => 1]));
        });
        $audit = (array) DB::table('activity_logs')->sole();
        // Persistence-only role-change simulation; P2/P1 exercise the real staff command and identity race.
        DB::table('personnel_appointments')->where('user_id', 2)->update(['role' => 'responder']);
        $this->assertSame(2, CommunityFeedback::findOrFail($row->id)->reviewer->id);
        $this->assertSame($audit, (array) DB::table('activity_logs')->sole());
        $this->assertSame('secretary', $audit['role_at_action']);
        $this->assertSame($name, $audit['actor_name']);
    }

    public function test_unused_rollback_preserves_legacy_rows_but_recorded_markers_refuse_rollback(): void
    {
        $this->fixtures();
        $row = $this->general();
        $columns = array_values(array_diff(Schema::getColumnListing('community_feedback'), ['reviewed_by', 'reviewed_at', 'archived_by', 'archived_at']));
        $before = DB::table('community_feedback')->orderBy('id')->get($columns)->toJson();
        $this->expansion()->down();
        $this->assertFalse(Schema::hasColumn('community_feedback', 'reviewed_by'));
        $this->assertSame($before, DB::table('community_feedback')->orderBy('id')->get($columns)->toJson());
        $this->expansion()->up();
        DB::table('community_feedback')->where('id', $row->id)->update(['archived_by' => 1, 'archived_at' => now()]);
        $recorded = DB::table('community_feedback')->orderBy('id')->get()->toJson();
        try {
            $this->expansion()->down();
            $this->fail('Recorded archive metadata must survive rollback attempts.');
        } catch (\LogicException $error) {
            $this->assertSame('feedback_lifecycle_retained', $error->getMessage());
        }
        $this->assertSame($recorded, DB::table('community_feedback')->orderBy('id')->get()->toJson());
        $this->assertTrue(Schema::hasColumn('community_feedback', 'archived_by'));
    }

    public function test_compatible_partial_ddl_is_completed_without_rewriting_rows(): void
    {
        $this->fixtures();
        $this->expansion()->down();
        $before = DB::table('community_feedback')->orderBy('id')->get()->toJson();
        DB::statement('ALTER TABLE community_feedback ADD reviewed_by BIGINT UNSIGNED NULL');
        $this->expansion()->up();
        $this->assertTrue(Schema::hasColumn('community_feedback', 'archived_at'));
        $columns = array_values(array_diff(Schema::getColumnListing('community_feedback'), ['reviewed_by', 'reviewed_at', 'archived_by', 'archived_at']));
        $this->assertSame($before, DB::table('community_feedback')->orderBy('id')->get($columns)->toJson());
        $row = $this->general();
        DB::table('community_feedback')->where('id', $row->id)->update(['archived_by' => 1, 'archived_at' => now()]);
        $this->expansion()->up();
        $this->assertSame(1, CommunityFeedback::findOrFail($row->id)->archiver->id);
    }

    public function test_incompatible_partial_column_is_rejected_before_other_schema_or_row_changes(): void
    {
        $this->fixtures();
        $this->expansion()->down();
        DB::statement('ALTER TABLE community_feedback ADD reviewed_by BIGINT NULL');
        $before = DB::table('community_feedback')->orderBy('id')->get()->toJson();
        try {
            $this->expansion()->up();
            $this->fail('A signed actor column must not be silently adopted.');
        } catch (\LogicException $error) {
            $this->assertSame('feedback_lifecycle_incompatible_column', $error->getMessage());
            $this->assertFalse(Schema::hasColumn('community_feedback', 'archived_at'));
            $this->assertSame($before, DB::table('community_feedback')->orderBy('id')->get()->toJson());
        } finally {
            // Explicit repair of this test's deliberately incompatible disposable column only.
            DB::statement('ALTER TABLE community_feedback MODIFY reviewed_by BIGINT UNSIGNED NULL');
            $this->expansion()->up();
        }
    }

    public function test_archive_actor_foreign_key_restricts_deletion_without_an_appointment_dependency(): void
    {
        $this->fixtures();
        $actor = DB::table('users')->insertGetId(['barangay_id' => 1, 'full_name' => 'Fictional archive actor',
            'email' => 'archive-actor@example.invalid', 'password' => password_hash('Fictional fixture', PASSWORD_BCRYPT, ['cost' => 4]), 'is_captain' => true]);
        DB::table('community_feedback')->where('id', $this->general()->id)->update(['archived_by' => $actor, 'archived_at' => now()]);
        try {
            DB::table('users')->where('id', $actor)->delete();
            $this->fail('Recorded archive actor must be retained.');
        } catch (QueryException $error) {
            $this->assertSame(1451, (int) $error->errorInfo[1]);
            $this->assertStringContainsString('feedback_archive_actor_scope_fk', $error->errorInfo[2]);
        }
        $this->assertSame(0, DB::table('personnel_appointments')->where('user_id', $actor)->count());
        $this->assertSame($actor, CommunityFeedback::findOrFail($this->general()->id)->archiver->id);
    }

    public function test_active_general_queue_uses_the_scoped_index_on_realistic_archived_history(): void
    {
        $this->fixtures();
        for ($chunk = 0; $chunk < 12; $chunk++) {
            $rows = [];
            for ($i = 0; $i < 250; $i++) {
                $archived = $i < 240;
                $rows[] = ['barangay_id' => 1, 'resident_id' => 5, 'kind' => 'general', 'rating' => 4,
                    'comment' => 'Fictional retained queue history', 'submitted_at' => '2026-11-08 10:00:00',
                    'archived_by' => $archived ? 1 : null, 'archived_at' => $archived ? '2026-11-08 11:00:00' : null];
            }
            DB::table('community_feedback')->insert($rows);
        }
        DB::statement('ANALYZE TABLE community_feedback');
        $plan = DB::select("EXPLAIN SELECT id,comment,rating FROM community_feedback WHERE barangay_id=1 AND kind='general' AND archived_at IS NULL ORDER BY submitted_at DESC,id DESC LIMIT 25")[0];
        $this->assertSame('feedback_general_queue', $plan->key);
        $this->assertLessThan(500, (int) $plan->rows);
        $this->assertSame(2880, DB::table('community_feedback')->where('barangay_id', 1)->whereNotNull('archived_at')->count());
    }
}
