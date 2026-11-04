# Database and delivery presentation — November 5, 2026

Deadline5PM Asia/Manila. Keep the passing core fallback tonight8PM; accept stretch slices only after actual joint tests by8AM. Freeze source/data noon, full checks2PM, rehearse3PM and restart/restore4PM. No merge/deployment/shared-live migration/real message/Make activation is authorized.

## Implemented persistence

Eleven ordered migrations/41 InnoDB tables. The eleventh retains private reservation/pre-send consent evidence, the tenth adds ratified self-only purpose SMS preferences, and the ninth retains private reporter-owned photo metadata. All ten preceding migrations remain unchanged. No consent grant is seeded from fictional phone/role data. [Consent fields/constraints](SMS-CONSENT-PROPOSAL.md) and [photo metadata](PHOTO-METADATA-AGREEMENT.md) are persistence, not proof of actual authority or bytes.

The [complete implemented41-table ERD](DATABASE-ERD.md) is generated from actual MySQL key metadata. The compact view below highlights only the newly integrated relationships.

~~~mermaid
erDiagram
  barangays ||--o{ users : scopes
  users ||--o{ emergency_alerts : reports
  users ||--o{ incident_photos : uploads
  emergency_alerts o|--o{ incident_photos : attaches
  users ||--o{ notification_preferences : self_records
  barangays ||--o{ notification_preferences : scopes
  users ||--o{ sms_authorizations : scoped_recipient
  sms_attempts ||--o{ sms_authorizations : accepted_current_gate
~~~

Actual composite FKs include barangay on users/preferences/photos and reporter on the incident-photo association; the compact diagram omits repeated columns. Preference user and recorded_by reference the same scoped owner. Audit references are polymorphic application evidence, not an invented preference FK. Relations never grant permissions.

## A short walkthrough explanation

A Laravel command checks the original authenticated identity, scope and revision, then commits source/history/audit/outbox together in MySQL. Rollback leaves none committed. A separate dispatcher consumes committed outbox work and records independent recipient/channel receipts, so SMS retries do not repeat completed in-app notifications.

The database queue wakes the existing SMS worker. The ledger deduplicates logical intent/fences attempts; it does not guarantee exactly-once carrier effects. Uncertain POST timeouts stay uncertain for reconciliation, never blind resend. Urgent incident.created.v2 uses Laravel -> Semaphore directly. Approved nonurgent announcement.published.v2 uses Make -> authenticated scoped Laravel command -> the same ledger/worker. Publication approval is distinct from recipient consent.

P1 actual CurrentSmsConsent and the existing DBA worker now enforce recipient/account/appointment -> consent -> current source/ledger reservation and repeat the final pre-send gate, committing before provider I/O. P2 must still publish actual service-produced positive intent fixtures. P1 owns the shared UTC connector correction; a non-UTC worker connection fails closed. Revocation before that gate denies; an already-started request cannot be cancelled. Missing authority remains unavailable and production delivery stays off.

## Reproducible fictional fixture/reset

Use P1's reviewed [presentation profile](https://github.com/Butvh/barangay-connect-frontend/blob/bbb690eda11b6be419ead37fe36bc93edbf59920/docs/backend/PRESENTATION.md) and unchanged scripts/presentation-demo.mjs from a source-preserved private snapshot. P1 owns the Laravel/bootstrap/profile/browser walkthrough; do not create a competing scaffold or seed.

1. Record exact P1/P2/DBA pins/hashes. Review/repin the additive tenth/eleventh migrations/models/tests before composing; never forge hashes or relax path/collision checks.
2. Supply private local credentials/APP_KEY for loopback MySQL8.4. Use a NEW unique bc_dba_p1_presentation_* schema, APP_ENV=testing, explicit disposable flags and matching DB_TEST_DATABASE. Keep SMS/Make/production dispatch off.
3. Run node scripts/presentation-demo.mjs prepare, then serve from the reviewed private snapshot. Preparation refuses an existing schema and generates fictional operational accounts; credentials stay in storage/app/private, out of screenshots/public artifacts. No preapproved consent is fabricated.
4. Restart serve against the same source/data. To reset, preserve the old dataset/evidence/private objects and prepare a new snapshot with a unique new schema suffix. No DROP/migrate:fresh/truncation of existing presentation data.
5. Rehearse real cookie/CSRF login, manual SOS/response/rescue/resolution, history/in-app/report reads and denials according to P1/P2's truthful feature matrix. Label metadata SQL and fake-provider evidence; unimplemented controls stay unavailable.

DBA tests separately use whitelisted fresh bc_dba_*/p2_test_* schemas and scoped test accounts, resetting only explicit disposable test fixtures. That is test infrastructure, not the presenter reset command. Backup/restore tests use fictional private bytes and encrypted local artifacts; real resident data is never imported.

## Real versus fake

Real local evidence: MySQL constraints/transactions/row locks, actual owner identity/source services where published, typed audit/outbox adapters and in-app receipts. Fake-only: Semaphore/Make HTTP, budgets/replay/timeout/reconciliation. External provider/sender/credits/recipient prerequisites are unmeasured; carrier/Make delivery is untested. Actual P1 bytes and current worker revocation now have measured service tests; P2 positive producer and original-photo-form integration remain joint dependencies. GitHub Pages cannot execute Laravel.

P12e70538 now adds measured actual photo services: all12 service/HTTP/concurrency cases pass; full newer composition251/1133 has one explicit Windows symlink skip, with matching P1 Linux combined/browser CI green. P2 public upload/caller integration remains gated. Current P12e8161e authority and DBA worker measurements are in [the worker record](CURRENT-SMS-WORKER.md). Consent agreement and worker implementation are complete; actual P2 positive producer acceptance remains unavailable. P1 newer mandatory administration work is outside these frozen worker measurements.
