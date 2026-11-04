<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function widths(): array
    {
        if (DB::connection()->getDriverName() !== 'mysql' || DB::transactionLevel() !== 0) {
            throw new LogicException('facility_ddl_requires_committed_mysql');
        }
        $rows = DB::table('information_schema.COLUMNS')->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', 'facilities')->whereIn('COLUMN_NAME', ['name', 'address', 'contact'])->get()->keyBy('COLUMN_NAME');
        foreach (['name' => [100, 160], 'address' => [200, 300], 'contact' => [30, 50]] as $field => $allowed) {
            $row = $rows[$field] ?? null;
            if (! $row || $row->DATA_TYPE !== 'varchar' || ! in_array((int) $row->CHARACTER_MAXIMUM_LENGTH, $allowed, true)
                || $row->IS_NULLABLE !== ($field === 'contact' ? 'YES' : 'NO') || $row->COLLATION_NAME !== 'utf8mb4_0900_ai_ci') {
                throw new LogicException('facility_widths_incompatible');
            }
        }

        return $rows->map(fn ($row) => (int) $row->CHARACTER_MAXIMUM_LENGTH)->all();
    }

    private function alter(int $name, int $address, int $contact): void
    {
        DB::statement("ALTER TABLE facilities MODIFY name VARCHAR($name) NOT NULL, MODIFY address VARCHAR($address) NOT NULL, MODIFY contact VARCHAR($contact) NULL DEFAULT NULL");
    }

    public function up(): void
    {
        $widths = $this->widths();
        if ($widths['name'] !== 160 || $widths['address'] !== 300 || $widths['contact'] !== 50) {
            $this->alter(160, 300, 50);
        }
    }

    public function down(): void
    {
        $this->widths();
        if (DB::table('facilities')->whereRaw('CHAR_LENGTH(name)>100 OR CHAR_LENGTH(address)>200 OR CHAR_LENGTH(contact)>30')->exists()) {
            throw new LogicException('facility_widths_retained');
        }
        // The strict atomic ALTER also refuses a concurrent wide write after the check.
        // Never permit a permissive migration session to truncate retained values.
        $mode = DB::selectOne('SELECT @@SESSION.sql_mode AS mode')->mode;
        DB::statement('SET SESSION sql_mode = ?', [implode(',', array_unique([...array_filter(explode(',', $mode)), 'STRICT_ALL_TABLES']))]);
        try {
            $this->alter(100, 200, 30);
        } finally {
            DB::statement('SET SESSION sql_mode = ?', [$mode]);
        }
    }
};
