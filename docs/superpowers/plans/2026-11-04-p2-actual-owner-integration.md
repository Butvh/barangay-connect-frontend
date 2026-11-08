# P2 actual owner-service integration plan

> **For agentic workers:** Use superpowers:executing-plans in the existing isolated P2 worktree. Keep the published b477a7c presentation checkpoint available. Execute each task through real failing tests before runtime changes.

**Goal:** Connect P2 source commands to the published P1 photo/consent services and DBA current worker, while unblocking exact P1 administrative in-app events through the existing P2 writer.

**Architecture:** Preserve the single source transaction, original observed identity/revision and successful-intent replay. Read immutable reference metadata without acquiring late user locks; declare mutable people before source locks; stage bytes and preflight consent outside source SQL. Reuse actual owner interfaces, typed writer, independent receipts and shared frontend transport. No replacement services or global enablement.

**Tech stack:** Laravel13/PHP8.5, MySQL8.4, existing vanilla JavaScript adapters and shared submission intents.

**Spec:** user p2-next-prompt.md; actual P1 private-photo/current-consent/admin services now pinned bf9d67b and DBA current worker8cd2740; shared backend plan. These publications supersede absent-dependency rulings for conditional source integration only.

## Global constraints

- P1 owns account/admin/byte services, shared provider registration, staging, HTTP and readers. DBA owns models/migrations/worker/transports. Change only P2 source/consumer/writer/tests/docs.
- No main/teammate merge/retarget, shared/live database, real messages, Make, production workers or deploy. Test only confirmed private MySQL schemas and fake transports.
- Preserve plain details behavior, immediate SOS, original UI and intent key/body/revision/identity generation. New controls stay disabled until actual joint acceptance and P1's reviewed registration.
- No source transaction byte/network I/O, mutable-person locks after source locks, whole-scope/audience locking, fabricated consent or invented historical records.

## Review focus

- Exact persisted source and current recipient role/scope must authorize every new event; registry recognition alone is insufficient. All P1 families remain in-app only.
- Photo successful replay must reauthorize original current identity/source without consuming tokens or running obsolete revision checks. Attachment-only commands advance revision/audit; failed multi-token writes roll back completely.
- Resolve metadata IDs without locks and attach ascending metadata IDs even when token order is reversed. Cleanup/transfer/generation revocation retain actual policy authority.
- Optional consent preflight occurs before source locks and is skipped for existing command outcomes; actual audience intersection and worker current reservation/pre-send remain distinct gates.
- Current UTC connection/time semantics and owner-source fingerprints must hold; report owner mismatches without editing their files or describing earlier test pins as current.

## Task 1 — actual P1 source events

Files: P2 TypedOutboxWriter, InAppHandler, NotificationAccess and a focused P2 administrative source-reference helper; P2-owned real MySQL tests. Consume actual AdministrativeContext/ProfileAdministration/ResidentRegistration/FacilityAdministration/VerificationAdministration fixtures. Support only exact versioned source kinds and payloads, minimal own-account/reviewer/Captain audiences, current source access and safe original links.

- [x] Run published actual P1 administrative fixtures to record the unsupported-source RED.
- [x] Add actual producer/dispatcher/current-source revocation/cross-scope/SMS-injection/rollback tests.
- [x] Implement the P2-only writer/handler/current-source extension, including subsequently published actual personnel transitions; run targeted tests and prepare focused owner handoff.

## Task 2 — actual private photos

Files: P2 IncidentService details callback, optional P2 metadata/reference seam, operations adapter/original resident details page and new real-service tests. Consume IncidentPhotos::stage/attach(observed,uploadId,incidentId,expectedRevision)/download, actual immutable metadata and existing P2 policy; P1 must select final shared bindings.

- [x] Write/run failing actual stage+details+download tests, including attachment-only revision/audit, successful lost-reply replay, body/revision/generation denial and caller rollback.
- [x] Implement bounded token payload and metadata-ID ordering inside once-miss before source increment; preserve unrelated details semantics and safe projection.
- [x] Test multi-token opposite order/consumption with real services/processes; retain actual owner cleanup/transfer/history tests. Use existing P1 shared multipart/intent seams for original optional details; immediate SOS never waits for staging.
- [x] Request exact P1 binding/reader/original-browser acceptance; leave unavailable controls gated until verified. Joint original-photo browser/session-generation acceptance remains outstanding, not completed by Node assertions.

## Task 3 — actual consent-aware producer fixtures

Files: P2 Module/IncidentService/CivicService, OutboxWriter/TypedOutboxWriter, optional preflight seam and focused real-service fixtures/tests. Consume actual SmsEligibilityReferences::allows outside source transactions and DBA's existing current worker with fake transports.

- [x] Record actual positive producer RED with persisted consent and current worker; retain old default in-app/explicit unsupported probe evidence separately.
- [x] Implement pre-source single-recipient preflight, successful-outcome skip and actual minimal source audience intersection for incident.created.v2 and announcement.published.v2 only; no client channel authority. Writer opt-in also defaults false.
- [x] Test actual consent/current-worker denial, replay/rollback/queue-time and between-gate revocation with fake HTTP. Publish guarded actual source-service fixture entrypoint/event IDs in the acceptance document.
- [x] Run current owner/SQL/frontend/transport/artifact/style/dependency/hash gates and one runtime-slice review/fix pass. Full327/1719 has one P1 fixture-isolation failure/two explicit skips; report these and retain feature gates. Publication tracked in execution ledger; no merge.

Result and outstanding owner work: [P2 actual-owner acceptance](../../P2-ACTUAL-OWNER-INTEGRATION.md). The first runtime review preceded the separately regression-tested personnel extension/current-DBA fixture correction; do not conflate their review scopes. P1 retains registration/readers/staging/Chromium/Linux/PDF and fixture cleanup; DBA retains configured positive-worker acceptance. These are incomplete joint acceptance gates, not permission requests or substitutes for security checks.
