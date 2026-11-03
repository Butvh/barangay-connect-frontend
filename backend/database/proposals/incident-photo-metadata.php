<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** UNRATIFIED proposal. Outside migrations/ so Laravel never auto-applies it. Tests only. */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE emergency_alerts ADD UNIQUE KEY photo_incident_owner_scope (id,resident_id,barangay_id)');
        DB::unprepared(<<<'SQL'
CREATE TABLE incident_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  upload_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  barangay_id BIGINT UNSIGNED NOT NULL,
  uploader_id BIGINT UNSIGNED NOT NULL,
  uploader_auth_version INT UNSIGNED NOT NULL,
  intent_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
  CONSTRAINT photo_generation_check CHECK (uploader_auth_version >= 0),
  CONSTRAINT photo_private_key_check CHECK (disk='private_incident_photos' AND REGEXP_LIKE(object_key,'^incident-photos/[a-f0-9]{2}/[a-f0-9]{64}$','c')),
  CONSTRAINT photo_inspection_check CHECK (
    (mime IS NULL AND bytes IS NULL AND sha256 IS NULL) OR
    (mime IS NOT NULL AND bytes IS NOT NULL AND sha256 IS NOT NULL AND mime IN ('image/jpeg','image/png') AND bytes BETWEEN 1 AND 10485760 AND REGEXP_LIKE(sha256,'^[a-f0-9]{64}$','c'))),
  CONSTRAINT photo_ready_check CHECK (state NOT IN ('ready','attached') OR (mime IS NOT NULL AND uploaded_at IS NOT NULL)),
  CONSTRAINT photo_lifetime_check CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL 1 DAY AND updated_at >= created_at AND (uploaded_at IS NULL OR uploaded_at BETWEEN created_at AND expires_at)),
  CONSTRAINT photo_attachment_check CHECK (
    (state='attached' AND incident_id IS NOT NULL AND attached_at IS NOT NULL AND uploaded_at IS NOT NULL AND attached_at BETWEEN uploaded_at AND expires_at) OR
    (state<>'attached' AND incident_id IS NULL AND attached_at IS NULL)),
  CONSTRAINT photo_cleanup_claim_check CHECK (
    (state='removing' AND cleanup_token IS NOT NULL AND cleanup_lease_until IS NOT NULL AND REGEXP_LIKE(cleanup_token,'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$','c')) OR
    (state<>'removing' AND cleanup_token IS NULL AND cleanup_lease_until IS NULL)),
  CONSTRAINT photo_removed_check CHECK ((state='removed' AND removed_at IS NOT NULL) OR (state<>'removed' AND removed_at IS NULL)),
  CONSTRAINT photo_failure_check CHECK (state<>'failed' OR (failed_at IS NOT NULL AND failure_code IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }

    public function down(): void
    {
        if (DB::table('incident_photos')->exists()) {
            throw new LogicException('incident_photo_metadata_retained');
        }
        DB::statement('DROP TABLE incident_photos');
        DB::statement('ALTER TABLE emergency_alerts DROP INDEX photo_incident_owner_scope');
    }
};
