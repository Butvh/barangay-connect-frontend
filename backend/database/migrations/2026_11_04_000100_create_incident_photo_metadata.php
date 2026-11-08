<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Agreed metadata only. P1 owns decoding/storage. MySQL DDL commits separately. */
return new class extends Migration
{
    private function tableSql(): string
    {
        return <<<'SQL'
CREATE TABLE incident_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  uploader_id BIGINT UNSIGNED NOT NULL,
  uploader_auth_version INT UNSIGNED NOT NULL,
  intent_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  input_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  incident_id BIGINT UNSIGNED NULL,
  disk VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  object_key VARCHAR(190) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NULL,
  bytes INT UNSIGNED NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  state ENUM('processing','ready','attached','failed','removing','removed') NOT NULL,
  cleanup_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  cleanup_lease_until TIMESTAMP(6) NULL,
  cleanup_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  failure_code ENUM('invalid_image','storage_failed','integrity_failed','cleanup_failed') NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  uploaded_at TIMESTAMP(6) NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  attached_at TIMESTAMP(6) NULL,
  failed_at TIMESTAMP(6) NULL,
  removed_at TIMESTAMP(6) NULL,
  UNIQUE KEY photo_upload_token (upload_id),
  UNIQUE KEY photo_private_object (disk,object_key),
  UNIQUE KEY photo_submit_intent (uploader_id,barangay_id,uploader_auth_version,intent_digest),
  KEY photo_uploader_expiry (barangay_id,uploader_id,state,expires_at,id),
  KEY photo_expiry_scan (state,expires_at,id),
  KEY photo_cleanup_recovery (state,cleanup_lease_until,id),
  KEY photo_incident_scope (barangay_id,incident_id,id),
  CONSTRAINT photo_uploader_scope_fk FOREIGN KEY (uploader_id,barangay_id) REFERENCES users(id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT photo_incident_owner_fk FOREIGN KEY (incident_id,uploader_id,barangay_id) REFERENCES emergency_alerts(id,resident_id,barangay_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT photo_token_check CHECK (REGEXP_LIKE(upload_id,'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$','c')),
  CONSTRAINT photo_intent_check CHECK (REGEXP_LIKE(intent_digest,'^[a-f0-9]{64}$','c')),
  CONSTRAINT photo_input_check CHECK (REGEXP_LIKE(input_sha256,'^[a-f0-9]{64}$','c')),
  CONSTRAINT photo_generation_check CHECK (uploader_auth_version >= 0),
  CONSTRAINT photo_private_key_check CHECK (disk='private_incident_photos' AND REGEXP_LIKE(object_key,'^incident-photos/[a-f0-9]{2}/[a-f0-9]{64}$','c')),
  CONSTRAINT photo_inspection_check CHECK (
    (mime IS NULL AND bytes IS NULL AND sha256 IS NULL AND uploaded_at IS NULL) OR
    (mime IS NOT NULL AND bytes IS NOT NULL AND sha256 IS NOT NULL AND uploaded_at IS NOT NULL AND mime IN ('image/jpeg','image/png') AND bytes BETWEEN 1 AND 10485760 AND REGEXP_LIKE(sha256,'^[a-f0-9]{64}$','c'))),
  CONSTRAINT photo_ready_check CHECK (state NOT IN ('ready','attached') OR (mime IS NOT NULL AND uploaded_at IS NOT NULL)),
  CONSTRAINT photo_lifetime_check CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL 1 DAY AND updated_at >= created_at AND (uploaded_at IS NULL OR uploaded_at BETWEEN created_at AND expires_at)),
  CONSTRAINT photo_attachment_check CHECK (
    (state='attached' AND incident_id IS NOT NULL AND attached_at IS NOT NULL AND uploaded_at IS NOT NULL AND attached_at BETWEEN uploaded_at AND expires_at) OR
    (state<>'attached' AND incident_id IS NULL AND attached_at IS NULL)),
  CONSTRAINT photo_cleanup_claim_check CHECK (
    (state='removing' AND cleanup_token IS NOT NULL AND cleanup_lease_until IS NOT NULL AND cleanup_attempts BETWEEN 1 AND 20 AND cleanup_lease_until=updated_at + INTERVAL 5 MINUTE AND expires_at<=updated_at AND REGEXP_LIKE(cleanup_token,'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$','c')) OR
    (state<>'removing' AND cleanup_token IS NULL AND cleanup_lease_until IS NULL)),
  CONSTRAINT photo_attempts_check CHECK (cleanup_attempts<=20),
  CONSTRAINT photo_removed_check CHECK ((state='removed' AND removed_at IS NOT NULL) OR (state<>'removed' AND removed_at IS NULL)),
  CONSTRAINT photo_failure_check CHECK (state<>'failed' OR (failed_at IS NOT NULL AND failure_code IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL;
    }

    private function guardSql(): string
    {
        return <<<'SQL'
BEGIN
  IF NEW.id<>OLD.id OR NOT (NEW.upload_id <=> OLD.upload_id) OR NEW.uploader_id<>OLD.uploader_id OR NEW.barangay_id<>OLD.barangay_id
    OR NEW.uploader_auth_version<>OLD.uploader_auth_version OR NEW.intent_digest<>OLD.intent_digest
    OR NEW.input_sha256<>OLD.input_sha256 OR NEW.disk<>OLD.disk OR NEW.object_key<>OLD.object_key
    OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_immutable_input';
  END IF;
  IF OLD.mime IS NOT NULL AND (NOT (NEW.mime <=> OLD.mime) OR NOT (NEW.bytes <=> OLD.bytes)
    OR NOT (NEW.sha256 <=> OLD.sha256) OR NOT (NEW.uploaded_at <=> OLD.uploaded_at)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_immutable_output';
  END IF;
  IF OLD.mime IS NULL AND NEW.mime IS NOT NULL AND NOT (OLD.state='processing' AND NEW.state='ready') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_output_transition';
  END IF;
  IF NEW.updated_at<OLD.updated_at OR NOT (
    (OLD.state='processing' AND NEW.state IN ('processing','ready','failed','removing')) OR
    (OLD.state='ready' AND NEW.state IN ('ready','attached','failed','removing')) OR
    (OLD.state='failed' AND NEW.state IN ('failed','removing')) OR
    (OLD.state='removing' AND NEW.state IN ('removing','failed','removed')) OR
    (OLD.state='attached' AND NEW.state='attached') OR (OLD.state='removed' AND NEW.state='removed')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_lifecycle_transition';
  END IF;
  IF OLD.state='attached' AND (NOT (NEW.incident_id <=> OLD.incident_id) OR NOT (NEW.attached_at <=> OLD.attached_at)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_immutable_attachment';
  END IF;
  IF OLD.state='removed' AND NOT (NEW.removed_at <=> OLD.removed_at) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_immutable_tombstone';
  END IF;
  IF NEW.state='removing' THEN
    IF OLD.state<>'removing' OR NOT (NEW.cleanup_token <=> OLD.cleanup_token) THEN
      IF NEW.cleanup_attempts<>OLD.cleanup_attempts+1 OR (OLD.state='removing' AND OLD.cleanup_lease_until>NEW.updated_at) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_cleanup_lease_conflict';
      END IF;
    ELSEIF NEW.cleanup_attempts<>OLD.cleanup_attempts OR NEW.cleanup_lease_until<>OLD.cleanup_lease_until OR NEW.updated_at<>OLD.updated_at THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_cleanup_lease_immutable';
    END IF;
  ELSEIF NEW.cleanup_attempts<>OLD.cleanup_attempts THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='photo_cleanup_attempts_immutable';
  END IF;
END
SQL;
    }

    private function indexExists(): bool
    {
        $rows = DB::select("SELECT COLUMN_NAME,NON_UNIQUE,SUB_PART,EXPRESSION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emergency_alerts' AND INDEX_NAME='photo_incident_owner_scope' ORDER BY SEQ_IN_INDEX");
        if (! $rows) {
            return false;
        }
        if (array_column($rows, 'COLUMN_NAME') !== ['id', 'resident_id', 'barangay_id']
            || array_filter($rows, fn ($r) => (int) $r->NON_UNIQUE !== 0 || $r->SUB_PART !== null || $r->EXPRESSION !== null)) {
            throw new LogicException('incident_photo_incompatible_supporting_index');
        }

        return true;
    }

    private function canonical(string $sql): string
    {
        // MySQL rebinds these ASCII-only literals to the ASCII column charset
        // after ALTER. This changes no value/expression; column collations stay exact.
        $sql = str_replace("_ascii'", "_utf8mb4'", $sql);

        return preg_replace('/ AUTO_INCREMENT=[0-9]+/', '', $sql);
    }

    private function assertTable(): void
    {
        // Compare server-canonical DDL, including all columns, checks, indexes and FKs.
        $probe = 'dba_photo_shape_'.bin2hex(random_bytes(8));
        $prefix = 'ps_'.bin2hex(random_bytes(8)).'_';
        $sql = str_replace(['CREATE TABLE incident_photos', 'CONSTRAINT photo_'], ['CREATE TABLE '.$probe, 'CONSTRAINT '.$prefix], $this->tableSql());
        $created = false;
        try {
            DB::unprepared($sql);
            $created = true;
            $actual = (array) DB::selectOne('SHOW CREATE TABLE incident_photos');
            $expected = (array) DB::selectOne('SHOW CREATE TABLE '.$probe);
            $expected = str_replace([$probe, $prefix], ['incident_photos', 'photo_'], $expected['Create Table']);
            if ($this->canonical($actual['Create Table']) !== $this->canonical($expected)) {
                throw new LogicException('incident_photo_incompatible_partial_table');
            }
        } finally {
            // Remove only our successfully created random probe, never another object.
            if ($created) {
                DB::statement('DROP TABLE '.$probe);
            }
        }
    }

    private function triggerExists(): bool
    {
        $row = DB::selectOne("SELECT EVENT_OBJECT_TABLE,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='photo_metadata_update_guard'");
        if (! $row) {
            return false;
        }
        $normalize = fn ($s) => preg_replace('/\s+/', ' ', trim($s));
        if ($row->EVENT_OBJECT_TABLE !== 'incident_photos' || $row->ACTION_TIMING !== 'BEFORE'
            || $row->EVENT_MANIPULATION !== 'UPDATE' || $normalize($row->ACTION_STATEMENT) !== $normalize($this->guardSql())) {
            throw new LogicException('incident_photo_incompatible_partial_trigger');
        }

        return true;
    }

    public function up(): void
    {
        $index = $this->indexExists();
        $trigger = $this->triggerExists();
        $table = Schema::hasTable('incident_photos');
        if (! $index && ($table || $trigger)) {
            throw new LogicException('incident_photo_incompatible_partial_dependencies');
        }
        if (! $index) {
            DB::statement('ALTER TABLE emergency_alerts ADD UNIQUE KEY photo_incident_owner_scope (id,resident_id,barangay_id)');
        }
        if ($table) {
            $this->assertTable();
        } else {
            DB::unprepared($this->tableSql());
        }
        if (! $trigger) {
            DB::unprepared('CREATE TRIGGER photo_metadata_update_guard BEFORE UPDATE ON incident_photos FOR EACH ROW '.$this->guardSql());
        }
    }

    public function down(): void
    {
        $index = $this->indexExists();
        $this->triggerExists();
        if (Schema::hasTable('incident_photos')) {
            $this->assertTable();
            if (DB::table('incident_photos')->exists()) {
                throw new LogicException('incident_photo_metadata_retained');
            }
            DB::statement('DROP TABLE incident_photos');
        }
        if ($index) {
            DB::statement('ALTER TABLE emergency_alerts DROP INDEX photo_incident_owner_scope');
        }
    }
};
