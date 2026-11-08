<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Ratified self-consent persistence only; P1 owns current authority and endpoints. */
return new class extends Migration
{
    private function tableSql(): string
    {
        return <<<'SQL'
CREATE TABLE notification_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('incident_review','barangay_announcements') NOT NULL,
  channel ENUM('sms') NOT NULL,
  state ENUM('granted','revoked') NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  policy_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  granted_at TIMESTAMP(6) NULL,
  revoked_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  UNIQUE KEY preference_user_purpose_channel (user_id,barangay_id,purpose,channel),
  KEY preference_scoped_audience (barangay_id,purpose,channel,state,id),
  KEY preference_recorder_scope (recorded_by,barangay_id),
  CONSTRAINT preference_user_scope_fk FOREIGN KEY (user_id,barangay_id) REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT preference_recorder_scope_fk FOREIGN KEY (recorded_by,barangay_id) REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT preference_self_check CHECK (recorded_by=user_id),
  CONSTRAINT preference_revision_check CHECK (revision BETWEEN 1 AND 9007199254740991),
  CONSTRAINT preference_version_check CHECK (policy_version='sms-consent.v1' AND
    ((purpose='incident_review' AND template_version='alert-review.v1') OR
     (purpose='barangay_announcements' AND template_version='announcement-review.v1'))),
  CONSTRAINT preference_state_check CHECK (
    (state='granted' AND granted_at IS NOT NULL AND revoked_at IS NULL) OR
    (state='revoked' AND revoked_at IS NOT NULL)),
  CONSTRAINT preference_timestamps_check CHECK (updated_at>=created_at
    AND (granted_at IS NULL OR granted_at BETWEEN created_at AND updated_at)
    AND (revoked_at IS NULL OR revoked_at BETWEEN COALESCE(granted_at,created_at) AND updated_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL;
    }

    private function guardSql(): string
    {
        return <<<'SQL'
BEGIN
  IF NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.barangay_id<>OLD.barangay_id
    OR NEW.purpose<>OLD.purpose OR NEW.channel<>OLD.channel OR NEW.recorded_by<>OLD.recorded_by
    OR NEW.created_at<>OLD.created_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='notification_preference_immutable_identity';
  END IF;
  IF NEW.revision<>OLD.revision+1 OR NEW.updated_at<OLD.updated_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='notification_preference_revision_conflict';
  END IF;
  IF (NEW.state='revoked' AND NOT (NEW.granted_at <=> OLD.granted_at))
    OR (NEW.state='granted' AND NEW.granted_at<OLD.updated_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='notification_preference_evidence_conflict';
  END IF;
END
SQL;
    }

    private function canonical(string $sql): string
    {
        return preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', str_replace("_ascii'", "_utf8mb4'", $sql));
    }

    private function assertTable(): void
    {
        $probe = 'dba_consent_shape_'.bin2hex(random_bytes(8));
        $prefix = 'cs_'.bin2hex(random_bytes(8)).'_';
        $sql = str_replace(['CREATE TABLE notification_preferences', 'CONSTRAINT preference_'],
            ['CREATE TABLE '.$probe, 'CONSTRAINT '.$prefix], $this->tableSql());
        $created = false;
        try {
            DB::unprepared($sql);
            $created = true;
            $actual = (array) DB::selectOne('SHOW CREATE TABLE notification_preferences');
            $expected = (array) DB::selectOne('SHOW CREATE TABLE '.$probe);
            $expected = str_replace([$probe, $prefix], ['notification_preferences', 'preference_'], $expected['Create Table']);
            if ($this->canonical($actual['Create Table']) !== $this->canonical($expected)) {
                throw new LogicException('notification_preferences_incompatible_partial_table');
            }
        } finally {
            if ($created) {
                DB::statement('DROP TABLE '.$probe);
            }
        }
    }

    private function triggerExists(): bool
    {
        $row = DB::selectOne("SELECT EVENT_OBJECT_TABLE,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='notification_preference_update_guard'");
        if (! $row) {
            return false;
        }
        $normalize = fn ($s) => preg_replace('/\s+/', ' ', trim($s));
        if ($row->EVENT_OBJECT_TABLE !== 'notification_preferences' || $row->ACTION_TIMING !== 'BEFORE'
            || $row->EVENT_MANIPULATION !== 'UPDATE' || $normalize($row->ACTION_STATEMENT) !== $normalize($this->guardSql())) {
            throw new LogicException('notification_preferences_incompatible_partial_trigger');
        }

        return true;
    }

    public function up(): void
    {
        $trigger = $this->triggerExists();
        if (Schema::hasTable('notification_preferences')) {
            $this->assertTable();
        } elseif ($trigger) {
            throw new LogicException('notification_preferences_incompatible_partial_dependencies');
        } else {
            DB::unprepared($this->tableSql());
        }
        if (! $trigger) {
            DB::unprepared('CREATE TRIGGER notification_preference_update_guard BEFORE UPDATE ON notification_preferences FOR EACH ROW '.$this->guardSql());
        }
    }

    public function down(): void
    {
        $this->triggerExists();
        if (Schema::hasTable('notification_preferences')) {
            $this->assertTable();
            if (DB::table('notification_preferences')->exists()) {
                throw new LogicException('notification_preferences_retained');
            }
            DB::statement('DROP TABLE notification_preferences');
        }
    }
};
