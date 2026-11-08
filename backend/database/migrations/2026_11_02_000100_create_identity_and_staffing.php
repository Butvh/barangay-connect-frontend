<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $version = DB::selectOne('SELECT VERSION() AS version')->version;
        if (str_contains($version, 'MariaDB') || ! preg_match('/^8\.(4|[5-9])\./', $version)) {
            throw new RuntimeException('DBA migrations require genuine MySQL 8.4+; verify the shared target before applying.');
        }
        Schema::create('barangays', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100);
            $t->string('address')->nullable();
            $t->string('municipality', 100)->nullable();
            $t->string('map_scope', 100)->nullable();
            $t->timestamps(6);
        });
        Schema::create('households', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barangay_id')->constrained()->restrictOnDelete();
            $t->string('address', 200);
            $t->decimal('map_x', 7, 4)->nullable();
            $t->decimal('map_y', 7, 4)->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps(6);
            $t->unique(['id', 'barangay_id']);
        });
        DB::statement('ALTER TABLE households ADD CONSTRAINT households_pin_check CHECK ((map_x IS NULL AND map_y IS NULL) OR (map_x IS NOT NULL AND map_y IS NOT NULL AND map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100))');
        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barangay_id')->constrained()->restrictOnDelete();
            $t->unsignedBigInteger('household_id')->nullable();
            $t->string('full_name', 100);
            $t->string('email', 254)->unique();
            $t->string('password');
            $t->string('contact_number', 30)->nullable();
            $t->enum('account_status', ['Active', 'Inactive'])->default('Active');
            $t->boolean('is_resident')->default(false);
            $t->boolean('is_captain')->default(false);
            $t->timestamp('last_login_at', 6)->nullable();
            $t->timestamp('email_verified_at', 6)->nullable();
            $t->rememberToken();
            $t->timestamps(6);
            $t->unique(['id', 'barangay_id']);
            $t->foreign(['household_id', 'barangay_id'], 'users_household_scope_fk')->references(['id', 'barangay_id'])->on('households')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_email_normalized_check CHECK (BINARY email = BINARY LOWER(TRIM(email)))');
        Schema::create('tanod_memberships', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id');
            $t->unsignedBigInteger('barangay_id');
            $t->string('pool_reference', 100)->nullable();
            $t->boolean('active')->default(true);
            $t->timestamp('joined_at', 6)->nullable();
            $t->timestamps(6);
            $t->unique(['user_id', 'barangay_id']);
            $t->foreign(['user_id', 'barangay_id'], 'tanod_user_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
        Schema::create('personnel_appointments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id')->unique();
            $t->unsignedBigInteger('barangay_id');
            $t->enum('role', ['secretary', 'responder', 'rescuer'])->nullable();
            $t->enum('source', ['existing', 'external', 'tanod'])->nullable();
            $t->enum('status', ['Active', 'Inactive', 'Unassigned']);
            $t->date('effective_date')->nullable();
            $t->foreignId('assigned_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('address', 300)->nullable();
            $t->string('emergency_contact', 200)->nullable();
            $t->string('notes', 500)->nullable();
            $t->boolean('legacy')->default(false);
            $t->timestamp('added_externally_at', 6)->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps(6);
            $t->unique(['id', 'barangay_id']);
            $t->index(['barangay_id', 'role', 'status']);
            $t->foreign(['user_id', 'barangay_id'], 'appointment_user_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE personnel_appointments ADD CONSTRAINT appointment_role_status_check CHECK ((role IS NULL AND status = 'Unassigned') OR (role IS NOT NULL AND status IN ('Active','Inactive')))");
        Schema::create('personnel_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('appointment_id')->constrained('personnel_appointments')->restrictOnDelete();
            $t->string('action', 30);
            $t->string('from_role', 20)->nullable();
            $t->string('to_role', 20)->nullable();
            $t->string('source', 20)->nullable();
            $t->string('status', 20)->nullable();
            $t->date('effective_date')->nullable();
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('role_at_action', 20)->nullable();
            $t->string('notes', 500)->nullable();
            $t->timestamp('occurred_at', 6)->nullable();
            $t->timestamp('recorded_at', 6)->useCurrent();
            $t->index(['appointment_id', 'recorded_at']);
        });
        Schema::create('capacity_guards', function (Blueprint $t) {
            $t->id();
            $t->enum('scope_type', ['barangay', 'person']);
            $t->unsignedBigInteger('scope_id');
            $t->enum('kind', ['staffing', 'operations', 'verification', 'sos', 'recovery']);
            $t->unique(['scope_type', 'scope_id', 'kind'], 'capacity_guard_unique');
        });
    }

    public function down(): void
    {
        foreach (['capacity_guards', 'personnel_history', 'personnel_appointments', 'tanod_memberships', 'users', 'households', 'barangays'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
