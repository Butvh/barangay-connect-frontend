<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barangay_id')->constrained()->restrictOnDelete();
            $t->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $t->string('author_role', 20);
            $t->string('title', 200);
            $t->text('content');
            $t->enum('status', ['Active', 'Archived', 'Retracted']);
            $t->timestamp('published_at', 6)->nullable();
            $t->timestamp('expires_at', 6)->nullable();
            $t->timestamp('archived_at', 6)->nullable();
            $t->timestamp('retracted_at', 6)->nullable();
            $t->string('retraction_reason', 500)->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps(6);
            $t->index(['barangay_id', 'status', 'published_at', 'expires_at']);
        });
        Schema::create('announcement_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('announcement_id')->constrained()->restrictOnDelete();
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('role_at_action', 20)->nullable();
            $t->string('action', 30);
            $t->string('reason', 500)->nullable();
            $t->json('snapshot')->nullable();
            $t->timestamp('occurred_at', 6)->nullable();
            $t->timestamp('recorded_at', 6)->useCurrent();
            $t->index(['announcement_id', 'recorded_at']);
        });
        Schema::create('community_feedback', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('barangay_id');
            $t->unsignedBigInteger('resident_id');
            $t->enum('kind', ['complaint', 'suggestion', 'general']);
            $t->string('title', 200)->nullable();
            $t->text('description')->nullable();
            $t->string('category', 100)->nullable();
            $t->string('location', 200)->nullable();
            $t->unsignedBigInteger('assigned_tanod_id')->nullable();
            $t->enum('status', ['Pending', 'Assigned', 'Resolved'])->nullable();
            $t->unsignedTinyInteger('rating')->nullable();
            $t->text('comment')->nullable();
            $t->timestamp('submitted_at', 6);
            $t->timestamp('assigned_at', 6)->nullable();
            $t->timestamp('resolved_at', 6)->nullable();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps(6);
            $t->index(['barangay_id', 'kind', 'status', 'submitted_at']);
            $t->foreign(['resident_id', 'barangay_id'], 'feedback_resident_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
            $t->foreign(['assigned_tanod_id', 'barangay_id'], 'feedback_tanod_scope_fk')->references(['user_id', 'barangay_id'])->on('tanod_memberships')->restrictOnDelete();
        });
        DB::statement("ALTER TABLE community_feedback ADD CONSTRAINT feedback_kind_check CHECK ((kind = 'general' AND rating IS NOT NULL AND rating BETWEEN 1 AND 5 AND comment IS NOT NULL AND CHAR_LENGTH(TRIM(comment)) BETWEEN 1 AND 2000 AND status IS NULL AND assigned_tanod_id IS NULL AND assigned_at IS NULL AND resolved_at IS NULL) OR (kind IN ('complaint','suggestion') AND status IS NOT NULL AND rating IS NULL AND comment IS NULL))");
        Schema::create('activity_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('barangay_id')->constrained()->restrictOnDelete();
            $t->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $t->string('actor_name', 100)->nullable();
            $t->string('role_at_action', 20)->nullable();
            $t->string('resource_type', 40);
            $t->unsignedBigInteger('resource_id');
            $t->string('action', 100);
            $t->string('evidence', 100);
            $t->json('summary');
            $t->timestamp('occurred_at', 6)->nullable();
            $t->timestamp('recorded_at', 6)->useCurrent();
            $t->index(['barangay_id', 'occurred_at']);
            $t->index(['actor_id', 'occurred_at']);
            $t->index(['resource_type', 'resource_id', 'occurred_at']);
        });
        DB::statement('ALTER TABLE activity_logs ADD CONSTRAINT audit_summary_bound CHECK (JSON_STORAGE_SIZE(summary) <= 4096)');
        Schema::create('idempotency_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $t->string('route', 100);
            $t->char('key_digest', 64);
            $t->char('request_hash', 64);
            $t->unsignedSmallInteger('http_status')->nullable();
            $t->json('outcome')->nullable();
            $t->timestamp('expires_at', 6);
            $t->timestamps(6);
            $t->unique(['actor_id', 'route', 'key_digest'], 'idempotency_actor_route_key_unique');
            $t->index('expires_at');
        });
        Schema::create('password_recovery_challenges', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->nullable()->constrained()->restrictOnDelete();
            $t->char('email_digest', 64);
            $t->char('code_digest', 64);
            $t->unsignedTinyInteger('failed_attempts')->default(0);
            $t->unsignedTinyInteger('max_attempts')->default(5);
            $t->timestamp('expires_at', 6);
            $t->timestamp('resend_available_at', 6);
            $t->timestamp('verified_at', 6)->nullable();
            $t->timestamp('superseded_at', 6)->nullable();
            $t->timestamp('consumed_at', 6)->nullable();
            $t->char('authorization_digest', 64)->nullable()->unique();
            $t->timestamp('authorization_expires_at', 6)->nullable();
            $t->timestamps(6);
            $t->index(['email_digest', 'created_at']);
            $t->index('expires_at');
        });
        DB::statement('ALTER TABLE password_recovery_challenges ADD CONSTRAINT recovery_attempt_check CHECK (max_attempts = 5 AND failed_attempts <= max_attempts), ADD CONSTRAINT recovery_window_check CHECK (expires_at <= TIMESTAMPADD(MINUTE, 10, created_at) AND resend_available_at >= TIMESTAMPADD(SECOND, 60, created_at)), ADD CONSTRAINT recovery_authorization_pair_check CHECK ((authorization_digest IS NULL AND authorization_expires_at IS NULL) OR (authorization_digest IS NOT NULL AND authorization_expires_at IS NOT NULL))');
    }

    public function down(): void
    {
        foreach (['password_recovery_challenges', 'idempotency_requests', 'activity_logs', 'community_feedback', 'announcement_history', 'announcements'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
