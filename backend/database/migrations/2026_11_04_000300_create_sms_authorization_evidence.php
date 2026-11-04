<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Append-only evidence from actual P1 current authority; no provider or consent grant. */
return new class extends Migration
{
    private function tableSql(): string
    {
        return <<<'SQL'
CREATE TABLE sms_authorizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sms_delivery_id BIGINT UNSIGNED NOT NULL,
  attempt SMALLINT UNSIGNED NOT NULL,
  recipient_id BIGINT UNSIGNED NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  claim_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  gate ENUM('reservation','pre_send') NOT NULL,
  purpose ENUM('incident_review','barangay_announcements') NOT NULL,
  consent_revision BIGINT UNSIGNED NOT NULL,
  policy_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_version VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  checked_at TIMESTAMP(6) NOT NULL,
  UNIQUE KEY sms_auth_gate (sms_delivery_id,claim_token,gate),
  KEY sms_auth_attempt (sms_delivery_id,attempt),
  KEY sms_auth_recipient_scope (recipient_id,barangay_id,checked_at),
  CONSTRAINT sms_auth_attempt_fk FOREIGN KEY (sms_delivery_id,attempt) REFERENCES sms_attempts(sms_delivery_id,attempt) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT sms_auth_recipient_fk FOREIGN KEY (recipient_id,barangay_id) REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT sms_auth_attempt_check CHECK (attempt>=1),
  CONSTRAINT sms_auth_revision_check CHECK (consent_revision BETWEEN 1 AND 9007199254740991),
  CONSTRAINT sms_auth_token_check CHECK (REGEXP_LIKE(claim_token,'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$','c')),
  CONSTRAINT sms_auth_version_check CHECK (policy_version='sms-consent.v1' AND
    ((purpose='incident_review' AND template_version='alert-review.v1') OR
     (purpose='barangay_announcements' AND template_version='announcement-review.v1')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL;
    }

    private function guardSql(): string
    {
        return <<<'SQL'
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='sms_authorizations_immutable';
END
SQL;
    }

    private function canonical(string $sql): string
    {
        return preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', str_replace("_ascii'", "_utf8mb4'", $sql));
    }

    private function assertTable(): void
    {
        $probe = 'dba_sms_auth_shape_'.bin2hex(random_bytes(8));
        $prefix = 'sa_'.bin2hex(random_bytes(8)).'_';
        $sql = str_replace(['CREATE TABLE sms_authorizations', 'CONSTRAINT sms_auth_'],
            ['CREATE TABLE '.$probe, 'CONSTRAINT '.$prefix], $this->tableSql());
        $created = false;
        try {
            DB::unprepared($sql);
            $created = true;
            $actual = (array) DB::selectOne('SHOW CREATE TABLE sms_authorizations');
            $expected = (array) DB::selectOne('SHOW CREATE TABLE '.$probe);
            $expected = str_replace([$probe, $prefix], ['sms_authorizations', 'sms_auth_'], $expected['Create Table']);
            if ($this->canonical($actual['Create Table']) !== $this->canonical($expected)) {
                throw new LogicException('sms_authorizations_incompatible_partial_table');
            }
        } finally {
            if ($created) {
                DB::statement('DROP TABLE '.$probe);
            }
        }
    }

    private function triggerExists(): bool
    {
        $row = DB::selectOne("SELECT EVENT_OBJECT_TABLE,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='sms_authorization_update_guard'");
        if (! $row) {
            return false;
        }
        $normalize = fn ($s) => preg_replace('/\s+/', ' ', trim($s));
        if ($row->EVENT_OBJECT_TABLE !== 'sms_authorizations' || $row->ACTION_TIMING !== 'BEFORE'
            || $row->EVENT_MANIPULATION !== 'UPDATE' || $normalize($row->ACTION_STATEMENT) !== $normalize($this->guardSql())) {
            throw new LogicException('sms_authorizations_incompatible_partial_trigger');
        }

        return true;
    }

    public function up(): void
    {
        $trigger = $this->triggerExists();
        if (Schema::hasTable('sms_authorizations')) {
            $this->assertTable();
        } elseif ($trigger) {
            throw new LogicException('sms_authorizations_incompatible_partial_dependencies');
        } else {
            DB::unprepared($this->tableSql());
        }
        if (! $trigger) {
            DB::unprepared('CREATE TRIGGER sms_authorization_update_guard BEFORE UPDATE ON sms_authorizations FOR EACH ROW '.$this->guardSql());
        }
    }

    public function down(): void
    {
        $this->triggerExists();
        if (Schema::hasTable('sms_authorizations')) {
            $this->assertTable();
            if (DB::table('sms_authorizations')->exists()) {
                throw new LogicException('sms_authorizations_retained');
            }
            DB::statement('DROP TABLE sms_authorizations');
        }
    }
};
