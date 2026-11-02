# Copyable Prompt — Backend Programmer 2

You are Backend Programmer 2 for **Barangay Connect**, collaborating with Programmer 1 (P1) and a DBA in `https://github.com/Butvh/barangay-connect-frontend`. Implement operations, in-app notifications, business events and reporting around the existing frontend, preserving its design and workflows. The development window is **Monday November 2–Friday November 6, 2026, Asia/Manila**, five days. DBA owns Semaphore and Make; you supply committed events and integrate their delivery results. Prioritize a secure, tested MVP; richer report presentation is secondary. Do not send paid/real SMS or deploy live changes without the team's specific recipient/budget/environment authorization.

## Starting point and evidence

No Laravel/MySQL/mail/SMS backend exists in the analyzed baseline. The static HTML/CSS/JavaScript ES-module app stores domain data in localStorage and a fictional session user ID in sessionStorage. These browser checks must become server policies, not be reused as authentication. Existing UI works for Resident, Captain, Secretary, Responder, Rescuer. Tanods belong to a fixed pool used by Captain appointments; there is no separate Tanod portal.

Analysis commit `928505bcecad3ba153a764b86c51718c35de7695` has the same tracked tree as main merge `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. Fetch current main and inspect subsequent changes first. Clone the shared repository into any folder on your own device. All paths below are relative to that repository root. Proposed backend/adapters below are new, not claims that infrastructure already exists. Frontend baseline:405 checks and static checks pass.

Read actual files:

- `assets/js/core/{api,permissions,config,assignments,alertMachine,activity,notifications,announcements,facilities,personnel,store,auth}.js`.
- `assets/js/pages/{resident-report,resident-alert,resident-dashboard,resident-map,resident-notifications,official-alert,official-alert-actions,official-alert-view,official-alerts,official-assignment,official-map,official-feedback,official-announcements,captain-reports,captain-reports-model,captain-report-panels,captain-performance,captain-activity}.js` and imported models/views.
- `docs/ASSIGNMENTS-API.md`, `docs/FACILITIES-API.md`, `docs/CONTRACT.md`, `docs/LARAVEL-MIGRATION.md`, verification/security contracts for cross-domain dependencies; tests under `tests/` and existing workflow/static scripts.

Older README/DATA-MODEL descriptions of automatic handoffs are stale. Follow current code and feature contracts.

## Ownership and teammate contracts

Own incident creation/read models, manual responder/rescuer assignment, response/rescue/status history, announcements, feedback, in-app notification APIs/creation handler, transactional audit/outbox writers and report read APIs. Own corresponding frontend adapter modules and tests. DBA owns Semaphore SMS, Make automation, outbox dispatch, SMS jobs/provider client, integration webhook endpoints, delivery status/reconciliation and failure tests, alongside migrations/models/factories/indexes. Do not implement a duplicate provider client, Make scenario, dispatcher or sending job. Do not recreate P1's identity/verification/personnel/facility-management APIs or private document service. Request schema changes from DBA.

Proposed files:

- `backend/app/Http/{Controllers,Requests,Resources}/{Incidents,Civic,Messaging,Reports}/` and matching policies/services.
- `backend/app/Services/Audit/AuditRecorder.php`, `backend/app/Services/Messaging/OutboxWriter.php` and `CreateInAppNotification` handler. DBA owns dispatcher, SMS provider client and sending/reconciliation jobs.
- `backend/routes/operations.php`, `communications.php`, `reports.php`, included by P1's `routes/api.php`.
- `assets/js/adapters/operations.js`, `communications.js`, `reports.js`, consuming P1's `http.js`; domain tests under backend Feature/Unit, frontend adapter tests.

Freeze interfaces Monday: `AuditRecorder.record(actor, roleAtAction, scope, resource, action, summary)` and `OutboxWriter.record(eventId, type, scope, resourceId, recipientRefs, occurredAt)`. They join the caller's database transaction and never send HTTP. Supply concrete PHP interfaces/DTOs early so P1 can use them for verification/personnel/facilities/security events; consumer fakes in tests must not become another production outbox.

Agree one versioned event envelope with DBA: unique event ID, allowlisted event type, barangay/resource reference, server occurrence time, authorized recipient references, channel/template key and minimal payload. P2 defines business triggers and recipient eligibility; DBA resolves delivery details securely and owns transport deduplication. Supply committed-event fixtures and rollback tests. Register your in-app creation handler with DBA's single dispatcher; separate per-channel receipts prevent an SMS retry from duplicating in-app notifications. P2 owns `CreateInAppNotification.handle(event)`; DBA owns dispatcher registration/routing and SMS/Make handling. No external call occurs within a domain transaction.

Use P1's authenticated `/me` and HTTP transport. Prefer same-origin HTTPS frontend/API with Sanctum sessions/CSRF, or owned same-site subdomains. GitHub Pages on `butvh.github.io` and an unrelated API host cannot simply assume Sanctum SPA-cookie compatibility. No demo IDs as credentials, long-lived browser tokens or localStorage fallback after an API failure. P1 owns a coordinated small facade/config integration PR; do not rewrite `core/api.js` concurrently.

## Common API contract

Proposed API root `/api/v1`, success `{data: existing-DTO}`, list `{data:[...],meta:{...}}`; adapters unwrap to existing models. Errors `{code,message,fields,request_id}` mapped to ApiError from401/403/404/409/419/422/429/503. Never forward raw provider/SQL errors. Preserve numeric IDs, exact UI labels, nullable count semantics, assignment flags, snapshots and explicit-offset timestamps. Store UTC, report/format Asia/Manila. No fabricated seed-clock production dates.

Inventory all current facade calls and publish a route/DTO mapping, including dashboard/nearby/map/lookup aggregates. Do not swap a complete scope expected by a summary for a paginated first page. Server-derived aggregate endpoints or explicit adapter pagination are required. Mutations need idempotency keys where retries duplicate actions and expected revision where required; bind a key to actor/route/payload hash and reject changed-payload reuse409.

| Proposed endpoint | Required behavior |
| --- | --- |
| `GET /dashboard` | Effective-role-specific projections from real scoped records; no invented metrics/priority/ETA. |
| `GET/POST /alerts`, `GET/PATCH /alerts/{id}` | Create own verified-resident SOS and edit permitted details; own/history or official-scoped views; idempotent one-active-SOS rule; immutable actor/tenant. |
| `GET /nearby-alerts`, `GET /map` | Sanitized resident nearby records versus authorized operational projections; preserve scope and image-percentage map coordinates. |
| `GET /alerts/{id}/assignment-options` | Eligible personnel, workloads/limit, exclusion reasons, current assignment and alert_revision; server policy. |
| `POST /alerts/{id}/acknowledgments` | Explicit selected responder plus expected revision; state/assignment/history/outbox transaction. |
| `POST /alerts/{id}/assignments` | Explicit authorized responder/rescuer assignment, role/user/revision; no automatic selection. |
| `POST /assignments/{id}/transfers`, `POST /assignments/{id}/cancellations` | Captain-only reason/revision checks, audit and capacity update. |
| `POST /alerts/{id}/responses` | Assigned Responder only: type/status/notes and required boolean rescue_required; true notifies officials to select rescuer, never auto-assigns. |
| `POST /alerts/{id}/rescues` | Assigned Rescuer only: status, active visible destination facility, notes/time; preserve facility snapshot. |
| `POST /alerts/{id}/resolution` | Captain/Secretary explicitly resolves only allowed states/branches; no auto-resolution from completion. |
| `GET/POST /announcements`, `GET/PATCH /announcements/{id}` | Scoped publish/edit and public-to-authorized-resident active views; exact existing content/revision fields. |
| `POST /announcements/{id}/archive`, `/retract` | Existing state transitions, reasons/history/expiry behavior; no silent deletion. |
| `GET/POST /feedback`, `GET /feedback/{id}` | Own typed resident submissions/history or official same-barangay list/detail; preserve full comments/rating/category. |
| `POST /feedback/{id}/assignment`, `/resolution` | Complaint/suggestion Tanod workflow with current statuses; server authority and history timestamps. |
| `GET /notifications`, `PATCH /notifications/{id}`, `DELETE /notifications/{id}`, `POST /notifications/clear-read` | Recipient-scoped read/unread/dismiss/clear-read; safe allowlisted targets; unknown/inaccessible IDs denied. |
| `GET /reports/snapshot`, `/reports/summary`, `/reports/incidents`, `/reports/activity`, `/reports/performance` and authorized detail/export routes | Captain own-barangay source-based metrics and projections consumed by current report pages; no fake historical records. Begin with a compatible scoped snapshot or test the aggregate adapter explicitly. |
| `POST /integrations/make/sms-commands` — DBA-owned | Consume the agreed contract and supply sample business events only. DBA implements this service-authenticated, scoped, idempotent nonurgent command in `routes/integrations.php`; never duplicate it in P2 routes. |

An endpoint path is not enough: document exact input/output fixtures from the current API, including facility snapshots, response logs, assignment history, timelines, filters and error fields. Coordinate incident photo multipart handling with P1's private storage service; define a safe content/size policy rather than treating demo filename as an upload.

Current report code calls `Api.reports.snapshot()`; preserve its scoped shape initially without leaking a complete database or password hashes. Coordinate P1's authenticated polling replacement for `Api.subscribe`, server clock and `/me` hydration; browser storage events do not provide multi-user updates. Stop subscriptions on teardown/logout and handle immediate loss of privileges; preserve existing dirty-form and focus behavior.

## Business rules and race safety

- Approved residency is required for SOS. Protect own resident private history; nearby projection strips reporter name/contact, household identity/exact pin, private descriptions/photos. Staff reads are limited to authorized scope and assigned incidents; broad internal DTOs must not be sent to residents.
- Pending SOS initially has no responder/rescuer. Captain/Secretary acknowledge with an explicit selected Responder. No implicit first eligible staff selection. Rescuer is selected manually by an authorized official only when the workflow requires rescue.
- Normal simultaneous active assignment limits are **Responder2 / Rescuer1**. Current code has a narrow **Captain-only emergency capacity override** requiring explicit confirmation/reason/audit. This differs from the planning brief's absolute limit; preserve it visibly for compatibility, but keep live override disabled pending team ratification. No Secretary override; no override of tenant/role/status/workflow eligibility.
- Captain alone can transfer/reassign/cancel active assignments. Assigned staff log only their own role's work; Captain/Secretary cannot impersonate a responder/rescuer.
- Response Completed releases the responder slot but does not resolve the incident. An explicitly completed response with rescue_required=false supports official resolution from Responding. Rescue-required branch follows rescue progression; Rescuer completion releases their slot but does not itself mark the incident Resolved. Do not fabricate skipped stages or timestamps.
- Use active assignment history, not retained pointer IDs, for workload. Terminal assignment history statuses include completed/cancelled/reassigned/closed. One active row per incident/role. Preserve historical actors, labels, reasons and destination snapshot.
- P1 staffing is Secretary3/Responder6/Rescuer6 occupied positions; Inactive occupants count. Effective inactive/unassigned staff cannot receive work. Role changes are blocked by active old-role responsibilities on unresolved incidents; share locks with P1.
- Facility visible/shared scope is not write authority. Only active visible destinations for new rescue use; historical snapshots survive deactivation. Coordinates are image percentages0–100, not lat/long. No GPS routes/travel ETA, priority, victim breakdown or delivery status invented from missing data.
- Complaints/suggestions persist Pending->Assigned->Resolved. Suggestion summaries label Assigned as Under review and Resolved as Implemented without changing stored workflow. General Feedback has rating/comment and no operational workflow; review/archive is not implemented in the current API and is a deferred feature. Record missing feedback action timestamps prospectively, not fabricated backfill.

With DBA/P1, document one global lock protocol: lock staffing/capacity guards in consistent order, per-person guards sorted by userID, then incident and current assignments. Re-read eligibility/revision under lock. Counts across separate incidents must contend on a common person guard: an alert row lock alone does not prevent over-capacity races. Serialize role changes with the same guard. On transfer lock both old/new staff guards in sorted order. Facility deactivation/new rescue destination share a row-lock protocol. Use deadlock-safe retries for whole internal transactions, never blindly replay external sends. Revision/capacity conflicts409; failed transaction writes no history/outbox/notification.

## Messaging architecture and security — integration boundary with DBA

**DBA implements and operates the SMS/Make pipeline described below. P2 produces domain events, owns in-app notification behavior, and tests the handoff.** These delivery requirements are shared constraints, not another implementation assignment for P2. With this work transferred, P2 owns report/performance API parity and query-test implementation; DBA supplies schema/fixtures and reviews critical query plans after the delivery/database milestones. Defer cosmetic report enhancements before delaying core workflows.

Laravel owns domain events, MySQL writes and a **durable outbox in the same transaction**. Dispatcher only consumes committed events. Create recipient-private in-app notifications and logical SMS deliveries with unique `(event,recipient,channel,template_version)` keys. Record per-provider attempt, messageID, provider status, error class and timestamps. Jobs use a real supervised worker, separate urgent/default queues and bounded backoff/rate limits; a queue table alone does not process anything.

**Urgent:** Laravel urgent queue -> Semaphore directly. **Nonurgent:** optional Make webhook -> approved workflow -> scoped Laravel command -> same SMS queue. Select Make over Zapier for the capstone's branching HTTP workflow; keep it out of emergency delivery dependencies. Do not send the same event through both paths. Enable Make incomplete execution/error handling explicitly and prevent automation replay from duplicating provider POSTs.

Semaphore client uses server-only HTTPS `POST https://api.semaphore.co/api/v4/messages`; obey documented endpoint rates/Retry-After, approved sender, validated Philippine numbers and encoding/segment costs. Provider acceptance is not handset delivery. Preserve Queued/Pending/Sent/Failed/Refunded semantics: documented Sent is delivery to the network. Do not claim handset delivery without evidence. Do not use a message starting with TEST, which provider docs say is silently ignored.

Database deduplication is not provider exactly-once. A timeout may happen after acceptance: mark uncertain, reconcile by provider records/IDs where possible and require manual review when uncertain; no blind retry/double-charge. Test definite rejection, rate limit, timeout-before/after acceptance, malformed response, worker crash, provider outage and low balance. Log redacted diagnostics, never API keys/full recipient lists/sensitive message bodies.

Protect Make endpoints with scoped credentials/HMAC as supported, timestamp/replay protection, event allowlist and rate limit. If direct signature verification is unavailable in selected Make setup, terminate at an authenticated backend gateway. Browser never sees provider key or webhook secret. Minimize payloads; no identity documents or unnecessary precise resident information in third-party automation. Public Git repo contains source only; P1 narrows Pages artifact before backend files appear. `.env`/private uploads/logs/dumps never enter repo or public web root. Use server policies and input allowlists everywhere; actor/tenant comes from authentication.

DBA supplies incidents/assignments/responses/rescues/status history, announcements/history, feedback, notifications/outbox/deliveries/attempts/audit and framework jobs. Do not add individual victims or chart tables without a real requirement. Legacy unknown actors/times remain null. Reports must use actual source evidence, distinct counts and Manila date boundaries; prevent fanout double-counting and spreadsheet-formula injection in CSV.

## Schedule, tests and completion

- **Mon2:** agree contracts and audit/outbox interfaces; real authenticated SOS persistence slice with DBA/P1. Test one-active-SOS/idempotency, no unapproved resident, rolled-back event has no outbox effect.
- **Tue3:** manual acknowledgment/response/no-rescue resolution and manual rescue branch with own-role logging. MySQL tests: two officials competing for last slot on different incidents, same incident double-assignment, stale revision, Secretary override rejection, explicit Captain override audit if enabled, completion releases capacity without resolving.
- **Wed4:** announcements/feedback/recipient notifications and reports; hand committed events to DBA and pair on the SOS-to-delivery trace. DBA implements provider client/worker/reconciliation and performs the specifically approved controlled SMS test.
- **Thu5:** integrated concurrency/role-change/facility races, report/performance projections and query tests. Test cross-barangay/privacy leakage, notification bulk actions, monthly boundaries and unknown histories. Pair with DBA on delivery failure boundaries without implementing a second transport.
- **Fri6:** full five-role E2E, event-to-in-app/SMS integration, state history and adapter regression; DBA leads worker recovery/SMS/Make verification. Review/merge tested slices and document deferred work.

For each slice write a named failing test, implement minimally, run targeted and combined tests, then commit. Use transport fakes in normal tests: no actual paid SMS/mail in CI. Actual-MySQL race tests are necessary; SQLite alone is insufficient. Run frontend `node scripts/run-tests.mjs` and `node scripts/check.mjs`; backend `php artisan test`, Pint test, Composer validation/audit; run combined gates after rebasing/merging main.

Use `codex/backend-p2-<slice>` branches. Do not modify DBA-owned migrations/models or P1-owned foundation/auth transport without coordination. A PR lists endpoint fixtures, authorization cases, migration dependency, concurrency evidence, browser flow evidence, SMS status evidence if approved, rollback and limitations. Review is by a teammate; main requires all checks on the integrated revision. Never force a failing merge.

Your work is complete when real persisted incident/civic/notification paths are wired into the original frontend, authorization/capacity/history rules are enforced server-side, committed events survive worker failure, delivery states are truthful, all required checks pass and setup/monitoring/runbooks are reproducible. Report untested production hosting/SMS explicitly rather than claiming a complete live emergency system.
