<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verifications', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('resident_id');
            $t->unsignedBigInteger('barangay_id');
            $t->enum('review_status', ['Pending', 'Resubmission requested', 'Approved', 'Rejected', 'Expired']);
            $t->timestamp('deadline_at', 6)->nullable();
            $t->unsignedBigInteger('current_submission_id')->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->foreignId('reviewer_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->timestamp('reviewed_at', 6)->nullable();
            $t->string('rejection_reason', 1000)->nullable();
            $t->string('correction_reason', 1000)->nullable();
            $t->timestamp('correction_requested_at', 6)->nullable();
            $t->timestamps(6);
            $t->unsignedBigInteger('current_resident_key')->nullable()->storedAs("CASE WHEN review_status IN ('Pending','Resubmission requested','Approved') THEN resident_id ELSE NULL END")->unique('verification_current_resident_unique');
            $t->unique(['id', 'barangay_id']);
            $t->index(['barangay_id', 'review_status', 'deadline_at']);
            $t->index(['resident_id', 'created_at']);
            $t->foreign(['resident_id', 'barangay_id'], 'verification_resident_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
        Schema::create('verification_submissions', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('verification_id');
            $t->unsignedBigInteger('barangay_id');
            $t->unsignedInteger('revision');
            $t->timestamp('submitted_at', 6);
            $t->unique(['verification_id', 'revision']);
            $t->unique(['id', 'verification_id'], 'submission_application_unique');
            $t->unique(['id', 'barangay_id']);
            $t->foreign(['verification_id', 'barangay_id'], 'submission_scope_fk')->references(['id', 'barangay_id'])->on('verifications')->restrictOnDelete();
        });
        Schema::table('verifications', function (Blueprint $t) {
            $t->foreign(['current_submission_id', 'id'], 'verification_current_submission_fk')->references(['id', 'verification_id'])->on('verification_submissions')->restrictOnDelete();
        });
        Schema::create('documents', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('barangay_id');
            $t->unsignedBigInteger('submission_id')->nullable();
            $t->unsignedBigInteger('appointment_id')->nullable();
            $t->foreignId('uploader_id')->constrained('users')->restrictOnDelete();
            $t->string('disk', 30)->default('local');
            $t->string('object_key', 250)->unique();
            $t->string('original_name', 200);
            $t->enum('kind', ['valid_id', 'proof_of_residence', 'personnel_requirement']);
            $t->enum('mime', ['image/jpeg', 'image/png', 'application/pdf']);
            $t->unsignedInteger('bytes');
            $t->timestamps(6);
            $t->foreign(['submission_id', 'barangay_id'], 'document_submission_scope_fk')->references(['id', 'barangay_id'])->on('verification_submissions')->restrictOnDelete();
            $t->foreign(['appointment_id', 'barangay_id'], 'document_appointment_scope_fk')->references(['id', 'barangay_id'])->on('personnel_appointments')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE documents ADD CONSTRAINT document_owner_size_check CHECK ((submission_id IS NOT NULL AND appointment_id IS NULL AND kind IN ('valid_id','proof_of_residence') AND bytes BETWEEN 1 AND 10485760) OR (submission_id IS NULL AND appointment_id IS NOT NULL AND kind = 'personnel_requirement' AND bytes BETWEEN 1 AND 5242880))");
        Schema::create('facilities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('managed_by_barangay_id')->constrained('barangays')->restrictOnDelete();
            $t->enum('visibility', ['local', 'shared'])->default('local');
            $t->string('name', 100);
            $t->enum('type', ['Evacuation Center', 'Hospital']);
            $t->string('address', 200);
            $t->unsignedInteger('capacity')->nullable();
            $t->string('contact', 30)->nullable();
            $t->text('notes')->nullable();
            $t->boolean('active')->default(true);
            $t->decimal('map_x', 7, 4)->nullable();
            $t->decimal('map_y', 7, 4)->nullable();
            $t->string('map_scope', 100)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->foreignId('updated_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps(6);
            $t->index(['managed_by_barangay_id', 'type', 'active']);
            $t->index(['visibility', 'type', 'active']);
        });
        DB::statement('ALTER TABLE facilities ADD CONSTRAINT facility_pin_check CHECK ((map_x IS NULL AND map_y IS NULL) OR (map_x IS NOT NULL AND map_y IS NOT NULL AND map_x BETWEEN 0 AND 100 AND map_y BETWEEN 0 AND 100 AND map_scope IS NOT NULL))');
    }

    public function down(): void
    {
        Schema::dropIfExists('facilities');
        Schema::dropIfExists('documents');
        Schema::table('verifications', fn (Blueprint $t) => $t->dropForeign('verification_current_submission_fk'));
        Schema::dropIfExists('verification_submissions');
        Schema::dropIfExists('verifications');
    }
};
