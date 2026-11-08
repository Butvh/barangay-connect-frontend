<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbox_events', function (Blueprint $t) {
            $t->id();
            $t->uuid('event_id')->unique();
            $t->unsignedTinyInteger('version')->default(1);
            $t->string('type', 80);
            $t->foreignId('barangay_id')->constrained()->restrictOnDelete();
            $t->string('resource_type', 40);
            $t->unsignedBigInteger('resource_id');
            $t->timestamp('occurred_at', 6);
            $t->json('payload');
            $t->string('template_key', 80);
            $t->timestamp('created_at', 6)->useCurrent();
            $t->uuid('claim_token')->nullable();
            $t->timestamp('lease_until', 6)->nullable();
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->timestamp('next_attempt_at', 6)->nullable();
            $t->timestamp('dispatched_at', 6)->nullable();
            $t->string('last_error', 60)->nullable();
            $t->unique(['id', 'barangay_id']);
            $t->index(['dispatched_at', 'next_attempt_at', 'lease_until'], 'outbox_ready_index');
        });
        DB::statement('ALTER TABLE outbox_events ADD CONSTRAINT outbox_payload_bound CHECK (version = 1 AND JSON_STORAGE_SIZE(payload) <= 2048)');
        Schema::create('outbox_recipients', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('outbox_event_id');
            $t->unsignedBigInteger('recipient_id');
            $t->unsignedBigInteger('barangay_id');
            $t->boolean('in_app')->default(true);
            $t->boolean('sms')->default(false);
            $t->unique(['outbox_event_id', 'recipient_id']);
            $t->foreign(['outbox_event_id', 'barangay_id'], 'outbox_recipient_event_scope_fk')->references(['id', 'barangay_id'])->on('outbox_events')->restrictOnDelete();
            $t->foreign(['recipient_id', 'barangay_id'], 'outbox_recipient_user_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
        Schema::create('delivery_receipts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('outbox_event_id')->constrained()->restrictOnDelete();
            $t->foreignId('recipient_id')->constrained('users')->restrictOnDelete();
            $t->enum('channel', ['in_app', 'sms']);
            $t->string('template_key', 80);
            $t->enum('state', ['pending', 'complete', 'failed'])->default('pending');
            $t->timestamp('completed_at', 6)->nullable();
            $t->timestamps(6);
            $t->unique(['outbox_event_id', 'recipient_id', 'channel', 'template_key'], 'receipt_logical_delivery_unique');
        });
        Schema::create('notifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('recipient_id')->constrained('users')->restrictOnDelete();
            $t->uuid('event_id');
            $t->string('kind', 40);
            $t->string('target', 200);
            $t->string('title', 200);
            $t->string('description', 500)->nullable();
            $t->timestamp('read_at', 6)->nullable();
            $t->timestamp('dismissed_at', 6)->nullable();
            $t->timestamps(6);
            $t->unique(['event_id', 'recipient_id']);
            $t->index(['recipient_id', 'dismissed_at', 'read_at', 'created_at'], 'notification_inbox_index');
        });
        DB::statement("ALTER TABLE notifications ADD CONSTRAINT notification_target_check CHECK (target REGEXP '^[a-z][a-z0-9-]*[.]html([?][a-z0-9_=&-]+)?$')");
        Schema::create('sms_deliveries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('receipt_id')->unique()->constrained('delivery_receipts')->restrictOnDelete();
            $t->text('destination')->nullable();
            $t->char('destination_digest', 64)->nullable();
            $t->enum('state', ['pending', 'blocked', 'sending', 'accepted', 'network_sent', 'failed', 'refunded', 'uncertain'])->default('pending');
            $t->string('provider_message_id', 80)->nullable()->unique();
            $t->enum('provider_status', ['Queued', 'Pending', 'Sent', 'Failed', 'Refunded'])->nullable();
            $t->uuid('claim_token')->nullable();
            $t->timestamp('lease_until', 6)->nullable();
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->string('last_error', 60)->nullable();
            $t->timestamp('next_attempt_at', 6)->nullable();
            $t->timestamp('reconcile_at', 6)->nullable();
            $t->unsignedInteger('estimated_segments')->default(1);
            $t->timestamp('budget_reserved_at', 6)->nullable();
            $t->timestamps(6);
            $t->index(['state', 'next_attempt_at', 'lease_until'], 'sms_ready_index');
            $t->index(['state', 'reconcile_at']);
        });
        Schema::create('sms_attempts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sms_delivery_id')->constrained()->restrictOnDelete();
            $t->unsignedSmallInteger('attempt');
            $t->uuid('claim_token');
            $t->enum('outcome', ['started', 'accepted', 'rejected', 'uncertain']);
            $t->unsignedSmallInteger('http_status')->nullable();
            $t->string('error_class', 60)->nullable();
            $t->string('provider_message_id', 80)->nullable();
            $t->timestamp('started_at', 6);
            $t->timestamp('finished_at', 6)->nullable();
            $t->unique(['sms_delivery_id', 'attempt']);
        });
        Schema::create('messaging_budgets', function (Blueprint $t) {
            $t->date('day')->primary();
            $t->unsignedInteger('reserved_segments')->default(0);
        });
        Schema::create('messaging_rate_windows', function (Blueprint $t) {
            $t->string('endpoint', 30)->primary();
            $t->timestamp('window_start', 6);
            $t->unsignedInteger('requests')->default(0);
            $t->timestamp('blocked_until', 6)->nullable();
        });
        Schema::create('make_dispatches', function (Blueprint $t) {
            $t->id();
            $t->foreignId('outbox_event_id')->unique()->constrained()->restrictOnDelete();
            $t->uuid('claim_token')->nullable();
            $t->timestamp('lease_until', 6)->nullable();
            $t->unsignedSmallInteger('attempts')->default(0);
            $t->timestamp('next_attempt_at', 6)->nullable();
            $t->timestamp('accepted_at', 6)->nullable();
            $t->timestamp('command_received_at', 6)->nullable();
            $t->string('last_error', 60)->nullable();
            $t->timestamps(6);
            $t->index(['command_received_at', 'next_attempt_at']);
        });
        Schema::create('make_commands', function (Blueprint $t) {
            $t->id();
            $t->foreignId('outbox_event_id')->unique()->constrained()->restrictOnDelete();
            $t->string('credential_id', 40);
            $t->char('payload_hash', 64);
            $t->timestamp('received_at', 6);
        });
    }

    public function down(): void
    {
        foreach (['make_commands', 'make_dispatches', 'messaging_rate_windows', 'messaging_budgets', 'sms_attempts', 'sms_deliveries', 'notifications', 'delivery_receipts', 'outbox_recipients', 'outbox_events'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
