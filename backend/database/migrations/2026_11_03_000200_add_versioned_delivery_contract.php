<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE outbox_events DROP CHECK outbox_payload_bound, ADD CONSTRAINT outbox_payload_bound CHECK (version IN (1, 2) AND JSON_STORAGE_SIZE(payload) <= 2048)');
        Schema::table('outbox_events', function (Blueprint $t) {
            $t->timestamp('blocked_at', 6)->nullable();
            $t->index(['blocked_at', 'dispatched_at', 'next_attempt_at'], 'outbox_diagnostic_ready_index');
        });
        Schema::table('outbox_recipients', function (Blueprint $t) {
            // Historical v1 audience is unknown; do not infer or backfill it.
            $t->enum('audience', ['resident', 'official'])->nullable();
        });
        DB::statement('ALTER TABLE outbox_recipients ADD CONSTRAINT recipient_channel_boolean_check CHECK (in_app IN (0,1) AND sms IN (0,1))');
        Schema::table('delivery_receipts', function (Blueprint $t) {
            $t->string('diagnostic_code', 60)->nullable();
            $t->timestamp('failed_at', 6)->nullable();
            $t->foreign(['outbox_event_id', 'recipient_id'], 'receipt_authorized_recipient_fk')->references(['outbox_event_id', 'recipient_id'])->on('outbox_recipients')->restrictOnDelete();
        });
        Schema::table('notifications', function (Blueprint $t) {
            $t->unsignedBigInteger('barangay_id')->nullable();
            $t->string('resource_type', 40)->nullable();
            $t->unsignedBigInteger('resource_id')->nullable();
            $t->enum('audience', ['resident', 'official'])->nullable();
            $t->enum('event_status', ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'])->nullable();
            $t->string('template_key', 80)->nullable();
            $t->foreign(['recipient_id', 'barangay_id'], 'notification_recipient_scope_fk')->references(['id', 'barangay_id'])->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::table('outbox_events')->where('version', 2)->exists()) {
            throw new RuntimeException('Version 2 events require a reviewed forward fix, not a destructive downgrade.');
        }
        Schema::table('notifications', function (Blueprint $t) {
            $t->dropForeign('notification_recipient_scope_fk');
            $t->dropColumn(['barangay_id', 'resource_type', 'resource_id', 'audience', 'event_status', 'template_key']);
        });
        Schema::table('delivery_receipts', function (Blueprint $t) {
            $t->dropForeign('receipt_authorized_recipient_fk');
            $t->dropColumn(['diagnostic_code', 'failed_at']);
        });
        DB::statement('ALTER TABLE outbox_recipients DROP CHECK recipient_channel_boolean_check');
        Schema::table('outbox_recipients', fn (Blueprint $t) => $t->dropColumn('audience'));
        Schema::table('outbox_events', function (Blueprint $t) {
            $t->dropIndex('outbox_diagnostic_ready_index');
            $t->dropColumn('blocked_at');
        });
        DB::statement('ALTER TABLE outbox_events DROP CHECK outbox_payload_bound, ADD CONSTRAINT outbox_payload_bound CHECK (version = 1 AND JSON_STORAGE_SIZE(payload) <= 2048)');
    }
};
