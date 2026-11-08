# Database and delivery presentation — November 5, 2026

**Current November5 candidate review:** [9bc1a04/f4e8df9/22365ad privacy and presentation handoff](CURRENT-CANDIDATE-PRIVACY-READINESS-2026-11-05.md). Reviewed Linux CI41883691022 passes384 tests/2108 assertions but is **overall RED** at the required photo opening-session browser gate; resident gallery is absent. Independent DBA target120 tests/709 assertions passes with one Windows symlink skip; actual local producer/fake-worker modes and replay pass. P1 facility history/UTC and P2 actual producers are implemented. Final corrected-pin photo/browser/Linux acceptance and host operations remain pending; real external delivery is untested. Normal optional/SMS/Make/dispatch flags stay off.

Use the concise queue/scheduler/cleanup, current authority, fake-versus-real delivery, uncertainty and backup/reset checklist in that handoff. The remainder describes the preserved fictional profile and implemented schema.

## Implemented persistence

Thirteen migrations/42 InnoDB tables/67 FK relationships, generated from actual MySQL metadata. All preceding eleven migrations are unchanged. New12/13 widen facilities to160/300/50 and retain immutable scoped full-history snapshots, with actual P1 atomic writing/projection. Photo metadata, self-only consent and private current SMS authority evidence remain separate entities. No grant is seeded from phone/role data and no legacy facility history is invented. [Full implemented ERD](DATABASE-ERD.md), [dictionary](data-dictionary.md), [facility contract](FACILITY-PERSISTENCE-CONTRACT.md).

~~~mermaid
erDiagram
  barangays ||--o{ users : scopes
  users ||--o{ emergency_alerts : reports
  users ||--o{ incident_photos : uploads
  emergency_alerts o|--o{ incident_photos : attaches
  users ||--o{ notification_preferences : self_records
  users ||--o{ sms_authorizations : scoped_recipient
  sms_attempts ||--o{ sms_authorizations : current_gate
  facilities ||--o{ facility_history : retains
  users o|--o{ facility_history : actor_snapshot
~~~

The compact diagram omits composite scope columns; the full ERD shows each actual FK constraint. A relationship never grants authority. Facility history keeps the name/role/full display state at action; facility edits/deactivation do not rewrite rescue destination snapshots. Retained history and wide values refuse unsafe downgrade.

## Short transaction and delivery explanation

A Laravel command validates the original authenticated observation, scope and revision, then commits source/history/audit/outbox together. Failure rolls back the complete command. The existing dispatcher reads committed work and creates independent recipient/channel receipts, so SMS retries do not repeat completed in-app notifications.

The queue wakes the existing SMS worker. Recipient/account/appointment -> consent precedes exact current source/ledger checks at reservation/retry and again before sending. Each gate records private revision/policy/template evidence and commits before external I/O. Revocation before the final gate blocks a send; an already-started provider request cannot be cancelled. Ledger/fences deduplicate intent, not carrier effects; an ambiguous timeout stays uncertain for GET-only reconciliation and never blind POST retry.

Urgent incident.created.v2 uses Laravel -> Semaphore directly. Approved nonurgent announcement.published.v2 uses Make -> authenticated scoped Laravel command -> the SAME ledger/worker. Content approval differs from recipient consent. Positive/missing/revoked/wrong-purpose real producer fixtures generated2/0/0/1 accepted FAKE POSTs; completed-report replay adds0. Queued fake acceptance is not handset delivery. Normal optional/SMS/Make/dispatch/production worker settings stay off.

## Reproducible fictional profile and reset

Use P1's reviewed [presentation launcher/profile](https://github.com/Butvh/barangay-connect-frontend/blob/9bc1a04b2005602de25879221042511f07a3ffa8/docs/backend/PRESENTATION.md) from an exact source-preserved snapshot. P1 owns Laravel/shared selection and original-browser workflows; do not create another scaffold, writer or seeder.

1. Record exact owner pins/hashes and use the reviewed current additive schema. Supply private local APP_KEY/credentials for loopback MySQL8.4 with the actual +00:00 connector. Use a NEW unique confirmed bc_dba_p1_presentation_* schema with matching disposable DB_TEST_DATABASE.
2. Follow the unchanged node scripts/presentation-demo.mjs prepare/serve recipe. Preparation refuses an existing dataset, creates fictional accounts and keeps credentials/private bytes outside the public root. Never reuse another device's paths/schema/event IDs. No preapproved consent is fabricated; demonstrate real self-consent only in the accepted profile.
3. Restart serve against the same source/data. Reset by preserving the old source/dataset/evidence/objects and preparing a new snapshot with a unique schema suffix. No DROP/migrate:fresh/truncation of existing presentation data. DBA test reset routines are for explicit disposable fixtures only.
4. Rehearse original cookie/CSRF/session-observation login, manual SOS/response/rescue/explicit resolution, safe photo access, history/in-app/report/admin workflows and wrong-role/scope denials against P1/P2's truthful current feature matrix. Same-role reauthentication must not silently replay a stale form. Registered original-browser certification is a joint owner gate, not inferred from SQL/Node success.

Real local evidence includes MySQL constraints/transactions/locks, actual owner services/private bytes/native PDF parsing, typed writers/in-app receipts, full facility history, current worker and exact real source events. Semaphore/Make HTTP is fake-only. No live host, external sender/credits/account/recipient/scenario or handset delivery acceptance is claimed. GitHub Pages cannot execute Laravel.

Readiness8AM, source/data freeze noon, full checks2PM, rehearsal3PM, restart/restore4PM, presentation5PM Asia/Manila. Preserve the separately passing380/2063 fallback and identify any still-unaccepted original browser or rubric flow truthfully. No merge/deployment/shared-live migration/real message/Make activation is authorized.
