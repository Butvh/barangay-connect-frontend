<?php

namespace Tests\Database;

use App\Models\IncidentPhoto;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\MysqlDbaTestCase;

/** Retained candidate cases now exercise the agreed additive migration. */
class IncidentPhotoProposalTest extends MysqlDbaTestCase
{
    private $proposal;

    protected function setUp(): void
    {
        parent::setUp();
        $this->proposal = require __DIR__.'/../../database/proposals/incident-photo-metadata.php';
        DB::table('barangays')->insert([['id' => 1, 'name' => 'Fictional photo scope'], ['id' => 2, 'name' => 'Other fictional scope']]);
        DB::table('households')->insert([['id' => 1, 'barangay_id' => 1, 'address' => 'Fictional'], ['id' => 2, 'barangay_id' => 2, 'address' => 'Fictional']]);
        foreach ([15 => 1, 16 => 1, 105 => 2] as $id => $scope) {
            DB::table('users')->insert(['id' => $id, 'barangay_id' => $scope, 'household_id' => $scope, 'full_name' => 'Fictional photo uploader', 'email' => 'photo-'.$id.'@example.invalid', 'password' => 'unusable-fictional-only', 'is_resident' => true]);
            DB::table('emergency_alerts')->insert(['id' => $id, 'barangay_id' => $scope, 'resident_id' => $id, 'household_id' => $scope, 'alert_type' => 'Other', 'location_label' => 'Fictional', 'reported_at' => '2026-11-03 00:00:00']);
        }
        $this->proposal->up();
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->proposal) && Schema::hasTable('incident_photos')) {
                DB::table('incident_photos')->delete();
            }
        } finally {
            parent::tearDown();
        }
    }

    private function ready(array $patch = []): array
    {
        return array_replace(['upload_id' => (string) Str::uuid(), 'barangay_id' => 1, 'uploader_id' => 15, 'uploader_auth_version' => 0,
            'intent_digest' => bin2hex(random_bytes(32)), 'disk' => 'private_incident_photos', 'object_key' => 'incident-photos/aa/'.bin2hex(random_bytes(32)),
            'input_sha256' => str_repeat('b', 64), 'mime' => 'image/jpeg', 'bytes' => 123, 'sha256' => str_repeat('a', 64), 'state' => 'ready', 'created_at' => '2026-11-03 00:00:00.000001',
            'uploaded_at' => '2026-11-03 00:00:00.000002', 'updated_at' => '2026-11-03 00:00:00.000002', 'expires_at' => '2026-11-04 00:00:00.000001'], $patch);
    }

    public function test_seeded_additive_migration_preserves_existing_records_and_is_auto_discovered(): void
    {
        $this->proposal->down();
        $this->assertFalse(Schema::hasTable('incident_photos'));
        $this->proposal->up();
        $this->assertSame(3, DB::table('emergency_alerts')->count());
        $this->assertSame(3, DB::table('users')->count());
        $this->assertCount(9, glob(__DIR__.'/../../database/migrations/*.php'));
        $this->assertSame('InnoDB', DB::selectOne("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='incident_photos'")->ENGINE);
        $this->assertSame(1, DB::selectOne("SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='incident_photos' AND INDEX_NAME='photo_expiry_scan' AND SEQ_IN_INDEX=1")->n);
    }

    #[DataProvider('invalidRows')]
    public function test_candidate_database_rejects_invalid_metadata(array $patch): void
    {
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->insert($this->ready($patch));
    }

    public static function invalidRows(): array
    {
        return [
            'foreign uploader' => [['uploader_id' => 105]],
            'foreign incident' => [['state' => 'attached', 'incident_id' => 105, 'attached_at' => '2026-11-03 01:00:00']],
            'different resident incident' => [['state' => 'attached', 'incident_id' => 16, 'attached_at' => '2026-11-03 01:00:00']],
            'malformed token' => [['upload_id' => str_repeat('a', 32)]],
            'unsafe path' => [['object_key' => '../private/photo.jpg']],
            'public disk' => [['disk' => 'public']],
            'unsupported detected mime' => [['mime' => 'image/svg+xml']],
            'empty bytes' => [['bytes' => 0]],
            'oversize bytes' => [['bytes' => 10485761]],
            'invalid hash' => [['sha256' => str_repeat('z', 64)]],
            'invalid input hash' => [['input_sha256' => str_repeat('z', 64)]],
            'missing input hash' => [['input_sha256' => null]],
            'output without upload time' => [['uploaded_at' => null]],
            'uninspected output timestamp' => [['state' => 'processing', 'mime' => null, 'bytes' => null, 'sha256' => null]],
            'negative captured generation' => [['uploader_auth_version' => -1]],
            'attached without incident' => [['state' => 'attached', 'attached_at' => '2026-11-03 01:00:00']],
            'ready with incident' => [['incident_id' => 15]],
            'expired attachment' => [['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-04 01:00:00']],
            'invalid expiry' => [['expires_at' => '2026-11-02 00:00:00']],
            'overlong lifetime' => [['expires_at' => '2026-11-05 00:00:00']],
            'ready missing inspection' => [['mime' => null, 'bytes' => null, 'sha256' => null]],
            'removing without claim' => [['state' => 'removing']],
            'removed without outcome' => [['state' => 'removed']],
            'failed without diagnostic' => [['state' => 'failed']],
        ];
    }

    public function test_attachment_rollback_retains_ready_token_and_duplicate_intent_is_rejected(): void
    {
        $row = $this->ready();
        $id = DB::table('incident_photos')->insertGetId($row);
        DB::beginTransaction();
        DB::table('incident_photos')->where('id', $id)->lockForUpdate()->first();
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-03 01:00:00']);
        DB::rollBack();
        $this->assertSame('ready', DB::table('incident_photos')->where('id', $id)->value('state'));
        $this->assertNull(DB::table('incident_photos')->where('id', $id)->value('incident_id'));
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->insert(array_replace($row, ['upload_id' => (string) Str::uuid(), 'object_key' => 'incident-photos/bb/'.bin2hex(random_bytes(32))]));
    }

    public function test_downgrade_refuses_retained_metadata_then_empty_downgrade_and_forward_application_work(): void
    {
        DB::table('incident_photos')->insert($this->ready(['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-03 01:00:00']));
        try {
            $this->proposal->down();
            $this->fail('Retained photo metadata must block destructive downgrade.');
        } catch (\LogicException $error) {
            $this->assertSame('incident_photo_metadata_retained', $error->getMessage());
        }
        $this->assertSame(1, DB::table('incident_photos')->count());
        DB::table('incident_photos')->delete();
        $this->proposal->down();
        $this->assertFalse(Schema::hasTable('incident_photos'));
        $this->proposal->up();
        $this->assertTrue(Schema::hasTable('incident_photos'));
        $this->assertSame(3, DB::table('emergency_alerts')->count());
    }

    public function test_processing_is_not_ready_and_input_output_evidence_is_write_once(): void
    {
        $id = DB::table('incident_photos')->insertGetId($this->ready(['state' => 'processing',
            'mime' => null, 'bytes' => null, 'sha256' => null, 'uploaded_at' => null]));
        $this->assertSame('processing', DB::table('incident_photos')->where('id', $id)->value('state'));
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'ready', 'mime' => 'image/png',
            'bytes' => 321, 'sha256' => str_repeat('c', 64), 'uploaded_at' => '2026-11-03 00:00:01', 'updated_at' => '2026-11-03 00:00:01']);
        $photo = IncidentPhoto::findOrFail($id);
        $this->assertSame(str_repeat('b', 64), $photo->input_sha256);
        $this->assertSame(str_repeat('c', 64), $photo->sha256);
        $this->assertSame([], $photo->toArray());
        $this->assertSame('{}', $photo->toJson(JSON_FORCE_OBJECT));
        $this->assertTrue($photo->isGuarded('input_sha256'));
        $this->assertSame(15, $photo->uploader->id);
        foreach (['input_sha256' => str_repeat('d', 64), 'sha256' => str_repeat('d', 64), 'bytes' => 322,
            'upload_id' => (string) Str::uuid(), 'uploader_auth_version' => 1,
            'object_key' => 'incident-photos/aa/'.str_repeat('e', 64), 'state' => 'processing'] as $column => $value) {
            try {
                DB::table('incident_photos')->where('id', $id)->update([$column => $value]);
                $this->fail('Mutation must be rejected: '.$column);
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }
        }
    }

    public function test_attachment_and_tombstone_cannot_be_resurrected_or_reassigned(): void
    {
        $id = DB::table('incident_photos')->insertGetId($this->ready());
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'attached', 'incident_id' => 15, 'attached_at' => '2026-11-03 01:00:00']);
        $this->assertSame(15, IncidentPhoto::findOrFail($id)->incident->id);
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'removing', 'incident_id' => null, 'attached_at' => null]);
    }

    public function test_five_minute_cleanup_claim_recovery_is_fenced_and_tombstone_retained(): void
    {
        $id = DB::table('incident_photos')->insertGetId($this->ready());
        $a = (string) Str::uuid();
        $b = (string) Str::uuid();
        $claim = fn ($token, $at, $until, $attempt) => ['state' => 'removing', 'cleanup_token' => $token,
            'updated_at' => $at, 'cleanup_lease_until' => $until, 'cleanup_attempts' => $attempt];
        DB::table('incident_photos')->where('id', $id)->update($claim($a, '2026-11-04 00:00:00.000001', '2026-11-04 00:05:00.000001', 1));
        try {
            DB::table('incident_photos')->where('id', $id)->update($claim($b, '2026-11-04 00:04:00.000001', '2026-11-04 00:09:00.000001', 2));
            $this->fail('An unexpired lease cannot be replaced.');
        } catch (QueryException $e) {
            $this->assertStringContainsString('photo_cleanup_lease_conflict', $e->getMessage());
        }
        DB::table('incident_photos')->where('id', $id)->update($claim($b, '2026-11-04 00:05:00.000001', '2026-11-04 00:10:00.000001', 2));
        $outcome = ['state' => 'removed', 'removed_at' => '2026-11-04 00:06:00.000001', 'updated_at' => '2026-11-04 00:06:00.000001', 'cleanup_token' => null, 'cleanup_lease_until' => null];
        $this->assertSame(0, DB::table('incident_photos')->where(['id' => $id, 'state' => 'removing', 'cleanup_token' => $a])->update($outcome));
        $this->assertSame(1, DB::table('incident_photos')->where(['id' => $id, 'state' => 'removing', 'cleanup_token' => $b])->update($outcome));
        $this->assertSame(2, DB::table('incident_photos')->where('id', $id)->value('cleanup_attempts'));
        $this->assertSame(str_repeat('b', 64), DB::table('incident_photos')->where('id', $id)->value('input_sha256'));
        $this->expectException(QueryException::class);
        DB::table('incident_photos')->where('id', $id)->update(['state' => 'ready', 'removed_at' => null]);
    }

    public function test_partial_ddl_after_supporting_index_repairs_only_compatible_missing_objects(): void
    {
        $this->proposal->down();
        $connection = DB::connection();
        $original = $connection->getEventDispatcher();
        $events = clone $original;
        $connection->setEventDispatcher($events);
        $events->listen(QueryExecuted::class, function ($event) {
            if (str_starts_with($event->sql, 'ALTER TABLE emergency_alerts ADD UNIQUE KEY photo_incident_owner_scope')) {
                throw new \RuntimeException('simulated_process_loss_after_committed_index');
            }
        });
        try {
            try {
                $this->proposal->up();
                $this->fail('The injected failure must interrupt DDL.');
            } catch (\RuntimeException $e) {
                $this->assertSame('simulated_process_loss_after_committed_index', $e->getMessage());
            }
        } finally {
            $connection->setEventDispatcher($original);
        }
        $this->assertFalse(Schema::hasTable('incident_photos'));
        $this->assertSame(3, DB::table('emergency_alerts')->count());
        $this->proposal->up();
        DB::statement('DROP TRIGGER photo_metadata_update_guard');
        $this->proposal->up();
        $this->proposal->up();
        $this->assertTrue(Schema::hasTable('incident_photos'));
        $this->assertCount(0, DB::select("SHOW TABLES LIKE 'dba_photo_shape_%'"));
    }

    public function test_incompatible_partial_objects_are_retained_and_rejected(): void
    {
        DB::statement('ALTER TABLE incident_photos ADD COLUMN unrelated_marker INT NULL');
        try {
            $this->proposal->up();
            $this->fail('An incompatible table cannot be silently reused.');
        } catch (\LogicException $e) {
            $this->assertSame('incident_photo_incompatible_partial_table', $e->getMessage());
            $this->assertTrue(Schema::hasColumn('incident_photos', 'unrelated_marker'));
        } finally {
            DB::statement('ALTER TABLE incident_photos DROP COLUMN unrelated_marker');
        }
        $this->proposal->down();
        DB::statement('ALTER TABLE emergency_alerts ADD KEY photo_incident_owner_scope (resident_id)');
        try {
            $this->proposal->up();
            $this->fail('An incompatible supporting index cannot be replaced.');
        } catch (\LogicException $e) {
            $this->assertSame('incident_photo_incompatible_supporting_index', $e->getMessage());
            $this->assertFalse(Schema::hasTable('incident_photos'));
        } finally {
            DB::statement('ALTER TABLE emergency_alerts DROP INDEX photo_incident_owner_scope');
            $this->proposal->up();
        }
    }

    public function test_incompatible_partial_trigger_is_not_replaced(): void
    {
        DB::statement('DROP TRIGGER photo_metadata_update_guard');
        DB::unprepared('CREATE TRIGGER photo_metadata_update_guard BEFORE UPDATE ON incident_photos FOR EACH ROW SET NEW.updated_at=OLD.updated_at');
        try {
            $this->proposal->up();
            $this->fail('Incompatible trigger must not be replaced.');
        } catch (\LogicException $e) {
            $this->assertSame('incident_photo_incompatible_partial_trigger', $e->getMessage());
            $this->assertStringContainsString('SET NEW.updated_at=OLD.updated_at',
                DB::selectOne("SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='photo_metadata_update_guard'")->ACTION_STATEMENT);
        } finally {
            DB::statement('DROP TRIGGER photo_metadata_update_guard');
            $this->proposal->up();
        }
    }

    public function test_unrelated_partial_table_is_not_changed_and_no_index_is_added(): void
    {
        $this->proposal->down();
        DB::statement('CREATE TABLE incident_photos (unrelated_marker INT NOT NULL) ENGINE=InnoDB');
        DB::table('incident_photos')->insert(['unrelated_marker' => 7]);
        try {
            $this->proposal->up();
            $this->fail('Unrelated partial table must block every repair.');
        } catch (\LogicException $e) {
            $this->assertSame('incident_photo_incompatible_partial_dependencies', $e->getMessage());
            $this->assertSame(7, DB::table('incident_photos')->value('unrelated_marker'));
            $this->assertCount(0, DB::select("SHOW INDEX FROM emergency_alerts WHERE Key_name='photo_incident_owner_scope'"));
        } finally {
            DB::statement('DROP TABLE incident_photos');
            $this->proposal->up();
        }
    }

    private function race(int $id, array $modes): array
    {
        $barrier = sys_get_temp_dir().'/bc-photo-'.bin2hex(random_bytes(8));
        mkdir($barrier);
        $workers = [];
        try {
            foreach ($modes as $i => $mode) {
                $worker = new Process([PHP_BINARY, __DIR__.'/../Support/photo-race-worker.php', $barrier, (string) $i, (string) $id, $mode]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 10;
            while (count(glob($barrier.'/ready-*')) !== count($workers) && microtime(true) < $deadline) {
                usleep(10000);
            }
            $this->assertCount(count($workers), glob($barrier.'/ready-*'));
            touch($barrier.'/go');
            $results = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertSame(0, $worker->getExitCode(), $worker->getErrorOutput());
                $results[] = trim($worker->getOutput());
            }
            sort($results);

            return $results;
        } finally {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop();
                }
            }
            foreach (glob($barrier.'/*') as $file) {
                unlink($file);
            }
            rmdir($barrier);
        }
    }

    public function test_concurrent_metadata_consumers_and_cleanup_claims(): void
    {
        $now = now()->utc();
        $fresh = ['created_at' => $now->format('Y-m-d H:i:s.u'), 'uploaded_at' => $now->format('Y-m-d H:i:s.u'),
            'updated_at' => $now->format('Y-m-d H:i:s.u'), 'expires_at' => $now->copy()->addDay()->format('Y-m-d H:i:s.u')];
        $id = DB::table('incident_photos')->insertGetId($this->ready($fresh));
        $this->assertSame(['attached', 'conflict'], $this->race($id, ['attach', 'attach']));
        $this->assertSame('attached', DB::table('incident_photos')->where('id', $id)->value('state'));
        $this->assertSame(['conflict', 'conflict'], $this->race($id, ['cleanup', 'cleanup']));
        $expired = DB::table('incident_photos')->insertGetId($this->ready());
        $this->assertSame(['claimed', 'conflict'], $this->race($expired, ['cleanup', 'cleanup']));
        $this->assertSame(['conflict', 'conflict'], $this->race($expired, ['attach', 'cleanup']));
        $this->assertSame(1, DB::table('incident_photos')->where('id', $expired)->value('cleanup_attempts'));
    }
}
