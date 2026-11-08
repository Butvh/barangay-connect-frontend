<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emergency_alerts', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('barangay_id');
            $t->unsignedBigInteger('resident_id');
            $t->unsignedBigInteger('household_id');
            $t->enum('alert_type', ['Fire', 'Flood', 'Typhoon/Storm', 'Landslide', 'Earthquake', 'Other']);
            $t->text('description')->nullable();
            $t->string('location_label', 200);
            $t->string('address_snapshot', 200)->nullable();
            $t->decimal('map_x', 7, 4)->nullable();
            $t->decimal('map_y', 7, 4)->nullable();
            $t->unsignedSmallInteger('victim_count')->nullable();
            $t->enum('status', ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'])->default('Pending');
            $t->unsignedInteger('assignment_revision')->default(0);
            $t->timestamp('reported_at', 6);
            $t->timestamp('acknowledged_at', 6)->nullable();
            $t->timestamp('resolved_at', 6)->nullable();
            $t->foreignId('acknowledged_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->foreignId('resolved_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamps(6);
            $t->unique(['id', 'barangay_id']);
            $t->index(['barangay_id', 'status', 'reported_at']);
            $t->unsignedBigInteger('active_resident_key')->nullable()->storedAs("CASE WHEN status <> 'Resolved' THEN resident_id ELSE NULL END")->unique('alert_active_resident_unique');
            $t->foreign(['resident_id', 'barangay_id'], 'alert_resident_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
            $t->foreign(['household_id', 'barangay_id'], 'alert_household_scope_fk')->references(['id', 'barangay_id'])->on('households')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE emergency_alerts ADD CONSTRAINT alert_victims_check CHECK (victim_count IS NULL OR victim_count <= 9999), ADD CONSTRAINT alert_pin_check CHECK ((map_x IS NULL AND map_y IS NULL) OR (map_x IS NOT NULL AND map_y IS NOT NULL AND map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100))');
        Schema::create('alert_assignments', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('alert_id');
            $t->unsignedBigInteger('barangay_id');
            $t->unsignedBigInteger('user_id');
            $t->enum('role', ['responder', 'rescuer']);
            $t->foreignId('assigned_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('personnel_name', 100)->nullable();
            $t->string('assigned_by_name', 100)->nullable();
            $t->timestamp('assigned_at', 6)->nullable();
            $t->enum('status', ['active', 'completed', 'cancelled', 'reassigned', 'closed']);
            $t->foreignId('ended_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamp('ended_at', 6)->nullable();
            $t->string('end_reason', 1000)->nullable();
            $t->foreignId('override_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamp('override_at', 6)->nullable();
            $t->string('override_reason', 1000)->nullable();
            $t->boolean('legacy')->default(false);
            $t->timestamps(6);
            $t->string('active_role', 10)->nullable()->storedAs("CASE WHEN status = 'active' THEN role ELSE NULL END");
            $t->unique(['alert_id', 'active_role'], 'assignment_active_role_unique');
            $t->unique(['id', 'alert_id', 'user_id'], 'assignment_log_owner_unique');
            $t->index(['user_id', 'role', 'status']);
            $t->index(['alert_id', 'role', 'status']);
            $t->index(['barangay_id', 'assigned_at']);
            $t->foreign(['alert_id', 'barangay_id'], 'assignment_alert_scope_fk')->references(['id', 'barangay_id'])->on('emergency_alerts')->restrictOnDelete();
            $t->foreign(['user_id', 'barangay_id'], 'assignment_user_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE alert_assignments ADD CONSTRAINT assignment_override_check CHECK ((override_by IS NULL AND override_at IS NULL AND override_reason IS NULL) OR (override_by IS NOT NULL AND override_at IS NOT NULL AND override_reason IS NOT NULL AND CHAR_LENGTH(TRIM(override_reason)) > 0)), ADD CONSTRAINT assignment_start_evidence_check CHECK (legacy = 1 OR (assigned_at IS NOT NULL AND assigned_by IS NOT NULL))');
        Schema::create('alert_responses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('alert_id')->constrained('emergency_alerts')->restrictOnDelete();
            $t->unsignedBigInteger('assignment_id')->nullable();
            $t->foreignId('responder_id')->constrained('users')->restrictOnDelete();
            $t->enum('response_type', ['First aid', 'Assessment', 'Evacuation assistance', 'Other']);
            $t->enum('response_status', ['Responding', 'Completed']);
            $t->boolean('rescue_required')->nullable();
            $t->boolean('legacy')->default(false);
            $t->string('provenance', 100)->nullable();
            $t->text('notes')->nullable();
            $t->timestamp('responded_at', 6)->nullable();
            $t->timestamps(6);
            $t->index(['alert_id', 'responded_at']);
            $t->foreign(['assignment_id', 'alert_id', 'responder_id'], 'response_assignment_owner_fk')->references(['id', 'alert_id', 'user_id'])->on('alert_assignments')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE alert_responses ADD CONSTRAINT response_evidence_check CHECK ((legacy = 1 AND provenance IS NOT NULL) OR (legacy = 0 AND assignment_id IS NOT NULL AND rescue_required IS NOT NULL AND responded_at IS NOT NULL))');
        Schema::create('rescues', function (Blueprint $t) {
            $t->id();
            $t->foreignId('alert_id')->constrained('emergency_alerts')->restrictOnDelete();
            $t->unsignedBigInteger('assignment_id')->nullable();
            $t->foreignId('rescuer_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('facility_id')->constrained()->restrictOnDelete();
            $t->json('destination_snapshot');
            $t->enum('rescue_status', ['In progress', 'Completed']);
            $t->text('notes')->nullable();
            $t->timestamp('rescued_at', 6)->nullable();
            $t->boolean('legacy')->default(false);
            $t->string('provenance', 100)->nullable();
            $t->timestamps(6);
            $t->index(['alert_id', 'rescued_at']);
            $t->foreign(['assignment_id', 'alert_id', 'rescuer_id'], 'rescue_assignment_owner_fk')->references(['id', 'alert_id', 'user_id'])->on('alert_assignments')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE rescues ADD CONSTRAINT rescue_evidence_check CHECK ((legacy = 1 AND provenance IS NOT NULL) OR (legacy = 0 AND assignment_id IS NOT NULL AND rescued_at IS NOT NULL))');
        Schema::create('incident_status_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('alert_id')->constrained('emergency_alerts')->restrictOnDelete();
            $t->enum('stage', ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved']);
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('role_at_action', 20)->nullable();
            $t->timestamp('occurred_at', 6)->nullable();
            $t->string('evidence', 100);
            $t->unsignedInteger('sequence');
            $t->timestamp('recorded_at', 6)->useCurrent();
            $t->unique(['alert_id', 'sequence']);
        });
    }

    public function down(): void
    {
        foreach (['incident_status_history', 'rescues', 'alert_responses', 'alert_assignments', 'emergency_alerts'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
