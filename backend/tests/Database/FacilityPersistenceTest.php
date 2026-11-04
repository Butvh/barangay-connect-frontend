<?php

namespace Tests\Database;

use App\Models\FacilityHistory;
use App\Models\User;
use App\Providers\P2ServiceProvider;
use App\Services\Facilities\FacilityAdministration;
use App\Services\Identity\EffectiveIdentity;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\MysqlDbaTestCase;

class FacilityPersistenceTest extends MysqlDbaTestCase
{
    private function widths(): array
    {
        return DB::table('information_schema.COLUMNS')->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', 'facilities')->whereIn('COLUMN_NAME', ['name', 'address', 'contact'])
            ->orderBy('COLUMN_NAME')->pluck('CHARACTER_MAXIMUM_LENGTH', 'COLUMN_NAME')->map(fn ($v) => (int) $v)->all();
    }

    private function history(array $patch = []): array
    {
        return array_replace(['facility_id' => 1, 'barangay_id' => 1, 'actor_id' => 1,
            'actor_name' => 'Fictional captain', 'role_at_action' => 'captain', 'action' => 'Created', 'revision' => 0,
            'snapshot' => json_encode(['id' => 1, 'managed_by_barangay_id' => 1, 'name' => 'Fictional facility',
                'type' => 'Hospital', 'address' => 'Fictional address', 'capacity' => null, 'contact' => '', 'notes' => '',
                'status' => 'Active', 'map_x' => null, 'map_y' => null], JSON_THROW_ON_ERROR),
            'occurred_at' => '2026-11-05 00:00:00.000001'], $patch);
    }

    public function test_fresh_schema_has_reviewed_widths_and_empty_history(): void
    {
        $this->assertSame(['address' => 300, 'contact' => 50, 'name' => 160], $this->widths());
        $this->assertTrue(Schema::hasTable('facility_history'));
        $this->assertSame(0, DB::table('facility_history')->count());
    }

    public function test_upgrade_from_original_eleven_preserves_sources_references_and_snapshots(): void
    {
        $this->migrateDown();
        $files = glob(__DIR__.'/../../database/migrations/*.php');
        foreach (array_slice($files, 0, 11) as $file) {
            (require $file)->up();
        }
        $this->fixtures();
        $before = DB::table('facilities')->orderBy('id')->get()->toJson();
        $destinations = DB::table('rescues')->orderBy('id')->pluck('destination_snapshot', 'id')->all();
        foreach (array_slice($files, 11) as $file) {
            (require $file)->up();
            (require $file)->up();
        }
        $this->assertSame($before, DB::table('facilities')->orderBy('id')->get()->toJson());
        $this->assertSame($destinations, DB::table('rescues')->orderBy('id')->pluck('destination_snapshot', 'id')->all());
        $this->assertSame(0, DB::table('facility_history')->count());
        $this->assertSame(40, DB::table('users')->count());
        $this->assertSame(['address' => 300, 'contact' => 50, 'name' => 160], $this->widths());
    }

    public function test_multibyte_boundaries_fit_and_oversize_is_rejected_without_truncation(): void
    {
        $this->fixtures();
        $boundary = ['name' => str_repeat('ñ', 160), 'address' => str_repeat('界', 300), 'contact' => str_repeat('1', 50)];
        DB::table('facilities')->where('id', 1)->update($boundary);
        $this->assertSame($boundary, (array) DB::table('facilities')->where('id', 1)->first(['name', 'address', 'contact']));
        foreach (['name' => 160, 'address' => 300, 'contact' => 50] as $field => $max) {
            try {
                DB::table('facilities')->where('id', 1)->update([$field => str_repeat('x', $max + 1)]);
                $this->fail('Oversize must not truncate '.$field);
            } catch (QueryException $e) {
                $this->assertSame('22001', $e->errorInfo[0]);
            }
        }
        $this->assertSame($boundary, (array) DB::table('facilities')->where('id', 1)->first(['name', 'address', 'contact']));
    }

    public function test_actual_p1_default_collation_and_column_override_survive_fresh_upgrade_and_downgrade(): void
    {
        $this->migrateDown();
        config(['database.connections.mysql.collation' => 'utf8mb4_unicode_ci']);
        DB::purge('mysql');
        try {
            $files = glob(__DIR__.'/../../database/migrations/*.php');
            foreach (array_slice($files, 0, 11) as $file) {
                (require $file)->up();
            }
            DB::statement('ALTER TABLE facilities MODIFY name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
            foreach (array_slice($files, 11) as $file) {
                (require $file)->up();
            }
            $collations = fn () => DB::table('information_schema.COLUMNS')->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
                ->where('TABLE_NAME', 'facilities')->whereIn('COLUMN_NAME', ['name', 'address', 'contact'])->orderBy('COLUMN_NAME')->pluck('COLLATION_NAME', 'COLUMN_NAME')->all();
            $expected = ['address' => 'utf8mb4_unicode_ci', 'contact' => 'utf8mb4_unicode_ci', 'name' => 'utf8mb4_bin'];
            $this->assertSame($expected, $collations());
            $this->assertSame(['address' => 300, 'contact' => 50, 'name' => 160], $this->widths());
            $widths = require __DIR__.'/../../database/migrations/2026_11_05_000100_widen_facility_display_fields.php';
            $widths->down();
            $this->assertSame($expected, $collations());
            $this->assertSame(['address' => 200, 'contact' => 30, 'name' => 100], $this->widths());
            $widths->up();
            $this->assertSame($expected, $collations());
        } finally {
            config(['database.connections.mysql.collation' => 'utf8mb4_0900_ai_ci']);
            DB::purge('mysql');
        }
    }

    #[DataProvider('invalidHistory')]
    public function test_history_scope_revisions_and_snapshot_constraints(array $patch): void
    {
        $this->fixtures();
        $this->expectException(QueryException::class);
        DB::table('facility_history')->insert($this->history($patch));
    }

    public static function invalidHistory(): array
    {
        $snapshot = ['id' => 1, 'managed_by_barangay_id' => 1, 'name' => 'Fictional facility', 'type' => 'Hospital',
            'address' => 'Fictional address', 'capacity' => null, 'contact' => '', 'notes' => '', 'status' => 'Active', 'map_x' => null, 'map_y' => null];

        return [
            'foreign facility scope' => [['barangay_id' => 2, 'actor_id' => 101]],
            'foreign actor scope' => [['actor_id' => 101]],
            'missing facility' => [['facility_id' => 999999]],
            'missing actor' => [['actor_id' => 999999]],
            'unknown action' => [['action' => 'Deleted']],
            'creation nonzero revision' => [['revision' => 1]],
            'change zero revision' => [['action' => 'Edited']],
            'negative revision' => [['revision' => -1]],
            'not an object' => [['snapshot' => '[]']],
            'missing display fields' => [['snapshot' => '{"id":1}']],
            'different source ID' => [['snapshot' => json_encode(array_replace($snapshot, ['id' => 2]))]],
            'different management scope' => [['snapshot' => json_encode(array_replace($snapshot, ['managed_by_barangay_id' => 2]))]],
            'oversize name' => [['snapshot' => json_encode(array_replace($snapshot, ['name' => str_repeat('x', 161)]))]],
            'unpaired pin' => [['snapshot' => json_encode(array_replace($snapshot, ['map_x' => 1]))]],
            'deactivation active snapshot' => [['action' => 'Deactivated', 'revision' => 1]],
            'unsupported snapshot field' => [['snapshot' => json_encode($snapshot + ['private_token' => 'not-permitted'])]],
        ];
    }

    public function test_unique_revision_nullable_actor_and_immutable_retained_evidence(): void
    {
        $this->fixtures();
        $id = DB::table('facility_history')->insertGetId($this->history(['actor_id' => null, 'actor_name' => null, 'role_at_action' => null]));
        $model = FacilityHistory::findOrFail($id);
        $this->assertSame([], $model->toArray());
        $this->assertSame([], $model->attributesToArray());
        $this->assertSame('2026-11-05 00:00:00.000001', $model->occurred_at->format('Y-m-d H:i:s.u'));
        foreach ([fn () => DB::table('facility_history')->insert($this->history()),
            fn () => DB::table('facility_history')->where('id', $id)->update(['actor_name' => 'rewrite']),
            fn () => DB::table('facility_history')->where('id', $id)->delete(),
            fn () => DB::table('facilities')->where('id', 1)->delete()] as $write) {
            try {
                $write();
                $this->fail('Retained history must refuse mutation/deletion/duplicate.');
            } catch (QueryException) {
                $this->assertTrue(true);
            }
        }
        try {
            $model->delete();
            $this->fail('Model deletion must refuse.');
        } catch (\LogicException $e) {
            $this->assertSame('facility_history_immutable', $e->getMessage());
        }
        $this->assertSame(1, DB::table('facility_history')->count());
    }

    public function test_source_and_history_roll_back_together_and_retained_downgrade_refuses(): void
    {
        $this->fixtures();
        $before = DB::table('facilities')->where('id', 1)->first();
        try {
            DB::transaction(function () {
                DB::table('facilities')->where('id', 1)->update(['revision' => 1]);
                DB::table('facility_history')->insert($this->history(['action' => 'Edited', 'revision' => 1]));
                throw new \RuntimeException('fixture_source_rollback');
            });
        } catch (\RuntimeException $e) {
            $this->assertSame('fixture_source_rollback', $e->getMessage());
        }
        $this->assertEquals($before, DB::table('facilities')->where('id', 1)->first());
        $this->assertSame(0, DB::table('facility_history')->count());
        DB::table('facility_history')->insert($this->history());
        $this->expectExceptionMessage('facility_history_retained');
        (require __DIR__.'/../../database/migrations/2026_11_05_000200_create_facility_history.php')->down();
    }

    public function test_empty_history_rollback_and_lossless_width_rollback(): void
    {
        $this->fixtures();
        $history = require __DIR__.'/../../database/migrations/2026_11_05_000200_create_facility_history.php';
        $widths = require __DIR__.'/../../database/migrations/2026_11_05_000100_widen_facility_display_fields.php';
        $history->down();
        $this->assertFalse(Schema::hasTable('facility_history'));
        $widths->down();
        $this->assertSame(['address' => 200, 'contact' => 30, 'name' => 100], $this->widths());
        $widths->up();
        $history->up();
        DB::table('facilities')->where('id', 1)->update(['name' => str_repeat('ñ', 160)]);
        try {
            $widths->down();
            $this->fail('Retained wide values must not narrow.');
        } catch (\LogicException $e) {
            $this->assertSame('facility_widths_retained', $e->getMessage());
        }
        $this->assertSame(str_repeat('ñ', 160), DB::table('facilities')->where('id', 1)->value('name'));
        $this->assertSame(['address' => 300, 'contact' => 50, 'name' => 160], $this->widths());
    }

    public function test_actual_p1_facility_edit_and_deactivation_preserve_recorded_destinations(): void
    {
        $this->fixtures();
        $app = app();
        require __DIR__.'/../P2/bindings.php';
        $app->register(P2ServiceProvider::class);
        config(['identity.enabled' => true, 'integration.connection' => 'mysql']);
        $actor = EffectiveIdentity::fromUser(User::findOrFail(1));
        $snapshots = DB::table('rescues')->where('facility_id', 1)->pluck('destination_snapshot', 'id')->all();
        $this->assertNotEmpty($snapshots);
        $service = app(FacilityAdministration::class);
        $edited = $service->save($actor, 1, ['name' => str_repeat('n', 160), 'address' => str_repeat('a', 300), 'contact' => str_repeat('1', 50), 'expected_revision' => 0]);
        $this->assertSame(1, $edited['revision']);
        $inactive = $service->save($actor, 1, ['status' => 'Inactive', 'expected_revision' => 1]);
        $this->assertSame('Inactive', $inactive['status']);
        $this->assertSame($snapshots, DB::table('rescues')->where('facility_id', 1)->pluck('destination_snapshot', 'id')->all());
        $history = FacilityHistory::where('facility_id', 1)->orderBy('revision')->get();
        $this->assertCount(2, $history);
        $this->assertSame([1, 2], $history->pluck('revision')->all());
        $this->assertSame(['Edited', 'Deactivated'], $history->pluck('action')->all());
        $this->assertSame(str_repeat('n', 160), $history[0]->snapshot['name']);
        $this->assertSame(str_repeat('a', 300), $history[0]->snapshot['address']);
        $this->assertSame(str_repeat('1', 50), $history[0]->snapshot['contact']);
        $this->assertSame('Active', $history[0]->snapshot['status']);
        $this->assertSame('Inactive', $history[1]->snapshot['status']);
        $this->assertSame([1, 1], $history->pluck('actor_id')->all());
        $this->assertSame(['captain', 'captain'], $history->pluck('role_at_action')->all());
    }

    public function test_interrupted_table_creation_recovers_both_immutable_guards(): void
    {
        $migration = require __DIR__.'/../../database/migrations/2026_11_05_000200_create_facility_history.php';
        $migration->down();
        $db = DB::connection();
        $original = $db->getEventDispatcher();
        $events = clone $original;
        $db->setEventDispatcher($events);
        $events->listen(QueryExecuted::class, function ($query) {
            if (str_starts_with($query->sql, 'CREATE TABLE facility_history')) {
                throw new \RuntimeException('fixture_history_ddl_interruption');
            }
        });
        try {
            try {
                $migration->up();
                $this->fail('DDL interruption must fire.');
            } catch (\RuntimeException $e) {
                $this->assertSame('fixture_history_ddl_interruption', $e->getMessage());
            }
        } finally {
            $db->setEventDispatcher($original);
        }
        $this->assertTrue(Schema::hasTable('facility_history'));
        $migration->up();
        $migration->up();
        $this->assertSame(2, DB::table('information_schema.TRIGGERS')->where('TRIGGER_SCHEMA', $db->getDatabaseName())->where('EVENT_OBJECT_TABLE', 'facility_history')->count());
        $this->assertSame(0, DB::table('facility_history')->count());
    }

    public function test_incompatible_partial_history_is_retained_and_rejected(): void
    {
        $migration = require __DIR__.'/../../database/migrations/2026_11_05_000200_create_facility_history.php';
        $migration->down();
        DB::statement('CREATE TABLE facility_history (id BIGINT PRIMARY KEY, retained_marker VARCHAR(30)) ENGINE=InnoDB');
        DB::table('facility_history')->insert(['id' => 1, 'retained_marker' => 'fictional-retained-evidence']);
        try {
            try {
                $migration->up();
                $this->fail('Incompatible retained table must refuse.');
            } catch (\LogicException $e) {
                $this->assertSame('facility_history_incompatible_partial_table', $e->getMessage());
            }
            $this->assertSame('fictional-retained-evidence', DB::table('facility_history')->value('retained_marker'));
        } finally {
            // Explicit disposal of this test's deliberately incompatible fictional object only.
            DB::statement('DROP TABLE facility_history');
            $migration->up();
        }
    }

    public function test_strict_atomic_downgrade_rejects_a_wide_write_after_its_precheck(): void
    {
        $this->fixtures();
        $migration = require __DIR__.'/../../database/migrations/2026_11_05_000100_widen_facility_display_fields.php';
        $db = DB::connection();
        $original = $db->getEventDispatcher();
        $mode = DB::selectOne('SELECT @@SESSION.sql_mode AS mode')->mode;
        DB::statement("SET SESSION sql_mode=''");
        config(['database.connections.facility_width_race' => $db->getConfig()]);
        $events = clone $original;
        $db->setEventDispatcher($events);
        $injected = false;
        $events->listen(QueryExecuted::class, function ($query) use (&$injected) {
            if (! $injected && str_contains($query->sql, 'CHAR_LENGTH(name)>100')) {
                $injected = true;
                DB::connection('facility_width_race')->table('facilities')->where('id', 1)->update(['name' => str_repeat('ñ', 160)]);
            }
        });
        try {
            try {
                $migration->down();
                $this->fail('Atomic ALTER must refuse the newly committed wide value.');
            } catch (QueryException $e) {
                $this->assertContains((int) $e->errorInfo[1], [1265, 1406]);
            }
            $this->assertTrue($injected);
            $this->assertSame('', DB::selectOne('SELECT @@SESSION.sql_mode AS mode')->mode);
            $this->assertSame(str_repeat('ñ', 160), DB::table('facilities')->where('id', 1)->value('name'));
            $this->assertSame(['address' => 300, 'contact' => 50, 'name' => 160], $this->widths());
        } finally {
            $db->setEventDispatcher($original);
            DB::statement('SET SESSION sql_mode = ?', [$mode]);
            DB::disconnect('facility_width_race');
        }
    }
}
