# Implemented MySQL ERD — November4 consent update

Generated from the actual tested MySQL8.4.13 schema:40 InnoDB tables,10 migrations. Only PK/FK attributes are shown for compactness; the photo/preference tables additionally show their persisted evidence fields. Composite relationships are one edge per actual constraint, not separate invented references. Nullability determines optional parent references. Unique constraints/indexes and complete types are in [the data dictionary](data-dictionary.md); authority is application policy, never an ERD relationship.

~~~mermaid
erDiagram
  activity_logs {
    bigint id PK
    bigint barangay_id FK
    bigint actor_id FK
  }
  alert_assignments {
    bigint id PK
    bigint alert_id FK
    bigint barangay_id FK
    bigint user_id FK
    bigint assigned_by FK
    bigint ended_by FK
    bigint override_by FK
  }
  alert_responses {
    bigint id PK
    bigint alert_id FK
    bigint assignment_id FK
    bigint responder_id FK
  }
  announcement_history {
    bigint id PK
    bigint announcement_id FK
    bigint actor_id FK
  }
  announcements {
    bigint id PK
    bigint barangay_id FK
    bigint author_id FK
  }
  barangays {
    bigint id PK
  }
  cache {
    varchar key PK
  }
  cache_locks {
    varchar key PK
  }
  capacity_guards {
    bigint id PK
  }
  community_feedback {
    bigint id PK
    bigint barangay_id FK
    bigint resident_id FK
    bigint assigned_tanod_id FK
  }
  delivery_receipts {
    bigint id PK
    bigint outbox_event_id FK
    bigint recipient_id FK
  }
  documents {
    bigint id PK
    bigint barangay_id FK
    bigint submission_id FK
    bigint appointment_id FK
    bigint uploader_id FK
  }
  emergency_alerts {
    bigint id PK
    bigint barangay_id FK
    bigint resident_id FK
    bigint household_id FK
    bigint acknowledged_by FK
    bigint resolved_by FK
  }
  facilities {
    bigint id PK
    bigint managed_by_barangay_id FK
    bigint created_by FK
    bigint updated_by FK
  }
  failed_jobs {
    bigint id PK
  }
  households {
    bigint id PK
    bigint barangay_id FK
  }
  idempotency_requests {
    bigint id PK
    bigint actor_id FK
  }
  incident_photos {
    bigint id PK
    char upload_id
    bigint barangay_id FK
    bigint uploader_id FK
    int uploader_auth_version
    char intent_digest
    char input_sha256
    bigint incident_id FK
    varchar disk
    varchar object_key
    varchar mime
    int bytes
    char sha256
    enum state
    char cleanup_token
    timestamp cleanup_lease_until
    smallint cleanup_attempts
    enum failure_code
    timestamp created_at
    timestamp updated_at
    timestamp uploaded_at
    timestamp expires_at
    timestamp attached_at
    timestamp failed_at
    timestamp removed_at
  }
  incident_status_history {
    bigint id PK
    bigint alert_id FK
    bigint actor_id FK
  }
  job_batches {
    varchar id PK
  }
  jobs {
    bigint id PK
  }
  make_commands {
    bigint id PK
    bigint outbox_event_id FK
  }
  make_dispatches {
    bigint id PK
    bigint outbox_event_id FK
  }
  messaging_budgets {
    date day PK
  }
  messaging_rate_windows {
    varchar endpoint PK
  }
  notification_preferences {
    bigint id PK
    bigint user_id FK
    bigint barangay_id FK
    enum purpose
    enum channel
    enum state
    bigint revision
    varchar policy_version
    varchar template_version
    bigint recorded_by FK
    timestamp granted_at
    timestamp revoked_at
    timestamp created_at
    timestamp updated_at
  }
  notifications {
    bigint id PK
    bigint recipient_id FK
    bigint barangay_id FK
  }
  outbox_events {
    bigint id PK
    bigint barangay_id FK
  }
  outbox_recipients {
    bigint id PK
    bigint outbox_event_id FK
    bigint recipient_id FK
    bigint barangay_id FK
  }
  password_recovery_challenges {
    char id PK
    bigint user_id FK
  }
  personnel_appointments {
    bigint id PK
    bigint user_id FK
    bigint barangay_id FK
    bigint assigned_by FK
  }
  personnel_history {
    bigint id PK
    bigint appointment_id FK
    bigint actor_id FK
  }
  rescues {
    bigint id PK
    bigint alert_id FK
    bigint assignment_id FK
    bigint rescuer_id FK
    bigint facility_id FK
  }
  sessions {
    varchar id PK
    bigint user_id FK
  }
  sms_attempts {
    bigint id PK
    bigint sms_delivery_id FK
  }
  sms_deliveries {
    bigint id PK
    bigint receipt_id FK
  }
  tanod_memberships {
    bigint id PK
    bigint user_id FK
    bigint barangay_id FK
  }
  users {
    bigint id PK
    bigint barangay_id FK
    bigint household_id FK
  }
  verification_submissions {
    bigint id PK
    bigint verification_id FK
    bigint barangay_id FK
  }
  verifications {
    bigint id PK, FK
    bigint resident_id FK
    bigint barangay_id FK
    bigint current_submission_id FK
    bigint reviewer_id FK
  }
  users o|--o{ activity_logs : activity_logs_actor_id_foreign
  barangays ||--o{ activity_logs : activity_logs_barangay_id_foreign
  users o|--o{ alert_assignments : alert_assignments_assigned_by_foreign
  users o|--o{ alert_assignments : alert_assignments_ended_by_foreign
  users o|--o{ alert_assignments : alert_assignments_override_by_foreign
  emergency_alerts ||--o{ alert_assignments : assignment_alert_scope_fk
  users ||--o{ alert_assignments : assignment_user_scope_fk
  emergency_alerts ||--o{ alert_responses : alert_responses_alert_id_foreign
  users ||--o{ alert_responses : alert_responses_responder_id_foreign
  alert_assignments o|--o{ alert_responses : response_assignment_owner_fk
  users o|--o{ announcement_history : announcement_history_actor_id_foreign
  announcements ||--o{ announcement_history : announcement_history_announcement_id_foreign
  users ||--o{ announcements : announcements_author_id_foreign
  barangays ||--o{ announcements : announcements_barangay_id_foreign
  users ||--o{ community_feedback : feedback_resident_scope_fk
  tanod_memberships o|--o{ community_feedback : feedback_tanod_scope_fk
  outbox_events ||--o{ delivery_receipts : delivery_receipts_outbox_event_id_foreign
  users ||--o{ delivery_receipts : delivery_receipts_recipient_id_foreign
  outbox_recipients ||--o{ delivery_receipts : receipt_authorized_recipient_fk
  personnel_appointments o|--o{ documents : document_appointment_scope_fk
  verification_submissions o|--o{ documents : document_submission_scope_fk
  users ||--o{ documents : documents_uploader_id_foreign
  households ||--o{ emergency_alerts : alert_household_scope_fk
  users ||--o{ emergency_alerts : alert_resident_scope_fk
  users o|--o{ emergency_alerts : emergency_alerts_acknowledged_by_foreign
  users o|--o{ emergency_alerts : emergency_alerts_resolved_by_foreign
  users o|--o{ facilities : facilities_created_by_foreign
  barangays ||--o{ facilities : facilities_managed_by_barangay_id_foreign
  users o|--o{ facilities : facilities_updated_by_foreign
  barangays ||--o{ households : households_barangay_id_foreign
  users ||--o{ idempotency_requests : idempotency_requests_actor_id_foreign
  emergency_alerts o|--o{ incident_photos : photo_incident_owner_fk
  users ||--o{ incident_photos : photo_uploader_scope_fk
  users o|--o{ incident_status_history : incident_status_history_actor_id_foreign
  emergency_alerts ||--o{ incident_status_history : incident_status_history_alert_id_foreign
  outbox_events ||--o{ make_commands : make_commands_outbox_event_id_foreign
  outbox_events ||--o{ make_dispatches : make_dispatches_outbox_event_id_foreign
  users ||--o{ notification_preferences : preference_recorder_scope_fk
  users ||--o{ notification_preferences : preference_user_scope_fk
  users o|--o{ notifications : notification_recipient_scope_fk
  users ||--o{ notifications : notifications_recipient_id_foreign
  barangays ||--o{ outbox_events : outbox_events_barangay_id_foreign
  outbox_events ||--o{ outbox_recipients : outbox_recipient_event_scope_fk
  users ||--o{ outbox_recipients : outbox_recipient_user_scope_fk
  users o|--o{ password_recovery_challenges : password_recovery_challenges_user_id_foreign
  users ||--o{ personnel_appointments : appointment_user_scope_fk
  users o|--o{ personnel_appointments : personnel_appointments_assigned_by_foreign
  users o|--o{ personnel_history : personnel_history_actor_id_foreign
  personnel_appointments ||--o{ personnel_history : personnel_history_appointment_id_foreign
  alert_assignments o|--o{ rescues : rescue_assignment_owner_fk
  emergency_alerts ||--o{ rescues : rescues_alert_id_foreign
  facilities ||--o{ rescues : rescues_facility_id_foreign
  users ||--o{ rescues : rescues_rescuer_id_foreign
  users o|--o{ sessions : sessions_user_id_foreign
  sms_deliveries ||--o{ sms_attempts : sms_attempts_sms_delivery_id_foreign
  delivery_receipts ||--o{ sms_deliveries : sms_deliveries_receipt_id_foreign
  users ||--o{ tanod_memberships : tanod_user_scope_fk
  barangays ||--o{ users : users_barangay_id_foreign
  households o|--o{ users : users_household_scope_fk
  verifications ||--o{ verification_submissions : submission_scope_fk
  verification_submissions o|--o{ verifications : verification_current_submission_fk
  users ||--o{ verifications : verification_resident_scope_fk
  users o|--o{ verifications : verifications_reviewer_id_foreign
~~~

No user/consent rows, credentials, private bytes or proposed tables are exported. The original nine migrations are unchanged; current authority/byte/worker/producer acceptance remains separate from this implemented schema.
