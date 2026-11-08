<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('auth_version')->default(0);
        });
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_auth_version_nonnegative CHECK (auth_version >= 0)');
    }

    public function down(): void
    {
        // Destructive security rollback: disposable databases only; shared systems use a forward fix.
        DB::statement('ALTER TABLE users DROP CHECK users_auth_version_nonnegative');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('auth_version'));
    }
};
