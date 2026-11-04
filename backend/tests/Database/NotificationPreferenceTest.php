<?php

namespace Tests\Database;

use App\Contracts\Events\AuditSummary;
use App\Contracts\Events\ResourceReference;
use App\Models\NotificationPreference;
use App\Services\P2\Persistence\TypedAuditRecorder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\MysqlDbaTestCase;

/** Fictional persistence protocol fixtures; never a replacement current consent authority. */
class NotificationPreferenceTest extends MysqlDbaTestCase
{
    private $migration;

    protected function setUp(): void
    {
        parent::setUp();
        $this->migration = require __DIR__.'/../../database/migrations/2026_11_04_000200_create_notification_preferences.php';
        DB::table('barangays')->insert([['id' => 1, 'name' => 'Fictional consent scope'], ['id' => 2, 'name' => 'Other fictional scope']]);
        foreach ([15 => 1, 16 => 1, 105 => 2] as $id => $scope) {
            DB::table('users')->insert(['id' => $id, 'barangay_id' => $scope, 'full_name' => 'Fictional consent owner',
                'email' => 'consent-'.$id.'@example.invalid', 'password' => 'unusable-fictional-only', 'is_resident' => true]);
        }
    }

    private function grant(array $patch = []): array
    {
        return array_replace(['user_id' => 15, 'barangay_id' => 1, 'purpose' => 'incident_review', 'channel' => 'sms',
            'state' => 'granted', 'revision' => 1, 'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1',
            'recorded_by' => 15, 'granted_at' => '2026-11-04 00:00:00.000001', 'revoked_at' => null,
            'created_at' => '2026-11-04 00:00:00.000001', 'updated_at' => '2026-11-04 00:00:00.000001'], $patch);
    }

    private function revoke(): array
    {
        return ['state' => 'revoked', 'revision' => 2, 'revoked_at' => '2026-11-04 00:01:00.000001', 'updated_at' => '2026-11-04 00:01:00.000001'];
    }

    public function test_fresh_and_seeded_up_preserves_records_and_never_seeds_consent(): void
    {
        $this->assertSame(0, DB::table('notification_preferences')->count());
        $this->migration->down();
        $this->assertFalse(Schema::hasTable('notification_preferences'));
        $this->migration->up();
        $this->migration->up();
        $this->assertSame(3, DB::table('users')->count());
        $this->assertSame(0, DB::table('notification_preferences')->count());
        $this->assertCount(10, glob(__DIR__.'/../../database/migrations/*.php'));
        $this->assertSame('InnoDB', DB::selectOne("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notification_preferences'")->ENGINE);
    }

    #[DataProvider('invalidRows')]
    public function test_scoped_unique_state_version_and_timestamp_constraints(array $patch): void
    {
        $this->expectException(QueryException::class);
        DB::table('notification_preferences')->insert($this->grant($patch));
    }

    public static function invalidRows(): array
    {
        return [
            'foreign user' => [['user_id' => 105, 'recorded_by' => 105]],
            'foreign recorder' => [['recorded_by' => 105]],
            'on behalf actor' => [['recorded_by' => 16]],
            'unknown purpose' => [['purpose' => 'marketing']],
            'non sms channel' => [['channel' => 'email']],
            'unknown state' => [['state' => 'pending']],
            'absence is not persisted revision0' => [['revision' => 0]],
            'negative revision' => [['revision' => -1]],
            'unsafe revision' => [['revision' => 9007199254740992]],
            'missing policy' => [['policy_version' => null]],
            'empty policy' => [['policy_version' => '']],
            'unknown policy' => [['policy_version' => 'sms-consent.v2']],
            'unknown template' => [['template_version' => 'alert-review.v2']],
            'wrong purpose template' => [['template_version' => 'announcement-review.v1']],
            'granted without time' => [['granted_at' => null]],
            'grant with revoked time' => [['revoked_at' => '2026-11-04 00:00:00.000001']],
            'revoke without time' => [['state' => 'revoked']],
            'grant before creation' => [['granted_at' => '2026-11-03 00:00:00']],
            'revoke before grant' => [['state' => 'revoked', 'revoked_at' => '2026-11-03 00:00:00']],
            'time after update' => [['granted_at' => '2026-11-05 00:00:00']],
            'nonmonotone timestamps' => [['updated_at' => '2026-11-03 00:00:00']],
        ];
    }

    public function test_scoped_purpose_uniqueness_revision_cas_and_private_model(): void
    {
        $id = DB::table('notification_preferences')->insertGetId($this->grant());
        DB::table('notification_preferences')->insert($this->grant(['purpose' => 'barangay_announcements', 'template_version' => 'announcement-review.v1']));
        $this->assertSame(1, DB::table('notification_preferences')->where(['id' => $id, 'revision' => 1])->update($this->revoke()));
        $this->assertSame(0, DB::table('notification_preferences')->where(['id' => $id, 'revision' => 1])->update($this->revoke()));
        $preference = NotificationPreference::findOrFail($id);
        $this->assertSame(2, $preference->revision);
        $this->assertSame('revoked', $preference->state);
        $this->assertSame('2026-11-04 00:00:00.000001', $preference->granted_at->format('Y-m-d H:i:s.u'));
        $this->assertSame([], $preference->toArray());
        $this->assertSame([], $preference->attributesToArray());
        $this->assertTrue($preference->isGuarded('state'));
        $this->assertSame(15, $preference->user->id);
        $this->assertSame(15, $preference->recordedBy->id);
        $this->expectException(QueryException::class);
        DB::table('notification_preferences')->insert($this->grant());
    }

    public function test_identity_revision_and_prior_grant_evidence_cannot_be_rewritten(): void
    {
        $id = DB::table('notification_preferences')->insertGetId($this->grant());
        foreach ([['user_id' => 16, 'recorded_by' => 16, 'revision' => 2],
            ['revision' => 1], ['revision' => 3],
            array_replace($this->revoke(), ['granted_at' => null])] as $patch) {
            try {
                DB::table('notification_preferences')->where('id', $id)->update($patch);
                $this->fail('Immutable evidence or exact next revision must reject the update.');
            } catch (QueryException $e) {
                $this->assertSame('45000', $e->errorInfo[0]);
            }
        }
        DB::table('notification_preferences')->where('id', $id)->update($this->revoke());
        DB::table('notification_preferences')->where('id', $id)->where('revision', 2)->update(['state' => 'granted',
            'revision' => 3, 'granted_at' => '2026-11-04 00:02:00.000001', 'revoked_at' => null, 'updated_at' => '2026-11-04 00:02:00.000001']);
        $this->assertSame(3, DB::table('notification_preferences')->where('id', $id)->value('revision'));
    }

    private function audit(int $id, string $from, string $to, int $revision): void
    {
        // Existing v1 vocabulary: a canonical server-generated reason, never submitted text.
        $reason = json_encode(['preference_id' => $id, 'purpose' => 'incident_review', 'channel' => 'sms',
            'from' => $from, 'to' => $to, 'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1'], JSON_THROW_ON_ERROR);
        (new TypedAuditRecorder)->record(15, 'resident', 1, new ResourceReference('user', 15),
            'notification_preference.changed', new AuditSummary(['status' => $to, 'revision' => $revision, 'reason' => $reason]));
    }

    public function test_existing_typed_audit_and_preference_commit_or_roll_back_together(): void
    {
        try {
            DB::transaction(function () {
                $id = DB::table('notification_preferences')->insertGetId($this->grant());
                $this->audit($id, 'not_granted', 'granted', 1);
                throw new \RuntimeException('fixture_source_failure');
            });
        } catch (\RuntimeException $e) {
            $this->assertSame('fixture_source_failure', $e->getMessage());
        }
        $this->assertSame(0, DB::table('notification_preferences')->count());
        $this->assertSame(0, DB::table('activity_logs')->count());
        $id = DB::transaction(function () {
            $id = DB::table('notification_preferences')->insertGetId($this->grant());
            $this->audit($id, 'not_granted', 'granted', 1);

            return $id;
        });
        try {
            DB::transaction(function () use ($id) {
                DB::table('notification_preferences')->where(['id' => $id, 'revision' => 1])->update($this->revoke());
                (new TypedAuditRecorder)->record(105, 'resident', 1, new ResourceReference('user', 15),
                    'notification_preference.changed', new AuditSummary);
            });
            $this->fail('Invalid scoped audit must roll back revocation.');
        } catch (ModelNotFoundException) {
            $this->assertSame(1, DB::table('notification_preferences')->where('id', $id)->value('revision'));
            $this->assertSame('granted', DB::table('notification_preferences')->where('id', $id)->value('state'));
        }
        DB::transaction(function () use ($id) {
            DB::table('notification_preferences')->where(['id' => $id, 'revision' => 1])->update($this->revoke());
            $this->audit($id, 'granted', 'revoked', 2);
        });
        $this->assertSame(2, DB::table('activity_logs')->count());
        $summary = json_decode(DB::table('activity_logs')->orderByDesc('id')->value('summary'), true);
        $this->assertSame(['preference_id' => $id, 'purpose' => 'incident_review', 'channel' => 'sms',
            'from' => 'granted', 'to' => 'revoked', 'policy_version' => 'sms-consent.v1', 'template_version' => 'alert-review.v1'], json_decode($summary['reason'], true));
    }

    public function test_retained_revocation_blocks_downgrade_and_model_deletion(): void
    {
        $id = DB::table('notification_preferences')->insertGetId($this->grant(['state' => 'revoked', 'granted_at' => null, 'revoked_at' => '2026-11-04 00:00:00.000001']));
        foreach ([fn () => $this->migration->down(), fn () => NotificationPreference::findOrFail($id)->delete()] as $destructive) {
            try {
                $destructive();
                $this->fail('Retained consent evidence must survive.');
            } catch (\LogicException $e) {
                $this->assertSame('notification_preferences_retained', $e->getMessage());
            }
        }
        $this->assertSame(1, DB::table('notification_preferences')->count());
    }

    public function test_partial_table_ddl_repairs_missing_trigger_and_rejects_incompatible_objects(): void
    {
        $this->migration->down();
        $connection = DB::connection();
        $original = $connection->getEventDispatcher();
        $events = clone $original;
        $connection->setEventDispatcher($events);
        $events->listen(QueryExecuted::class, function ($event) {
            if (str_starts_with($event->sql, 'CREATE TABLE notification_preferences')) {
                throw new \RuntimeException('fixture_crash_after_committed_table');
            }
        });
        try {
            try {
                $this->migration->up();
                $this->fail('Committed table must survive injected failure.');
            } catch (\RuntimeException $e) {
                $this->assertSame('fixture_crash_after_committed_table', $e->getMessage());
            }
        } finally {
            $connection->setEventDispatcher($original);
        }
        $this->assertTrue(Schema::hasTable('notification_preferences'));
        $this->migration->up();
        $this->migration->up();
        DB::statement('ALTER TABLE notification_preferences ADD COLUMN unrelated_marker INT NULL');
        try {
            $this->migration->up();
            $this->fail('Incompatible partial table must be retained and rejected.');
        } catch (\LogicException $e) {
            $this->assertSame('notification_preferences_incompatible_partial_table', $e->getMessage());
            $this->assertTrue(Schema::hasColumn('notification_preferences', 'unrelated_marker'));
        } finally {
            DB::statement('ALTER TABLE notification_preferences DROP COLUMN unrelated_marker');
        }
        DB::statement('DROP TRIGGER notification_preference_update_guard');
        DB::unprepared('CREATE TRIGGER notification_preference_update_guard BEFORE UPDATE ON notification_preferences FOR EACH ROW SET NEW.updated_at=OLD.updated_at');
        try {
            $this->migration->up();
            $this->fail('Incompatible trigger must not be replaced.');
        } catch (\LogicException $e) {
            $this->assertSame('notification_preferences_incompatible_partial_trigger', $e->getMessage());
        } finally {
            DB::statement('DROP TRIGGER notification_preference_update_guard');
            $this->migration->up();
        }
        $this->assertCount(0, DB::select("SHOW TABLES LIKE 'dba_consent_shape_%'"));
    }

    private function race(string $mode): array
    {
        $barrier = sys_get_temp_dir().'/bc-consent-'.bin2hex(random_bytes(8));
        mkdir($barrier);
        $workers = [];
        try {
            foreach ([0, 1] as $i) {
                $worker = new Process([PHP_BINARY, __DIR__.'/../Support/consent-race-worker.php', $barrier, (string) $i, $mode]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 10;
            while (count(glob($barrier.'/ready-*')) !== 2 && microtime(true) < $deadline) {
                usleep(10000);
            }
            $this->assertCount(2, glob($barrier.'/ready-*'));
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

    public function test_concurrent_creation_and_original_revision_have_one_winner(): void
    {
        $this->assertSame(['conflict', 'created'], $this->race('create'));
        $this->assertSame(1, DB::table('notification_preferences')->count());
        $this->assertSame(['conflict', 'revoked'], $this->race('revoke'));
        $this->assertSame(2, DB::table('notification_preferences')->value('revision'));
    }

    public function test_current_locking_read_observes_peer_revocation_after_stale_repeatable_read(): void
    {
        DB::table('notification_preferences')->insert($this->grant());
        config(['database.connections.consent_peer' => DB::connection()->getConfig()]);
        $peer = DB::connection('consent_peer');
        DB::beginTransaction();
        try {
            $this->assertSame('granted', DB::table('notification_preferences')->value('state'));
            $peer->table('notification_preferences')->where('revision', 1)->update($this->revoke());
            $this->assertSame('granted', DB::table('notification_preferences')->value('state'));
            $current = DB::table('notification_preferences')->lockForUpdate()->first();
            $this->assertSame('revoked', $current->state);
            $this->assertSame(2, $current->revision);
        } finally {
            DB::rollBack();
            DB::purge('consent_peer');
        }
    }
}
