<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Full display evidence only; P1 owns current managing-authority writes and projection. */
return new class extends Migration
{
    private function snapshotSchema(): string
    {
        $nullable = fn (array $value) => ['anyOf' => [$value, ['type' => 'null']]];
        $id = ['type' => 'integer', 'minimum' => 1, 'maximum' => 9007199254740991];
        $pin = ['type' => 'number', 'minimum' => 0, 'maximum' => 100];
        $properties = ['id' => $id, 'managed_by_barangay_id' => $id,
            'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 160],
            'type' => ['enum' => ['Hospital', 'EvacuationCenter']],
            'address' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 300],
            'capacity' => $nullable(['type' => 'integer', 'minimum' => 1, 'maximum' => 999999]),
            'contact' => $nullable(['type' => 'string', 'maxLength' => 50]),
            'notes' => $nullable(['type' => 'string', 'maxLength' => 300]),
            'status' => ['enum' => ['Active', 'Inactive']], 'map_x' => $nullable($pin), 'map_y' => $nullable($pin)];
        $required = array_keys($properties);
        $properties += ['barangay_id' => $nullable($id), 'visibility' => ['enum' => ['local', 'shared']],
            'map_scope' => $nullable(['type' => 'string', 'maxLength' => 100])];

        return json_encode(['type' => 'object', 'required' => $required, 'properties' => $properties, 'additionalProperties' => false,
            'allOf' => [
                ['anyOf' => [['properties' => ['map_x' => ['type' => 'null'], 'map_y' => ['type' => 'null']]],
                    ['properties' => ['map_x' => $pin, 'map_y' => $pin]]]],
                ['anyOf' => [['properties' => ['type' => ['enum' => ['Hospital']]]],
                    ['properties' => ['type' => ['enum' => ['EvacuationCenter']], 'capacity' => ['type' => 'integer', 'minimum' => 1]]]]],
            ]], JSON_THROW_ON_ERROR);
    }

    private function tableSql(): string
    {
        $schema = DB::connection()->getPdo()->quote($this->snapshotSchema());

        return <<<SQL
CREATE TABLE facility_history (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 facility_id BIGINT UNSIGNED NOT NULL,
 barangay_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NULL,
 actor_name VARCHAR(100) NULL,
 role_at_action VARCHAR(20) NULL,
 action VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 revision INT UNSIGNED NOT NULL,
 snapshot JSON NOT NULL,
 occurred_at TIMESTAMP(6) NOT NULL,
 UNIQUE KEY facility_history_revision (facility_id,revision),
 KEY facility_history_scope_time (barangay_id,occurred_at,id),
 KEY facility_history_actor_scope (actor_id,barangay_id),
 KEY facility_history_facility_scope (facility_id,barangay_id),
 CONSTRAINT facility_history_source_fk FOREIGN KEY (facility_id,barangay_id) REFERENCES facilities(id,managed_by_barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT facility_history_actor_fk FOREIGN KEY (actor_id,barangay_id) REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT facility_history_action_check CHECK ((action='Created' AND revision=0) OR (action IN ('Edited','Deactivated','Reactivated') AND revision>=1)),
 CONSTRAINT facility_history_snapshot_check CHECK (JSON_SCHEMA_VALID($schema,snapshot) AND OCTET_LENGTH(CAST(snapshot AS CHAR))<=8192),
 CONSTRAINT facility_history_reference_check CHECK (CAST(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.id')) AS UNSIGNED)=facility_id AND CAST(JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.managed_by_barangay_id')) AS UNSIGNED)=barangay_id),
 CONSTRAINT facility_history_state_check CHECK ((action<>'Deactivated' OR JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.status'))='Inactive') AND (action<>'Reactivated' OR JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.status'))='Active'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL;
    }

    private function parentIndex(bool $create): void
    {
        $index = DB::select("SHOW INDEX FROM facilities WHERE Key_name='facility_history_scope_parent'");
        if ($index) {
            if (array_column($index, 'Column_name') !== ['id', 'managed_by_barangay_id'] || (int) $index[0]->Non_unique !== 0) {
                throw new LogicException('facility_history_incompatible_parent_index');
            }
        } elseif ($create) {
            DB::statement('ALTER TABLE facilities ADD UNIQUE KEY facility_history_scope_parent (id,managed_by_barangay_id)');
        }
    }

    private function assertTable(): void
    {
        $probe = 'dba_facility_history_shape_'.bin2hex(random_bytes(6));
        $prefix = 'fh_'.bin2hex(random_bytes(6)).'_';
        $created = false;
        try {
            DB::unprepared(str_replace(['CREATE TABLE facility_history', 'CONSTRAINT facility_history_'], ['CREATE TABLE '.$probe, 'CONSTRAINT '.$prefix], $this->tableSql()));
            $created = true;
            $actual = (array) DB::selectOne('SHOW CREATE TABLE facility_history');
            $expected = (array) DB::selectOne('SHOW CREATE TABLE '.$probe);
            $normalize = fn ($s) => preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', str_replace("_ascii'", "_utf8mb4'", $s));
            if ($normalize($actual['Create Table']) !== $normalize(str_replace([$probe, $prefix], ['facility_history', 'facility_history_'], $expected['Create Table']))) {
                throw new LogicException('facility_history_incompatible_partial_table');
            }
        } finally {
            if ($created) {
                DB::statement('DROP TABLE '.$probe);
            }
        }
    }

    private function guard(string $event, bool $create): void
    {
        $name = 'facility_history_'.strtolower($event).'_guard';
        $body = "BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='facility_history_immutable'; END";
        $row = DB::selectOne('SELECT EVENT_OBJECT_TABLE,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME=?', [$name]);
        if ($row) {
            $normalize = fn ($s) => preg_replace('/\s+/', ' ', trim($s));
            if ($row->EVENT_OBJECT_TABLE !== 'facility_history' || $row->ACTION_TIMING !== 'BEFORE' || $row->EVENT_MANIPULATION !== $event
                || $normalize($row->ACTION_STATEMENT) !== $normalize($body)) {
                throw new LogicException('facility_history_incompatible_partial_trigger');
            }
        } elseif ($create) {
            DB::unprepared('CREATE TRIGGER '.$name.' BEFORE '.$event.' ON facility_history FOR EACH ROW '.$body);
        }
    }

    public function up(): void
    {
        $this->parentIndex(true);
        if (Schema::hasTable('facility_history')) {
            $this->assertTable();
        } else {
            DB::unprepared($this->tableSql());
        }
        $this->guard('UPDATE', true);
        $this->guard('DELETE', true);
    }

    public function down(): void
    {
        $this->parentIndex(false);
        $this->guard('UPDATE', false);
        $this->guard('DELETE', false);
        if (Schema::hasTable('facility_history')) {
            $this->assertTable();
            if (DB::table('facility_history')->exists()) {
                throw new LogicException('facility_history_retained');
            }
            DB::statement('DROP TABLE facility_history');
        }
        if (DB::select("SHOW INDEX FROM facilities WHERE Key_name='facility_history_scope_parent'")) {
            DB::statement('ALTER TABLE facilities DROP INDEX facility_history_scope_parent');
        }
    }
};
