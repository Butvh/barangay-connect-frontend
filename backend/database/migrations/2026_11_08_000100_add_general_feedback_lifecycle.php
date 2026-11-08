<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** PR51 contract 5428762: administrative markers only; no historical backfill. */
return new class extends Migration
{
    private const COLUMNS = [
        'reviewed_by' => 'BIGINT UNSIGNED NULL', 'reviewed_at' => 'TIMESTAMP(6) NULL DEFAULT NULL',
        'archived_by' => 'BIGINT UNSIGNED NULL', 'archived_at' => 'TIMESTAMP(6) NULL DEFAULT NULL',
    ];

    private const INDEXES = [
        'feedback_review_actor_scope' => ['reviewed_by', 'barangay_id'],
        'feedback_archive_actor_scope' => ['archived_by', 'barangay_id'],
        'feedback_general_queue' => ['barangay_id', 'kind', 'archived_at', 'submitted_at', 'id'],
    ];

    private const FOREIGN_KEYS = [
        'feedback_review_actor_scope_fk' => ['reviewed_by', 'barangay_id'],
        'feedback_archive_actor_scope_fk' => ['archived_by', 'barangay_id'],
    ];

    private const CHECKS = [
        'feedback_review_pair_check' => '(reviewed_by IS NULL AND reviewed_at IS NULL) OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)',
        'feedback_archive_pair_check' => '(archived_by IS NULL AND archived_at IS NULL) OR (archived_by IS NOT NULL AND archived_at IS NOT NULL)',
        'feedback_lifecycle_kind_check' => "kind = 'general' OR (reviewed_by IS NULL AND reviewed_at IS NULL AND archived_by IS NULL AND archived_at IS NULL)",
        'feedback_lifecycle_order_check' => 'reviewed_at IS NULL OR archived_at IS NULL OR archived_at >= reviewed_at',
    ];

    private function columns(): array
    {
        $rows = DB::select("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,DATETIME_PRECISION,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='community_feedback'");

        return array_column($rows, null, 'COLUMN_NAME');
    }

    private function index(string $name): array
    {
        return DB::select('SHOW INDEX FROM community_feedback WHERE Key_name=?', [$name]);
    }

    private function foreignKey(string $name): array
    {
        return DB::select("SELECT k.COLUMN_NAME,k.REFERENCED_TABLE_SCHEMA,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.DELETE_RULE,r.UPDATE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA=DATABASE() AND k.TABLE_NAME='community_feedback' AND k.CONSTRAINT_NAME=? ORDER BY k.ORDINAL_POSITION", [$name]);
    }

    private function check(string $table, string $name): ?object
    {
        return DB::selectOne('SELECT c.CHECK_CLAUSE,t.ENFORCED FROM information_schema.TABLE_CONSTRAINTS t JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE t.CONSTRAINT_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND t.CONSTRAINT_NAME=?', [$table, $name]);
    }

    /** Compare expressions as canonicalized by this MySQL server, preserving parentheses. */
    private function assertChecks(): void
    {
        $present = [];
        foreach (self::CHECKS as $name => $expression) {
            if ($row = $this->check('community_feedback', $name)) {
                $present[$name] = $row;
            }
        }
        if (! $present) {
            return;
        }
        $probe = 'dba_feedback_shape_'.bin2hex(random_bytes(6));
        $prefix = 'gf_'.bin2hex(random_bytes(6)).'_';
        $definitions = ["kind ENUM('complaint','suggestion','general') NOT NULL"];
        foreach (self::COLUMNS as $name => $definition) {
            $definitions[] = $name.' '.$definition;
        }
        $names = [];
        foreach (self::CHECKS as $name => $expression) {
            $names[$name] = $prefix.count($names);
            $definitions[] = 'CONSTRAINT '.$names[$name].' CHECK ('.$expression.')';
        }
        DB::statement('CREATE TABLE '.$probe.' ('.implode(',', $definitions).') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci');
        try {
            $normalize = fn ($value) => preg_replace('/\s+/', ' ', trim($value));
            foreach ($present as $name => $row) {
                $expected = $this->check($probe, $names[$name]);
                if ($row->ENFORCED !== 'YES' || $normalize($row->CHECK_CLAUSE) !== $normalize($expected->CHECK_CLAUSE)) {
                    throw new LogicException('feedback_lifecycle_incompatible_check');
                }
            }
        } finally {
            DB::statement('DROP TABLE '.$probe);
        }
    }

    /** Validate every already-existing component before adding or removing anything. */
    private function assertShape(): array
    {
        $columns = $this->columns();
        foreach (self::COLUMNS as $name => $definition) {
            if (! isset($columns[$name])) {
                continue;
            }
            $row = $columns[$name];
            $type = str_ends_with($name, '_by') ? 'bigint unsigned' : 'timestamp(6)';
            if (strtolower($row->COLUMN_TYPE) !== $type || $row->IS_NULLABLE !== 'YES' || $row->COLUMN_DEFAULT !== null || $row->EXTRA !== '') {
                throw new LogicException('feedback_lifecycle_incompatible_column');
            }
        }
        foreach (self::INDEXES as $name => $fields) {
            if ($rows = $this->index($name)) {
                if (array_column($rows, 'Column_name') !== $fields || array_filter($rows, fn ($row) => (int) $row->Non_unique !== 1 || $row->Index_type !== 'BTREE' || $row->Sub_part !== null || $row->Collation !== 'A' || $row->Visible !== 'YES')) {
                    throw new LogicException('feedback_lifecycle_incompatible_index');
                }
            }
        }
        foreach (self::FOREIGN_KEYS as $name => $fields) {
            if ($rows = $this->foreignKey($name)) {
                if (array_column($rows, 'COLUMN_NAME') !== $fields || array_column($rows, 'REFERENCED_COLUMN_NAME') !== ['id', 'barangay_id'] || array_filter($rows, fn ($row) => $row->REFERENCED_TABLE_SCHEMA !== DB::connection()->getDatabaseName() || $row->REFERENCED_TABLE_NAME !== 'users' || $row->DELETE_RULE !== 'RESTRICT' || $row->UPDATE_RULE !== 'RESTRICT')) {
                    throw new LogicException('feedback_lifecycle_incompatible_foreign_key');
                }
            }
        }
        $this->assertChecks();

        return $columns;
    }

    public function up(): void
    {
        $columns = $this->assertShape();
        $add = [];
        foreach (self::COLUMNS as $name => $definition) {
            if (! isset($columns[$name])) {
                $add[] = 'ADD COLUMN '.$name.' '.$definition;
            }
        }
        if ($add) {
            DB::statement('ALTER TABLE community_feedback '.implode(',', $add));
        }
        // MySQL DDL may commit between steps; retries validate and finish compatible partial work.
        $add = [];
        foreach (self::INDEXES as $name => $fields) {
            if (! $this->index($name)) {
                $add[] = 'ADD KEY '.$name.' ('.implode(',', $fields).')';
            }
        }
        foreach (self::FOREIGN_KEYS as $name => $fields) {
            if (! $this->foreignKey($name)) {
                $add[] = 'ADD CONSTRAINT '.$name.' FOREIGN KEY ('.implode(',', $fields).') REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT';
            }
        }
        foreach (self::CHECKS as $name => $expression) {
            if (! $this->check('community_feedback', $name)) {
                $add[] = 'ADD CONSTRAINT '.$name.' CHECK ('.$expression.')';
            }
        }
        if ($add) {
            DB::statement('ALTER TABLE community_feedback '.implode(',', $add));
        }
    }

    public function down(): void
    {
        $columns = $this->assertShape();
        $present = array_intersect(array_keys(self::COLUMNS), array_keys($columns));
        if ($present && DB::table('community_feedback')->where(function ($query) use ($present) {
            foreach ($present as $name) {
                $query->orWhereNotNull($name);
            }
        })->exists()) {
            throw new LogicException('feedback_lifecycle_retained');
        }
        $drop = [];
        foreach (self::FOREIGN_KEYS as $name => $fields) {
            if ($this->foreignKey($name)) {
                $drop[] = 'DROP FOREIGN KEY '.$name;
            }
        }
        foreach (self::CHECKS as $name => $expression) {
            if ($this->check('community_feedback', $name)) {
                $drop[] = 'DROP CHECK '.$name;
            }
        }
        foreach (self::INDEXES as $name => $fields) {
            if ($this->index($name)) {
                $drop[] = 'DROP INDEX '.$name;
            }
        }
        foreach ($present as $name) {
            $drop[] = 'DROP COLUMN '.$name;
        }
        if ($drop) {
            DB::statement('ALTER TABLE community_feedback '.implode(',', $drop));
        }
    }
};
