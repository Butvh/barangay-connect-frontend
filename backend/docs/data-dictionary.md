# MySQL data dictionary

Generated from the migrated MySQL Community 8.4.13 schema. Types/nullability/indexes below are actual DDL metadata, not inferred frontend fields. All tables use InnoDB. See DBA-HANDOFF.md for DTO mapping, scope/lock rules, service responsibilities and migration order. No resident rows, secrets or dump data are included.

November 3 follow-up changes no DDL or migration. The original six migrations and two additive migrations are retained. New v2 event IDs are canonical lowercase UUIDv4, occurrence timestamps retain UTC microseconds, and audience is derived by the authorized producer then required in v2 recipient rows. SQL audience nullability remains for legacy v1 compatibility. These application boundaries are detailed in [INTEGRATION-CONTRACT-V2.md](INTEGRATION-CONTRACT-V2.md).

## activity_logs

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| actor_id | bigint unsigned | YES | NULL/none |  |
| actor_name | varchar(100) | YES | NULL/none |  |
| role_at_action | varchar(20) | YES | NULL/none |  |
| resource_type | varchar(40) | NO | NULL/none |  |
| resource_id | bigint unsigned | NO | NULL/none |  |
| action | varchar(100) | NO | NULL/none |  |
| evidence | varchar(100) | NO | NULL/none |  |
| summary | json | NO | NULL/none |  |
| occurred_at | timestamp(6) | YES | NULL/none |  |
| recorded_at | timestamp(6) | NO | CURRENT_TIMESTAMP(6) | DEFAULT_GENERATED |

Indexes:

- `PRIMARY` UNIQUE (id)
- `activity_logs_barangay_id_occurred_at_index` (barangay_id, occurred_at)
- `activity_logs_actor_id_occurred_at_index` (actor_id, occurred_at)
- `activity_logs_resource_type_resource_id_occurred_at_index` (resource_type, resource_id, occurred_at)

Foreign keys:

- `activity_logs_actor_id_foreign`: (actor_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `activity_logs_barangay_id_foreign`: (barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `audit_summary_bound`: (json_storage_size(`summary`) <= 4096)

## alert_assignments

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| alert_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| user_id | bigint unsigned | NO | NULL/none |  |
| role | enum('responder','rescuer') | NO | NULL/none |  |
| assigned_by | bigint unsigned | YES | NULL/none |  |
| personnel_name | varchar(100) | YES | NULL/none |  |
| assigned_by_name | varchar(100) | YES | NULL/none |  |
| assigned_at | timestamp(6) | YES | NULL/none |  |
| status | enum('active','completed','cancelled','reassigned','closed') | NO | NULL/none |  |
| ended_by | bigint unsigned | YES | NULL/none |  |
| ended_at | timestamp(6) | YES | NULL/none |  |
| end_reason | varchar(1000) | YES | NULL/none |  |
| override_by | bigint unsigned | YES | NULL/none |  |
| override_at | timestamp(6) | YES | NULL/none |  |
| override_reason | varchar(1000) | YES | NULL/none |  |
| legacy | tinyint(1) | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| active_role | varchar(10) | YES | NULL/none | STORED GENERATED (case when (`status` = _utf8mb4\'active\') then `role` else NULL end) |

Indexes:

- `PRIMARY` UNIQUE (id)
- `assignment_log_owner_unique` UNIQUE (id, alert_id, user_id)
- `assignment_active_role_unique` UNIQUE (alert_id, active_role)
- `alert_assignments_assigned_by_foreign` (assigned_by)
- `alert_assignments_ended_by_foreign` (ended_by)
- `alert_assignments_override_by_foreign` (override_by)
- `alert_assignments_user_id_role_status_index` (user_id, role, status)
- `alert_assignments_alert_id_role_status_index` (alert_id, role, status)
- `alert_assignments_barangay_id_assigned_at_index` (barangay_id, assigned_at)
- `assignment_alert_scope_fk` (alert_id, barangay_id)
- `assignment_user_scope_fk` (user_id, barangay_id)

Foreign keys:

- `alert_assignments_assigned_by_foreign`: (assigned_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `alert_assignments_ended_by_foreign`: (ended_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `alert_assignments_override_by_foreign`: (override_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `assignment_alert_scope_fk`: (alert_id,barangay_id) -> emergency_alerts(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `assignment_user_scope_fk`: (user_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `assignment_override_check`: (((`override_by` is null) and (`override_at` is null) and (`override_reason` is null)) or ((`override_by` is not null) and (`override_at` is not null) and (`override_reason` is not null) and (char_length(trim(`override_reason`)) > 0)))
- `assignment_start_evidence_check`: ((`legacy` = 1) or ((`assigned_at` is not null) and (`assigned_by` is not null)))

## alert_responses

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| alert_id | bigint unsigned | NO | NULL/none |  |
| assignment_id | bigint unsigned | YES | NULL/none |  |
| responder_id | bigint unsigned | NO | NULL/none |  |
| response_type | enum('First aid','Assessment','Evacuation assistance','Other') | NO | NULL/none |  |
| response_status | enum('Responding','Completed') | NO | NULL/none |  |
| rescue_required | tinyint(1) | YES | NULL/none |  |
| legacy | tinyint(1) | NO | 0 |  |
| provenance | varchar(100) | YES | NULL/none |  |
| notes | text | YES | NULL/none |  |
| responded_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `alert_responses_responder_id_foreign` (responder_id)
- `alert_responses_alert_id_responded_at_index` (alert_id, responded_at)
- `response_assignment_owner_fk` (assignment_id, alert_id, responder_id)

Foreign keys:

- `alert_responses_alert_id_foreign`: (alert_id) -> emergency_alerts(id); DELETE RESTRICT; UPDATE NO ACTION
- `alert_responses_responder_id_foreign`: (responder_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `response_assignment_owner_fk`: (assignment_id,alert_id,responder_id) -> alert_assignments(id,alert_id,user_id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `response_evidence_check`: (((`legacy` = 1) and (`provenance` is not null)) or ((`legacy` = 0) and (`assignment_id` is not null) and (`rescue_required` is not null) and (`responded_at` is not null)))

## announcement_history

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| announcement_id | bigint unsigned | NO | NULL/none |  |
| actor_id | bigint unsigned | YES | NULL/none |  |
| role_at_action | varchar(20) | YES | NULL/none |  |
| action | varchar(30) | NO | NULL/none |  |
| reason | varchar(500) | YES | NULL/none |  |
| snapshot | json | YES | NULL/none |  |
| occurred_at | timestamp(6) | YES | NULL/none |  |
| recorded_at | timestamp(6) | NO | CURRENT_TIMESTAMP(6) | DEFAULT_GENERATED |

Indexes:

- `PRIMARY` UNIQUE (id)
- `announcement_history_actor_id_foreign` (actor_id)
- `announcement_history_announcement_id_recorded_at_index` (announcement_id, recorded_at)

Foreign keys:

- `announcement_history_actor_id_foreign`: (actor_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `announcement_history_announcement_id_foreign`: (announcement_id) -> announcements(id); DELETE RESTRICT; UPDATE NO ACTION

## announcements

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| author_id | bigint unsigned | NO | NULL/none |  |
| author_role | varchar(20) | NO | NULL/none |  |
| title | varchar(200) | NO | NULL/none |  |
| content | text | NO | NULL/none |  |
| status | enum('Active','Archived','Retracted') | NO | NULL/none |  |
| published_at | timestamp(6) | YES | NULL/none |  |
| expires_at | timestamp(6) | YES | NULL/none |  |
| archived_at | timestamp(6) | YES | NULL/none |  |
| retracted_at | timestamp(6) | YES | NULL/none |  |
| retraction_reason | varchar(500) | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `announcements_author_id_foreign` (author_id)
- `announcements_barangay_id_status_published_at_expires_at_index` (barangay_id, status, published_at, expires_at)

Foreign keys:

- `announcements_author_id_foreign`: (author_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `announcements_barangay_id_foreign`: (barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION

## barangays

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| name | varchar(100) | NO | NULL/none |  |
| address | varchar(255) | YES | NULL/none |  |
| municipality | varchar(100) | YES | NULL/none |  |
| map_scope | varchar(100) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)

## cache

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| key | varchar(255) | NO | NULL/none |  |
| value | mediumtext | NO | NULL/none |  |
| expiration | int | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (key)
- `cache_expiration_index` (expiration)

## cache_locks

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| key | varchar(255) | NO | NULL/none |  |
| owner | varchar(255) | NO | NULL/none |  |
| expiration | int | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (key)

## capacity_guards

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| scope_type | enum('barangay','person') | NO | NULL/none |  |
| scope_id | bigint unsigned | NO | NULL/none |  |
| kind | enum('staffing','operations','verification','sos','recovery') | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `capacity_guard_unique` UNIQUE (scope_type, scope_id, kind)

## community_feedback

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| resident_id | bigint unsigned | NO | NULL/none |  |
| kind | enum('complaint','suggestion','general') | NO | NULL/none |  |
| title | varchar(200) | YES | NULL/none |  |
| description | text | YES | NULL/none |  |
| category | varchar(100) | YES | NULL/none |  |
| location | varchar(200) | YES | NULL/none |  |
| assigned_tanod_id | bigint unsigned | YES | NULL/none |  |
| status | enum('Pending','Assigned','Resolved') | YES | NULL/none |  |
| rating | tinyint unsigned | YES | NULL/none |  |
| comment | text | YES | NULL/none |  |
| submitted_at | timestamp(6) | NO | NULL/none |  |
| assigned_at | timestamp(6) | YES | NULL/none |  |
| resolved_at | timestamp(6) | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `community_feedback_barangay_id_kind_status_submitted_at_index` (barangay_id, kind, status, submitted_at)
- `feedback_resident_scope_fk` (resident_id, barangay_id)
- `feedback_tanod_scope_fk` (assigned_tanod_id, barangay_id)

Foreign keys:

- `feedback_resident_scope_fk`: (resident_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `feedback_tanod_scope_fk`: (assigned_tanod_id,barangay_id) -> tanod_memberships(user_id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `feedback_kind_check`: (((`kind` = _utf8mb4\'general\') and (`rating` is not null) and (`rating` between 1 and 5) and (`comment` is not null) and (char_length(trim(`comment`)) between 1 and 2000) and (`status` is null) and (`assigned_tanod_id` is null) and (`assigned_at` is null) and (`resolved_at` is null)) or ((`kind` in (_utf8mb4\'complaint\',_utf8mb4\'suggestion\')) and (`status` is not null) and (`rating` is null) and (`comment` is null)))

## delivery_receipts

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| outbox_event_id | bigint unsigned | NO | NULL/none |  |
| recipient_id | bigint unsigned | NO | NULL/none |  |
| channel | enum('in_app','sms') | NO | NULL/none |  |
| template_key | varchar(80) | NO | NULL/none |  |
| state | enum('pending','complete','failed') | NO | pending |  |
| completed_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| diagnostic_code | varchar(60) | YES | NULL/none |  |
| failed_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `receipt_logical_delivery_unique` UNIQUE (outbox_event_id, recipient_id, channel, template_key)
- `delivery_receipts_recipient_id_foreign` (recipient_id)

Foreign keys:

- `delivery_receipts_outbox_event_id_foreign`: (outbox_event_id) -> outbox_events(id); DELETE RESTRICT; UPDATE NO ACTION
- `delivery_receipts_recipient_id_foreign`: (recipient_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `receipt_authorized_recipient_fk`: (outbox_event_id,recipient_id) -> outbox_recipients(outbox_event_id,recipient_id); DELETE RESTRICT; UPDATE NO ACTION

## documents

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| submission_id | bigint unsigned | YES | NULL/none |  |
| appointment_id | bigint unsigned | YES | NULL/none |  |
| uploader_id | bigint unsigned | NO | NULL/none |  |
| disk | varchar(30) | NO | local |  |
| object_key | varchar(250) | NO | NULL/none |  |
| original_name | varchar(200) | NO | NULL/none |  |
| kind | enum('valid_id','proof_of_residence','personnel_requirement') | NO | NULL/none |  |
| mime | enum('image/jpeg','image/png','application/pdf') | NO | NULL/none |  |
| bytes | int unsigned | NO | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `documents_object_key_unique` UNIQUE (object_key)
- `documents_uploader_id_foreign` (uploader_id)
- `document_submission_scope_fk` (submission_id, barangay_id)
- `document_appointment_scope_fk` (appointment_id, barangay_id)

Foreign keys:

- `document_appointment_scope_fk`: (appointment_id,barangay_id) -> personnel_appointments(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `document_submission_scope_fk`: (submission_id,barangay_id) -> verification_submissions(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `documents_uploader_id_foreign`: (uploader_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `document_owner_size_check`: (((`submission_id` is not null) and (`appointment_id` is null) and (`kind` in (_utf8mb4\'valid_id\',_utf8mb4\'proof_of_residence\')) and (`bytes` between 1 and 10485760)) or ((`submission_id` is null) and (`appointment_id` is not null) and (`kind` = _utf8mb4\'personnel_requirement\') and (`bytes` between 1 and 5242880)))

## emergency_alerts

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| resident_id | bigint unsigned | NO | NULL/none |  |
| household_id | bigint unsigned | NO | NULL/none |  |
| alert_type | enum('Fire','Flood','Typhoon/Storm','Landslide','Earthquake','Other') | NO | NULL/none |  |
| description | text | YES | NULL/none |  |
| location_label | varchar(200) | NO | NULL/none |  |
| address_snapshot | varchar(200) | YES | NULL/none |  |
| map_x | decimal(7,4) | YES | NULL/none |  |
| map_y | decimal(7,4) | YES | NULL/none |  |
| victim_count | smallint unsigned | YES | NULL/none |  |
| status | enum('Pending','Acknowledged','Responding','Rescue in progress','Resolved') | NO | Pending |  |
| assignment_revision | int unsigned | NO | 0 |  |
| reported_at | timestamp(6) | NO | NULL/none |  |
| acknowledged_at | timestamp(6) | YES | NULL/none |  |
| resolved_at | timestamp(6) | YES | NULL/none |  |
| acknowledged_by | bigint unsigned | YES | NULL/none |  |
| resolved_by | bigint unsigned | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| active_resident_key | bigint unsigned | YES | NULL/none | STORED GENERATED (case when (`status` <> _utf8mb4\'Resolved\') then `resident_id` else NULL end) |

Indexes:

- `PRIMARY` UNIQUE (id)
- `emergency_alerts_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `alert_active_resident_unique` UNIQUE (active_resident_key)
- `emergency_alerts_acknowledged_by_foreign` (acknowledged_by)
- `emergency_alerts_resolved_by_foreign` (resolved_by)
- `emergency_alerts_barangay_id_status_reported_at_index` (barangay_id, status, reported_at)
- `alert_resident_scope_fk` (resident_id, barangay_id)
- `alert_household_scope_fk` (household_id, barangay_id)

Foreign keys:

- `alert_household_scope_fk`: (household_id,barangay_id) -> households(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `alert_resident_scope_fk`: (resident_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `emergency_alerts_acknowledged_by_foreign`: (acknowledged_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `emergency_alerts_resolved_by_foreign`: (resolved_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `alert_victims_check`: ((`victim_count` is null) or (`victim_count` <= 9999))
- `alert_pin_check`: (((`map_x` is null) and (`map_y` is null)) or ((`map_x` is not null) and (`map_y` is not null) and (`map_x` between 0 and 100) and (`map_y` between 0 and 100)))

## facilities

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| managed_by_barangay_id | bigint unsigned | NO | NULL/none |  |
| visibility | enum('local','shared') | NO | local |  |
| name | varchar(100) | NO | NULL/none |  |
| type | enum('Evacuation Center','Hospital') | NO | NULL/none |  |
| address | varchar(200) | NO | NULL/none |  |
| capacity | int unsigned | YES | NULL/none |  |
| contact | varchar(30) | YES | NULL/none |  |
| notes | text | YES | NULL/none |  |
| active | tinyint(1) | NO | 1 |  |
| map_x | decimal(7,4) | YES | NULL/none |  |
| map_y | decimal(7,4) | YES | NULL/none |  |
| map_scope | varchar(100) | YES | NULL/none |  |
| created_by | bigint unsigned | YES | NULL/none |  |
| updated_by | bigint unsigned | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `facilities_created_by_foreign` (created_by)
- `facilities_updated_by_foreign` (updated_by)
- `facilities_managed_by_barangay_id_type_active_index` (managed_by_barangay_id, type, active)
- `facilities_visibility_type_active_index` (visibility, type, active)

Foreign keys:

- `facilities_created_by_foreign`: (created_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `facilities_managed_by_barangay_id_foreign`: (managed_by_barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION
- `facilities_updated_by_foreign`: (updated_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `facility_pin_check`: (((`map_x` is null) and (`map_y` is null)) or ((`map_x` is not null) and (`map_y` is not null) and (`map_x` between 0 and 100) and (`map_y` between 0 and 100) and (`map_scope` is not null)))

## failed_jobs

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| uuid | varchar(255) | NO | NULL/none |  |
| connection | text | NO | NULL/none |  |
| queue | text | NO | NULL/none |  |
| payload | longtext | NO | NULL/none |  |
| exception | longtext | NO | NULL/none |  |
| failed_at | timestamp | NO | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

Indexes:

- `PRIMARY` UNIQUE (id)
- `failed_jobs_uuid_unique` UNIQUE (uuid)

## households

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| address | varchar(200) | NO | NULL/none |  |
| map_x | decimal(7,4) | YES | NULL/none |  |
| map_y | decimal(7,4) | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `households_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `households_barangay_id_foreign` (barangay_id)

Foreign keys:

- `households_barangay_id_foreign`: (barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `households_pin_check`: (((`map_x` is null) and (`map_y` is null)) or ((`map_x` is not null) and (`map_y` is not null) and (`map_x` between 0 and 100) and (`map_y` between 0 and 100)))

## idempotency_requests

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| actor_id | bigint unsigned | NO | NULL/none |  |
| route | varchar(100) | NO | NULL/none |  |
| key_digest | char(64) | NO | NULL/none |  |
| request_hash | char(64) | NO | NULL/none |  |
| http_status | smallint unsigned | YES | NULL/none |  |
| outcome | json | YES | NULL/none |  |
| expires_at | timestamp(6) | NO | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `idempotency_actor_route_key_unique` UNIQUE (actor_id, route, key_digest)
- `idempotency_requests_expires_at_index` (expires_at)

Foreign keys:

- `idempotency_requests_actor_id_foreign`: (actor_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

## incident_status_history

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| alert_id | bigint unsigned | NO | NULL/none |  |
| stage | enum('Pending','Acknowledged','Responding','Rescue in progress','Resolved') | NO | NULL/none |  |
| actor_id | bigint unsigned | YES | NULL/none |  |
| role_at_action | varchar(20) | YES | NULL/none |  |
| occurred_at | timestamp(6) | YES | NULL/none |  |
| evidence | varchar(100) | NO | NULL/none |  |
| sequence | int unsigned | NO | NULL/none |  |
| recorded_at | timestamp(6) | NO | CURRENT_TIMESTAMP(6) | DEFAULT_GENERATED |

Indexes:

- `PRIMARY` UNIQUE (id)
- `incident_status_history_alert_id_sequence_unique` UNIQUE (alert_id, sequence)
- `incident_status_history_actor_id_foreign` (actor_id)

Foreign keys:

- `incident_status_history_actor_id_foreign`: (actor_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `incident_status_history_alert_id_foreign`: (alert_id) -> emergency_alerts(id); DELETE RESTRICT; UPDATE NO ACTION

## job_batches

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | varchar(255) | NO | NULL/none |  |
| name | varchar(255) | NO | NULL/none |  |
| total_jobs | int | NO | NULL/none |  |
| pending_jobs | int | NO | NULL/none |  |
| failed_jobs | int | NO | NULL/none |  |
| failed_job_ids | longtext | NO | NULL/none |  |
| options | mediumtext | YES | NULL/none |  |
| cancelled_at | int | YES | NULL/none |  |
| created_at | int | NO | NULL/none |  |
| finished_at | int | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)

## jobs

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| queue | varchar(255) | NO | NULL/none |  |
| payload | longtext | NO | NULL/none |  |
| attempts | tinyint unsigned | NO | NULL/none |  |
| reserved_at | int unsigned | YES | NULL/none |  |
| available_at | int unsigned | NO | NULL/none |  |
| created_at | int unsigned | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `jobs_queue_index` (queue)

## make_commands

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| outbox_event_id | bigint unsigned | NO | NULL/none |  |
| credential_id | varchar(40) | NO | NULL/none |  |
| payload_hash | char(64) | NO | NULL/none |  |
| received_at | timestamp(6) | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `make_commands_outbox_event_id_unique` UNIQUE (outbox_event_id)

Foreign keys:

- `make_commands_outbox_event_id_foreign`: (outbox_event_id) -> outbox_events(id); DELETE RESTRICT; UPDATE NO ACTION

## make_dispatches

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| outbox_event_id | bigint unsigned | NO | NULL/none |  |
| claim_token | char(36) | YES | NULL/none |  |
| lease_until | timestamp(6) | YES | NULL/none |  |
| attempts | smallint unsigned | NO | 0 |  |
| next_attempt_at | timestamp(6) | YES | NULL/none |  |
| accepted_at | timestamp(6) | YES | NULL/none |  |
| command_received_at | timestamp(6) | YES | NULL/none |  |
| last_error | varchar(60) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `make_dispatches_outbox_event_id_unique` UNIQUE (outbox_event_id)
- `make_dispatches_command_received_at_next_attempt_at_index` (command_received_at, next_attempt_at)

Foreign keys:

- `make_dispatches_outbox_event_id_foreign`: (outbox_event_id) -> outbox_events(id); DELETE RESTRICT; UPDATE NO ACTION

## messaging_budgets

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| day | date | NO | NULL/none |  |
| reserved_segments | int unsigned | NO | 0 |  |

Indexes:

- `PRIMARY` UNIQUE (day)

## messaging_rate_windows

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| endpoint | varchar(30) | NO | NULL/none |  |
| window_start | timestamp(6) | NO | NULL/none |  |
| requests | int unsigned | NO | 0 |  |
| blocked_until | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (endpoint)

## notifications

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| recipient_id | bigint unsigned | NO | NULL/none |  |
| event_id | char(36) | NO | NULL/none |  |
| kind | varchar(40) | NO | NULL/none |  |
| target | varchar(200) | NO | NULL/none |  |
| title | varchar(200) | NO | NULL/none |  |
| description | varchar(500) | YES | NULL/none |  |
| read_at | timestamp(6) | YES | NULL/none |  |
| dismissed_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| barangay_id | bigint unsigned | YES | NULL/none |  |
| resource_type | varchar(40) | YES | NULL/none |  |
| resource_id | bigint unsigned | YES | NULL/none |  |
| audience | enum('resident','official') | YES | NULL/none |  |
| event_status | enum('Pending','Acknowledged','Responding','Rescue in progress','Resolved') | YES | NULL/none |  |
| template_key | varchar(80) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `notifications_event_id_recipient_id_unique` UNIQUE (event_id, recipient_id)
- `notification_inbox_index` (recipient_id, dismissed_at, read_at, created_at)
- `notification_recipient_scope_fk` (recipient_id, barangay_id)

Foreign keys:

- `notification_recipient_scope_fk`: (recipient_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `notifications_recipient_id_foreign`: (recipient_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `notification_target_check`: regexp_like(`target`,_utf8mb4\'^[a-z][a-z0-9-]*[.]html([?][a-z0-9_=&-]+)?$\')

## outbox_events

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| event_id | char(36) | NO | NULL/none |  |
| version | tinyint unsigned | NO | 1 |  |
| type | varchar(80) | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| resource_type | varchar(40) | NO | NULL/none |  |
| resource_id | bigint unsigned | NO | NULL/none |  |
| occurred_at | timestamp(6) | NO | NULL/none |  |
| payload | json | NO | NULL/none |  |
| template_key | varchar(80) | NO | NULL/none |  |
| created_at | timestamp(6) | NO | CURRENT_TIMESTAMP(6) | DEFAULT_GENERATED |
| claim_token | char(36) | YES | NULL/none |  |
| lease_until | timestamp(6) | YES | NULL/none |  |
| attempts | smallint unsigned | NO | 0 |  |
| next_attempt_at | timestamp(6) | YES | NULL/none |  |
| dispatched_at | timestamp(6) | YES | NULL/none |  |
| last_error | varchar(60) | YES | NULL/none |  |
| blocked_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `outbox_events_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `outbox_events_event_id_unique` UNIQUE (event_id)
- `outbox_events_barangay_id_foreign` (barangay_id)
- `outbox_ready_index` (dispatched_at, next_attempt_at, lease_until)
- `outbox_diagnostic_ready_index` (blocked_at, dispatched_at, next_attempt_at)

Foreign keys:

- `outbox_events_barangay_id_foreign`: (barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `outbox_payload_bound`: ((`version` in (1,2)) and (json_storage_size(`payload`) <= 2048))

## outbox_recipients

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| outbox_event_id | bigint unsigned | NO | NULL/none |  |
| recipient_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| in_app | tinyint(1) | NO | 1 |  |
| sms | tinyint(1) | NO | 0 |  |
| audience | enum('resident','official') | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `outbox_recipients_outbox_event_id_recipient_id_unique` UNIQUE (outbox_event_id, recipient_id)
- `outbox_recipient_event_scope_fk` (outbox_event_id, barangay_id)
- `outbox_recipient_user_scope_fk` (recipient_id, barangay_id)

Foreign keys:

- `outbox_recipient_event_scope_fk`: (outbox_event_id,barangay_id) -> outbox_events(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `outbox_recipient_user_scope_fk`: (recipient_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `recipient_channel_boolean_check`: ((`in_app` in (0,1)) and (`sms` in (0,1)))

## password_recovery_challenges

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | char(36) | NO | NULL/none |  |
| user_id | bigint unsigned | YES | NULL/none |  |
| email_digest | char(64) | NO | NULL/none |  |
| code_digest | char(64) | NO | NULL/none |  |
| failed_attempts | tinyint unsigned | NO | 0 |  |
| max_attempts | tinyint unsigned | NO | 5 |  |
| expires_at | timestamp(6) | NO | NULL/none |  |
| resend_available_at | timestamp(6) | NO | NULL/none |  |
| verified_at | timestamp(6) | YES | NULL/none |  |
| superseded_at | timestamp(6) | YES | NULL/none |  |
| consumed_at | timestamp(6) | YES | NULL/none |  |
| authorization_digest | char(64) | YES | NULL/none |  |
| authorization_expires_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `password_recovery_challenges_authorization_digest_unique` UNIQUE (authorization_digest)
- `password_recovery_challenges_user_id_foreign` (user_id)
- `password_recovery_challenges_email_digest_created_at_index` (email_digest, created_at)
- `password_recovery_challenges_expires_at_index` (expires_at)

Foreign keys:

- `password_recovery_challenges_user_id_foreign`: (user_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `recovery_attempt_check`: ((`max_attempts` = 5) and (`failed_attempts` <= `max_attempts`))
- `recovery_window_check`: ((`expires_at` <= (`created_at` + interval 10 minute)) and (`resend_available_at` >= (`created_at` + interval 60 second)))
- `recovery_authorization_pair_check`: (((`authorization_digest` is null) and (`authorization_expires_at` is null)) or ((`authorization_digest` is not null) and (`authorization_expires_at` is not null)))

## personnel_appointments

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| user_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| role | enum('secretary','responder','rescuer') | YES | NULL/none |  |
| source | enum('existing','external','tanod') | YES | NULL/none |  |
| status | enum('Active','Inactive','Unassigned') | NO | NULL/none |  |
| effective_date | date | YES | NULL/none |  |
| assigned_by | bigint unsigned | YES | NULL/none |  |
| address | varchar(300) | YES | NULL/none |  |
| emergency_contact | varchar(200) | YES | NULL/none |  |
| notes | varchar(500) | YES | NULL/none |  |
| legacy | tinyint(1) | NO | 0 |  |
| added_externally_at | timestamp(6) | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `personnel_appointments_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `personnel_appointments_user_id_unique` UNIQUE (user_id)
- `personnel_appointments_assigned_by_foreign` (assigned_by)
- `personnel_appointments_barangay_id_role_status_index` (barangay_id, role, status)
- `appointment_user_scope_fk` (user_id, barangay_id)

Foreign keys:

- `appointment_user_scope_fk`: (user_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `personnel_appointments_assigned_by_foreign`: (assigned_by) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `appointment_role_status_check`: (((`role` is null) and (`status` = _utf8mb4\'Unassigned\')) or ((`role` is not null) and (`status` in (_utf8mb4\'Active\',_utf8mb4\'Inactive\'))))

## personnel_history

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| appointment_id | bigint unsigned | NO | NULL/none |  |
| action | varchar(30) | NO | NULL/none |  |
| from_role | varchar(20) | YES | NULL/none |  |
| to_role | varchar(20) | YES | NULL/none |  |
| source | varchar(20) | YES | NULL/none |  |
| status | varchar(20) | YES | NULL/none |  |
| effective_date | date | YES | NULL/none |  |
| actor_id | bigint unsigned | YES | NULL/none |  |
| role_at_action | varchar(20) | YES | NULL/none |  |
| notes | varchar(500) | YES | NULL/none |  |
| occurred_at | timestamp(6) | YES | NULL/none |  |
| recorded_at | timestamp(6) | NO | CURRENT_TIMESTAMP(6) | DEFAULT_GENERATED |

Indexes:

- `PRIMARY` UNIQUE (id)
- `personnel_history_actor_id_foreign` (actor_id)
- `personnel_history_appointment_id_recorded_at_index` (appointment_id, recorded_at)

Foreign keys:

- `personnel_history_actor_id_foreign`: (actor_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
- `personnel_history_appointment_id_foreign`: (appointment_id) -> personnel_appointments(id); DELETE RESTRICT; UPDATE NO ACTION

## rescues

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| alert_id | bigint unsigned | NO | NULL/none |  |
| assignment_id | bigint unsigned | YES | NULL/none |  |
| rescuer_id | bigint unsigned | NO | NULL/none |  |
| facility_id | bigint unsigned | NO | NULL/none |  |
| destination_snapshot | json | NO | NULL/none |  |
| rescue_status | enum('In progress','Completed') | NO | NULL/none |  |
| notes | text | YES | NULL/none |  |
| rescued_at | timestamp(6) | YES | NULL/none |  |
| legacy | tinyint(1) | NO | 0 |  |
| provenance | varchar(100) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `rescues_rescuer_id_foreign` (rescuer_id)
- `rescues_facility_id_foreign` (facility_id)
- `rescues_alert_id_rescued_at_index` (alert_id, rescued_at)
- `rescue_assignment_owner_fk` (assignment_id, alert_id, rescuer_id)

Foreign keys:

- `rescue_assignment_owner_fk`: (assignment_id,alert_id,rescuer_id) -> alert_assignments(id,alert_id,user_id); DELETE RESTRICT; UPDATE NO ACTION
- `rescues_alert_id_foreign`: (alert_id) -> emergency_alerts(id); DELETE RESTRICT; UPDATE NO ACTION
- `rescues_facility_id_foreign`: (facility_id) -> facilities(id); DELETE RESTRICT; UPDATE NO ACTION
- `rescues_rescuer_id_foreign`: (rescuer_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `rescue_evidence_check`: (((`legacy` = 1) and (`provenance` is not null)) or ((`legacy` = 0) and (`assignment_id` is not null) and (`rescued_at` is not null)))

## sessions

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | varchar(255) | NO | NULL/none |  |
| user_id | bigint unsigned | YES | NULL/none |  |
| ip_address | varchar(45) | YES | NULL/none |  |
| user_agent | text | YES | NULL/none |  |
| payload | longtext | NO | NULL/none |  |
| last_activity | int | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `sessions_user_id_index` (user_id)
- `sessions_last_activity_index` (last_activity)

Foreign keys:

- `sessions_user_id_foreign`: (user_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION

## sms_attempts

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| sms_delivery_id | bigint unsigned | NO | NULL/none |  |
| attempt | smallint unsigned | NO | NULL/none |  |
| claim_token | char(36) | NO | NULL/none |  |
| outcome | enum('started','accepted','rejected','uncertain') | NO | NULL/none |  |
| http_status | smallint unsigned | YES | NULL/none |  |
| error_class | varchar(60) | YES | NULL/none |  |
| provider_message_id | varchar(80) | YES | NULL/none |  |
| started_at | timestamp(6) | NO | NULL/none |  |
| finished_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `sms_attempts_sms_delivery_id_attempt_unique` UNIQUE (sms_delivery_id, attempt)

Foreign keys:

- `sms_attempts_sms_delivery_id_foreign`: (sms_delivery_id) -> sms_deliveries(id); DELETE RESTRICT; UPDATE NO ACTION

## sms_deliveries

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| receipt_id | bigint unsigned | NO | NULL/none |  |
| destination | text | YES | NULL/none |  |
| destination_digest | char(64) | YES | NULL/none |  |
| state | enum('pending','blocked','sending','accepted','network_sent','failed','refunded','uncertain') | NO | pending |  |
| provider_message_id | varchar(80) | YES | NULL/none |  |
| provider_status | enum('Queued','Pending','Sent','Failed','Refunded') | YES | NULL/none |  |
| claim_token | char(36) | YES | NULL/none |  |
| lease_until | timestamp(6) | YES | NULL/none |  |
| attempts | smallint unsigned | NO | 0 |  |
| last_error | varchar(60) | YES | NULL/none |  |
| next_attempt_at | timestamp(6) | YES | NULL/none |  |
| reconcile_at | timestamp(6) | YES | NULL/none |  |
| estimated_segments | int unsigned | NO | 1 |  |
| budget_reserved_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `sms_deliveries_receipt_id_unique` UNIQUE (receipt_id)
- `sms_deliveries_provider_message_id_unique` UNIQUE (provider_message_id)
- `sms_ready_index` (state, next_attempt_at, lease_until)
- `sms_deliveries_state_reconcile_at_index` (state, reconcile_at)

Foreign keys:

- `sms_deliveries_receipt_id_foreign`: (receipt_id) -> delivery_receipts(id); DELETE RESTRICT; UPDATE NO ACTION

## tanod_memberships

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| user_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| pool_reference | varchar(100) | YES | NULL/none |  |
| active | tinyint(1) | NO | 1 |  |
| joined_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `tanod_memberships_user_id_barangay_id_unique` UNIQUE (user_id, barangay_id)

Foreign keys:

- `tanod_user_scope_fk`: (user_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

## users

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| household_id | bigint unsigned | YES | NULL/none |  |
| full_name | varchar(100) | NO | NULL/none |  |
| email | varchar(254) | NO | NULL/none |  |
| password | varchar(255) | NO | NULL/none |  |
| contact_number | varchar(30) | YES | NULL/none |  |
| account_status | enum('Active','Inactive') | NO | Active |  |
| is_resident | tinyint(1) | NO | 0 |  |
| is_captain | tinyint(1) | NO | 0 |  |
| last_login_at | timestamp(6) | YES | NULL/none |  |
| email_verified_at | timestamp(6) | YES | NULL/none |  |
| remember_token | varchar(100) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| auth_version | int unsigned | NO | 0 |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `users_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `users_email_unique` UNIQUE (email)
- `users_barangay_id_foreign` (barangay_id)
- `users_household_scope_fk` (household_id, barangay_id)

Foreign keys:

- `users_barangay_id_foreign`: (barangay_id) -> barangays(id); DELETE RESTRICT; UPDATE NO ACTION
- `users_household_scope_fk`: (household_id,barangay_id) -> households(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

Checks:

- `users_email_normalized_check`: (cast(`email` as char charset binary) = cast(lower(trim(`email`)) as char charset binary))
- `users_auth_version_nonnegative`: (`auth_version` >= 0)

## verification_submissions

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| verification_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| revision | int unsigned | NO | NULL/none |  |
| submitted_at | timestamp(6) | NO | NULL/none |  |

Indexes:

- `PRIMARY` UNIQUE (id)
- `verification_submissions_verification_id_revision_unique` UNIQUE (verification_id, revision)
- `submission_application_unique` UNIQUE (id, verification_id)
- `verification_submissions_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `submission_scope_fk` (verification_id, barangay_id)

Foreign keys:

- `submission_scope_fk`: (verification_id,barangay_id) -> verifications(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION

## verifications

| Column | Type | Nullable | Default | Extra / generated expression |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | NO | NULL/none | auto_increment |
| resident_id | bigint unsigned | NO | NULL/none |  |
| barangay_id | bigint unsigned | NO | NULL/none |  |
| review_status | enum('Pending','Resubmission requested','Approved','Rejected','Expired') | NO | NULL/none |  |
| deadline_at | timestamp(6) | YES | NULL/none |  |
| current_submission_id | bigint unsigned | YES | NULL/none |  |
| revision | int unsigned | NO | 0 |  |
| reviewer_id | bigint unsigned | YES | NULL/none |  |
| reviewed_at | timestamp(6) | YES | NULL/none |  |
| rejection_reason | varchar(1000) | YES | NULL/none |  |
| correction_reason | varchar(1000) | YES | NULL/none |  |
| correction_requested_at | timestamp(6) | YES | NULL/none |  |
| created_at | timestamp(6) | YES | NULL/none |  |
| updated_at | timestamp(6) | YES | NULL/none |  |
| current_resident_key | bigint unsigned | YES | NULL/none | STORED GENERATED (case when (`review_status` in (_utf8mb4\'Pending\',_utf8mb4\'Resubmission requested\',_utf8mb4\'Approved\')) then `resident_id` else NULL end) |

Indexes:

- `PRIMARY` UNIQUE (id)
- `verifications_id_barangay_id_unique` UNIQUE (id, barangay_id)
- `verification_current_resident_unique` UNIQUE (current_resident_key)
- `verifications_reviewer_id_foreign` (reviewer_id)
- `verifications_barangay_id_review_status_deadline_at_index` (barangay_id, review_status, deadline_at)
- `verifications_resident_id_created_at_index` (resident_id, created_at)
- `verification_resident_scope_fk` (resident_id, barangay_id)
- `verification_current_submission_fk` (current_submission_id, id)

Foreign keys:

- `verification_current_submission_fk`: (current_submission_id,id) -> verification_submissions(id,verification_id); DELETE RESTRICT; UPDATE NO ACTION
- `verification_resident_scope_fk`: (resident_id,barangay_id) -> users(id,barangay_id); DELETE RESTRICT; UPDATE NO ACTION
- `verifications_reviewer_id_foreign`: (reviewer_id) -> users(id); DELETE RESTRICT; UPDATE NO ACTION
