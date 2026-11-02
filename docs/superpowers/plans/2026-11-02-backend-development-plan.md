# Barangay Connect Backend Development Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans when implementing the assigned prompt task by task. This document is planning only; no backend has been implemented by this analysis.

**Goal:** Integrate Laravel and MySQL with the existing frontend without redesigning its pages or silently changing its workflows.

**Architecture:** A Laravel API owns authentication, authorization, transactions and durable records. Committed outbox events feed in-app notifications and queued, server-side Semaphore requests; Make is a separate nonurgent automation channel.

**Tech stack:** Existing vanilla JavaScript frontend; PHP/Laravel; MySQL/InnoDB; Laravel database queue initially; Semaphore; Make; GitHub.

**Spec:** User-provided backend planning brief and the later five-day schedule and DBA-owned Semaphore/Make assignment. All team file paths are relative to the cloned repository root.

**Schedule: Monday, November 2–Friday, November 6, 2026, Asia/Manila.** This is five working days, replacing the original November 1–4 four-day window. A secure MVP is a realistic target only with focused parallel work and early infrastructure access; completing and production-hardening every feature is not a reliable five-day promise.

## 1. Frontend Repository and Demo Analysis

### Evidence and limits

- Repository: [Butvh/barangay-connect-frontend](https://github.com/Butvh/barangay-connect-frontend). Inspected the repository checkout at commit `928505bcecad3ba153a764b86c51718c35de7695`. Its tracked tree matches `origin/main` merge `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0` (no tree diff); the GitHub connector also confirmed this remote main commit. Team members must fetch and recheck main before implementation; this is a point-in-time analysis.
- [Deployed demo](https://butvh.github.io/barangay-connect-frontend/login.html): signed into the five fictional demo roles and inspected their main pages. No operational record changes, real uploads, password changes or SMS sends were performed during this analysis.
- Fresh baseline: `node scripts/run-tests.mjs` passed **405 checks**: 354 core tests plus 4 facility, 5 resident SOS, 6 official alert presentation, 7 verification, 12 profile, 9 recovery service and 8 recovery dialog checks. `node scripts/check.mjs` passed, scanning 390 files. There is no package.json/build pipeline; the static check and test scripts are the existing frontend gates.
- This is source inspection plus a broad deployed navigation/read audit, not an exhaustive end-to-end execution of every modal, destructive action or failure case. Backend, database, mail, SMS, webhook and multi-client authorization behavior cannot be verified because these services do not exist yet.

### Confirmed in source

| Area | Existing implementation and integration boundary |
| --- | --- |
| Architecture | Static HTML, CSS and native JavaScript ES modules; local assets; `assets/js/pages/` page controllers and shared `assets/js/core/` services. Preserve this frontend. |
| Demo persistence | `store.js` persists domain data in localStorage, coordinates browser transactions and refreshes tabs. `auth.js` stores a demo user identifier in sessionStorage and compares fictional seed passwords. Neither is server security. |
| API facade | `core/api.js` returns asynchronous projections and `ApiError` errors. Domain helpers include `assignments.js`, `personnel.js`, `facilities.js`, `verification.js`, `announcements.js`, `notifications.js`, `activity.js` and `alertMachine.js`. These are behavior specifications for Laravel, not deployable backend code. |
| Identity | Five login roles: resident, Captain, Secretary, Responder, Rescuer. Tanod is a retained pool membership used in appointments, not a sixth independent workspace. Inactive/unassigned staff lose operational access; independent resident membership may remain. |
| Resident | Registration, household, verification/corrections, SOS, own timeline, announcements, feedback, notifications, profile and illustrated map are implemented with demo data. Approved residency unlocks SOS. |
| Officials | Captain and Secretary share administrative modules. Captain additionally manages personnel and reports. Operational roles have restricted assigned-incident workflows. UI visibility is backed by demo checks, which must become server policies. |
| Assignment | Manual responder selection at acknowledgment; manual rescuer selection after a response says rescue is required. Explicit history, revisions and capacity checks exist. No automatic dispatch. |
| Documents | Verification and personnel upload controls currently store metadata/file names, not private document bytes. Incident photos are represented by file names. Real storage and authorized downloads are missing. |
| Maps | Existing artwork uses `map_x`/`map_y` percentages, 0–100, not latitude/longitude. Preserve artwork, scoped pins and honest unavailable states; no routing/ETA/GPS service exists. |
| Account security | Profile/change-password and three-stage recovery UI exist. `createApi({ accountTransport, recoveryTransport })` provides future service boundaries. Default recovery/change-password behavior fails closed without a server; no mail or real password mutation exists. |
| Notifications/reports | In-app recipient lists and read/unread/dismiss/clear-read flows are simulated. Reports and prospective audit data derive from recorded sources; unknown actors/timestamps are not reconstructed. No real SMS is implemented. |
| Deployment | `.github/workflows/pages.yml` uploads **the whole repository (`path: .`)**. Replace this with an explicit frontend artifact before backend files are introduced. Existing static checks also need scoped backend exclusions without weakening checks on frontend files. |

### Observed deployed pages

| Role | Pages inspected through the deployed interface |
| --- | --- |
| Captain | Dashboard, Alerts/list and detail, Map, verification queue/detail, Announcements, Feedback, Facilities, Personnel, Reports. |
| Secretary | Dashboard, Alerts, Feedback and verification queue; shared implementation of remaining administrative pages examined in source. |
| Responder | Dashboard, Assigned alerts, Map, Facilities, Profile. A direct visit to A-1042 returned **Alert unavailable**, consistent with its being unassigned to this responder; this was not a successful assigned-detail test. |
| Rescuer | Dashboard, Assigned alerts, assigned A-1038 detail, Map, Facilities and Profile. Pickup/drop-off, travel stages and ETA are explicitly unavailable. |
| Resident | Dashboard, Report (opens current active SOS), A-1042 timeline, Map, Announcements, feedback chooser/history, Notifications and Profile. |

### Important differences to resolve explicitly

1. Older README/DATA-MODEL passages describe automatic handoffs. Current `api.js`, `assignments.js` and `docs/ASSIGNMENTS-API.md` require manual assignment. Follow current code/contracts and update stale documentation.
2. The brief says three **active** Secretaries. Current `PERSONNEL_LIMITS` are Secretary **3**, Responder **6**, Rescuer **6**, and occupied roles count even when personnel are Inactive. Preserve occupied-position counting unless the team deliberately approves a rule change.
3. Normal simultaneous incident capacity is Responder **2**, Rescuer **1**. Current code additionally permits a **Captain-only explicit emergency capacity override**, with confirmation, reason and audit. This conflicts with the brief's absolute prohibition. Recommended baseline: preserve this narrow existing exception, visibly documented; never allow a silent override or a Secretary override. The team must ratify this before enabling it in a live environment.
4. General Feedback currently has rating/comment data, without complaint/suggestion operational statuses. Its review/archive workflow is **not implemented in the current API**; older requested designs are not proof of implementation. Treat those actions as a separate future feature, not a required API already wired in the UI.
5. Suggestions keep the workflow labels Pending/Assigned/Resolved. Summary display maps Assigned to “Under review” and Resolved to “Implemented”; do not create contradictory stored states.
6. Legacy feedback lacks reliable assignment/resolution timestamps. Do not invent “today” counts. Record timestamps prospectively and display unavailable legacy metrics truthfully.
7. There is a nullable victim count, not a verified list of individual victims. Do not invent a Victim table or personal victim data merely to match an old diagram.
8. GitHub Pages cannot run Laravel. Browser origin and real session hosting must be decided before connecting authentication.

## 2. Identified Backend Requirements and Missing Functionality

Every record read/write now using `Api`/`Store` needs a server counterpart, including dashboard projections, filters and lookup data. Replace domain persistence through an adapter; keep UI models, markup and navigation.

| Domain | Required backend work | Atomic operations / async work |
| --- | --- | --- |
| Identity and profile | Registration, login/logout/current user, profile/household updates, real password change and recovery; server-derived effective role. | User + household creation; password/token consumption and session revocation; queued mail. |
| Verification | Application, immutable submissions/documents, reviewer decisions, correction reasons, expiry and latest status. | Review against exact revision; resubmit + new deadline; private storage staging/cleanup; expiry scheduler. |
| Personnel | Captain-only external addition, fixed-pool appointment, reassignment/removal, statuses and history. | Staffing slot locks; old-role incident responsibility checks; account/appointment/history/audit updates together. |
| SOS and dispatch | Idempotent SOS creation, own timeline, official read views, manual dispatch, response/rescue logs, explicit resolution. | Incident state + assignment + capacity + status history + outbox transaction; file processing separately. |
| Facilities | Managing-barangay authority; add/edit/status/location; visible shared referrals; historical snapshots. | Revision check and audit; race-safe destination validation; active-directory refresh. |
| Civic modules | Announcement publication/edit/archive/retract/expiry; typed feedback; complaint/suggestion Tanod assignment and resolution. | State/history/outbox together; scheduled expiry; no general-feedback status fabrication. |
| Notifications | Recipient authorization, read/unread/dismiss/clear-read; allowlisted links. | Outbox-driven creation; SMS delivery attempts/status reconciliation asynchronously. |
| Reporting | Captain-only scoped aggregates, source/audit activity, personnel work, CSV/print data. | Indexed read queries; prevent multiplication across joined logs; async export only if needed. |

Required persistence includes private uploaded bytes, document metadata, secure credentials/sessions, assignment revisions and histories, action timestamps, notification recipients, outbox and SMS attempt records. Missing production services include mail, queue workers, scheduler, backups, monitoring, backend hosting and server-enforced tenancy.

**Scope for Friday:** essential = real identity/permissions, verification and corrections, SOS/dispatch/response/rescue, facilities, civic CRUD, private files, in-app notifications, auditable state changes and one tested SMS path. Secondary = complete reporting/performance projections, nonurgent Make scenario and richer failure dashboards. Optional after Friday = live broadcasting, travel tracking, individual victim management, general-feedback review/archive, advanced exports and provider failover. Do not remove existing frontend views to hide incomplete integration; keep the public demo separate and label backend release coverage.

## 3. Recommended Backend Architecture

```text
Existing frontend (same-origin HTTPS preferred)
       | JSON / multipart + secure session + CSRF
       v
Laravel API: authenticate -> policy + barangay scope -> validate
       |
       v
MySQL transaction: domain change + history/audit + durable outbox
       | commit
       v
Outbox dispatcher / Laravel queue worker (after commit)
       +--> recipient-scoped in-app notifications -> frontend polling
       +--> urgent SMS job -> Semaphore -> mobile network -> recipient
       |                      |
       |                      +--> provider IDs/status reconciliation
       +--> nonurgent job -> Make webhook -> optional approved workflow
                              -> Laravel idempotent SMS command -> same SMS queue
```

MySQL stores records; it is not an HTTP relay to Make. Laravel controls business events. Queue after commit prevents SMS for rolled-back actions; a durable outbox also recovers the commit-to-dispatch crash gap. Use separate urgent and default queues/workers so a slow export/Make job cannot block SOS notifications. Begin with the Laravel database queue and a real supervised worker; Redis is optional later. Laravel documents after-commit dispatch behavior in its [queue documentation](https://laravel.com/framework/docs/queues).

An incident acknowledgment is a domain action, not an SMS receipt. SOS submission returns only after the incident is durably committed; it must not wait for SMS. Surface failed notification delivery to officials without losing the SOS. No handset delivery or emergency response guarantee can be inferred from API acceptance.

### Hosting and version decision

- Preferred five-day integration: serve the existing frontend assets and `/api/v1` from one HTTPS origin, with the Laravel web server document root restricted to `backend/public`. Publish only the existing HTML/assets into a dedicated public frontend directory during deployment; never expose the repository root. This does not require a frontend rewrite.
- Alternative: `app.<owned-domain>` and `api.<owned-domain>` with Sanctum stateful cookies, explicit CORS origin, credentials and CSRF configuration. GitHub Pages may remain the fictional public demo, or use the owned frontend domain.
- **Do not assume Sanctum cookies work from `butvh.github.io` to an unrelated API domain.** Laravel requires the frontend and API to share the same top-level domain for its SPA cookie authentication. Same-origin hosting avoids this dependency. If retaining unrelated production domains is mandatory, pause that integration decision and design an appropriate BFF/token model; do not put long-lived tokens in localStorage as a shortcut. [Laravel Sanctum](https://laravel.com/framework/docs/sanctum).
- Host Laravel on a PHP-capable server/service with HTTPS, private MySQL access, persistent private storage, a continuously running queue worker, scheduler/cron, logs and backups. XAMPP is local development, not the production deployment plan. No specific hosting purchase is assumed or authorized.
- Choose/pin Laravel and PHP together on Monday. Current Laravel documentation lists Laravel 13 requiring PHP 8.3+, while Laravel 12 supports PHP 8.2. Prefer 13 on a compatible team/host runtime; use supported 12 deliberately if a verified PHP 8.2 constraint makes that necessary. Commit composer.lock. Installed XAMPP/PHP/database versions were not established in this audit. Verify `php -v`, `composer --version` and `SELECT VERSION()`; some XAMPP installations bundle MariaDB rather than the requested MySQL. Use actual MySQL for shared CI/concurrency checks. [Laravel support policy](https://laravel.com/framework/docs/releases).

### Notification reliability contract

Each logical notification has an event ID, recipient, channel and template version, with a unique deduplication key. A claimed outbox event produces at most one logical delivery row per recipient/channel. Record each provider attempt, external message ID, status, last error category, next retry and timestamps. Keep statuses honest: queued, sending, provider-accepted, network-sent, failed, uncertain; “delivered” only with evidence actually supported by the provider.

Semaphore documents `Queued`, `Pending`, `Sent`, `Failed` and `Refunded`; **Sent means delivered to the network**, not verified handset receipt. It documents a 120 requests/minute limit on the ordinary messages endpoint and splits messages over 160 ASCII characters. Preserve provider semantics rather than renaming every success “delivered.” [Semaphore API](https://api.semaphore.co/docs).

Retry definite transient failures with bounded exponential backoff/jitter and provider Retry-After. Reconcile **ambiguous timeouts** before retrying: a POST may have been accepted despite a lost response. No provider idempotency guarantee was established in this audit; a database unique key cannot itself guarantee exactly-once SMS outside the database. Put uncertain sends into reconciliation/manual review rather than blind resend. Disable automatic Make replay of SMS POSTs unless the call goes through Laravel's idempotent command boundary. Never send the same urgent event through direct Laravel and Make simultaneously.

## 4. Make vs. Zapier Comparison and Final Recommendation

| Criterion | Make | Zapier |
| --- | --- | --- |
| Laravel / Semaphore integration | HTTPS custom webhook and HTTP workflow; flexible routing, mapping and branching. Use Semaphore HTTP API, without assuming a native connector. | Webhooks/custom requests and multi-step automation; straightforward simple workflows, but needed features depend on plan. |
| Free allowance | Official pricing lists 1,000 credits/month and two active scenarios. Credits count actions; this is not 1,000 guaranteed SMS. | Free lists 100 tasks/month and two-step Zaps. Professional lists webhooks/multi-step workflows and starts at US$19.99/month. |
| Failures and retries | Enable incomplete-execution storage deliberately; it is off by default. Configure handlers, alerts and safe retry rules. | Configure supported retries/error monitoring for the selected plan; never rely on automation replay for exactly-once sending. |
| Cost/complexity | Better fit for a small branching capstone scenario and visible workflow demonstration. | Convenient ecosystem; relatively restrictive free workflow for this HTTP chain. |
| Emergency dependence | Extra external dependency, limits and account availability; keep it outside urgent path. | Same concern; no demonstrated end-to-end delivery guarantee. |

**Select Make** for nonurgent automation. Keep the urgent path Laravel queue -> Semaphore. For a demo, Make can receive a redacted nonurgent announcement event and call a scoped Laravel SMS command; the provider key remains in Laravel, and all sends use the same ledger. A direct Make -> Semaphore experiment is possible with server-side Make secrets, but adds a second credential/control surface and is not the recommended release path.

Pricing/features checked November 2, 2026. Make's dynamic page did not expose a reliable paid quote in this audit; verify the dashboard plan, team access, billing period, tax and region before spending. Zapier's advertised starting figure is not a binding project quote. Sources: [Make pricing](https://www.make.com/en/pricing), [Zapier pricing](https://zapier.com/pricing), [Make webhooks](https://help.make.com/webhooks), [Make incomplete executions](https://help.make.com/incomplete-executions).

Semaphore advertises **PHP 0.56/text excluding VAT**, separate from automation fees. For illustration, 100 single-part standard texts start at PHP 56 excluding VAT; actual cost depends on segments, encoding, route and purchased terms. Keep a small approved test budget and recipient allowlist; no provider purchase/send is authorized by this planning document. Its FAQ says sender-name approval can take up to five business days, so request the team's provider setup Monday and treat approval as an external schedule risk. [Semaphore pricing](https://semaphore.co/), [Semaphore FAQ](https://api.semaphore.co/faq).

## 5. Laravel, MySQL, and SMS Security Strategy

### Identity and authorization

- Secure Laravel-supported password hashing; Argon2id is a good fit for the frontend's up-to-128-character policy. Never import demo plaintext passwords as real accounts. Use explicit development-only seeders and a separate account provisioning plan.
- Session regeneration on login; HttpOnly, Secure production cookies; CSRF on cookie-authenticated mutations; logout invalidation; expiry and revocation after password reset. No browser-stored user ID can authenticate to Laravel. Refresh `/me` after role/status changes and enforce permissions on every request, not just login.
- Derive actor, role, managing barangay, reviewer and assignment creator on the server. Reject attempts to submit protected identity/role fields. Policies constrain every resource lookup, file download, export and bulk action. No general Captain bypass across barangays; no Captain/Secretary impersonation of response/rescue authors.
- Registration creates Residents only. Officials are provisioned/appointed through authorized processes. Existing Tanod membership is immutable in this module. Captain bootstrap must be an administrator-controlled procedure, never public registration.
- Rate-limit login, recovery, document upload, SOS creation and provider endpoints with distinct limits. Preserve an existing active SOS and idempotency result rather than create duplicates under repeated clicks/retries.

### Application, files and privacy

- FormRequest allowlists; Eloquent bindings; parameterized queries; safe sort allowlists; explicit mass-assignment fields. Escape user content using the existing safe text rendering; no raw HTML from complaints, filenames or provider errors.
- Private verification/requirements storage outside the web root; authorization-mediated download with safe filenames and MIME headers. Validate actual content/MIME and size, reject executable/double-extension abuse, quarantine/scan documents where available. No public storage symlink for identity documents. Stage uploads and clean orphaned objects when a transaction fails.
- Verification valid ID and proof are each JPEG/PNG/PDF, nonempty, maximum **10 MiB**. Personnel requirements are up to ten supported files, **5 MiB each**. Enforce proxy/PHP total request limits too. Define incident-photo content/size policy before real upload integration; the current demo only retains a filename.
- Store precise household pins and documents privately. Return coarse nearby incident projections to residents without reporter identity/contact, household ID/pin, photos or free-text sensitive description. Never send a broad internal DTO and merely hide fields in HTML.
- HTTPS, explicit CORS, restrictive frame/referrer/content policies, production debug off, redacted logs, no credentials in URLs; no wildcard credentialed CORS. Separate runtime database user from migration/admin credentials. Keep MySQL private and use encrypted remote connections/backups.
- Webhook URL is secret but not sufficient authentication. A backend-controlled Make gateway validates scoped bearer/HMAC credentials, event ID, timestamp and replay window; rate-limit and allowlist event/template types. If Make cannot verify a signature in the selected setup, terminate at Laravel's authenticated gateway or use its supported authenticated webhook mechanism, not an unauthenticated public receiver.
- Apply purpose limitation, lawful processing basis, clear privacy notice, least access, documented retention/deletion, encrypted backups, access logging and an incident-response process. Minimize data sent to Make/Semaphore and review processor/cross-border arrangements with the school's/barangay's privacy lead. Review real identity/health/emergency records before deployment; this plan is not a legal compliance certification. [Philippine Data Privacy Act / NPC](https://privacy.gov.ph/data-privacy-act/).

### Public repository and deployment

The existing public repository can safely contain backend **source** when secrets/data are excluded. Prefer this for the three-member team, with explicit ownership. A private backend repository may reduce unintended source exposure but does not substitute for credential management and adds cross-repository coordination. Never commit `.env`, private keys, real exports/SQL dumps, resident data, documents, production logs or recovery codes. Ignore backend/vendor, private storage and runtime artifacts. `.env.example` contains blank/example values only; secret-scan commits and rotate any exposed secret rather than merely deleting the file.

**Before adding backend/**, replace Pages `path: .` with an allowlisted static staging artifact containing intended root HTML and `assets/` only (plus verified Pages metadata if needed). Check the resulting archive does not contain backend, docs, tests, dotfiles, vendor or uploads. Scope the existing static scanner so backend dependencies are checked by backend gates instead of violating frontend runtime-package restrictions. Production document root must be `backend/public`, not the checkout.

Proposed `backend/.env.example` (application-specific keys must be explicitly read in server config; this is not a real configuration):

```dotenv
APP_NAME="Barangay Connect"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=barangay_connect_local
DB_USERNAME=
DB_PASSWORD=
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=false
SESSION_DOMAIN=
SANCTUM_STATEFUL_DOMAINS=localhost:8000
QUEUE_CONNECTION=database
CACHE_STORE=database
FILESYSTEM_DISK=local
MAIL_MAILER=log
MAIL_HOST=
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=no-reply@example.invalid
MAIL_FROM_NAME="Barangay Connect"
SMS_ENABLED=false
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
SMS_TEST_RECIPIENT_ALLOWLIST=
MAKE_ENABLED=false
MAKE_WEBHOOK_URL=
MAKE_SHARED_SECRET=
RECOVERY_CODE_PEPPER=
```

Local mail logs must stay private and never enter CI artifacts. Staging/production use HTTPS URLs, `APP_DEBUG=false`, secure cookies, a real mail transport and managed secrets. Generate APP_KEY/pepper server-side; never copy real values into this example. Prefer a separate urgent SMS worker and service configuration.

## 6. Database Architecture and Integration Dependencies

### Proposed schema groups — not existing tables

Use MySQL/InnoDB, utf8mb4, foreign keys, UTC timestamps and Asia/Manila reporting boundaries. MySQL 8.4 LTS is a proposed target, subject to host verification. No new table per dashboard card, report chart or role screen is needed.

| Group | Proposed tables and essential fields/relationships |
| --- | --- |
| Scope/identity | `barangays`; `households` (barangay, address, nullable paired map_x/map_y); `users` (household nullable, barangay, normalized unique email, password hash, names/contact, account status, resident/Captain membership, last_login_at). Operational roles derive from appointments; present existing role flags in DTOs. |
| Staffing | `tanod_memberships` (unique user/barangay, immutable pool identity); `personnel_appointments` (user, barangay, current role, source, status, appointment date, assigning Captain, revision); `personnel_history` (from/to role, effective date, actor, notes); `capacity_guards` (scope/type keys used to serialize staffing and person dispatch). One current staffing appointment per user; history is separate. |
| Verification | `verifications` (resident, barangay, state, deadline, current submission/revision, review/correction metadata); `verification_submissions` (application, revision, submitted_at); `documents` (owner/scope, private storage key, safe original filename, detected MIME, bytes, verification-submission or personnel owner). Explicit FKs/checks ensure a valid owning record. |
| Incidents | `emergency_alerts` (resident/household/owned barangay, type, description, location snapshot, pin, nullable victim_count, state/revisions, report/ack/resolve times and actors); `alert_assignments` (alert, role, user, actor, status, start/end/reason, override metadata); `alert_responses` (assignment, responder, response_type/status, rescue_required boolean, notes/time); `rescues` (assignment, rescuer, active facility FK plus destination snapshot, status/notes/time); `incident_status_history`. |
| Civic/directory | `facilities` (managing barangay, visibility scope, name/type/address, capacity/contact, active, pin/map scope, revision, creator/updater); `announcements` plus `announcement_history`; `community_feedback` (resident, kind, title/description/category/location, nullable assignee, rating/comment, operational status only for complaint/suggestion, timestamps/revision). Two fixed facility types can be validated values rather than a separate lookup table. |
| Messaging/audit | `notifications` (recipient, event ID, type, safe relative target, read/dismiss timestamps); `outbox_events`; `sms_deliveries`; `sms_attempts`; `activity_logs` (actor, role at action, barangay, resource, before/after summary, event/evidence type, server time). Avoid storing secrets or complete identity-document contents in audit JSON. |
| Framework/security | Laravel sessions, jobs, failed_jobs and cache tables as needed; `password_recovery_challenges` containing opaque challenge ID, nullable user, keyed email/code digests, attempts, expiry, resend limit, verification/consumption state and reset-authorization digest/expiry. No plaintext code storage. |

This grouping is intentionally more normalized than browser JSON but avoids duplicate operational-role tables and materialized UI tables. Final column types/nullable rules and DTO translations are DBA deliverables Monday; adding future entities requires an actual workflow need.

### Cardinalities and integrity

- Barangay 1:M households/users/managed facilities/incidents/announcements; household 1:M resident users and incidents. Official users may have no household. Shared facilities retain a definite managing authority even when visible outside it.
- User 1:M historical appointments/verifications/feedback; at most one current staffing appointment. A verification 1:M submissions, submission 1:M documents. Approved/rejected/expired decisions remain historical.
- Incident 1:M assignments/status events/response logs/rescue logs. Each assignment belongs to one incident and staff role; only one active assignment per incident/role. Facility 1:M historical rescues, with immutable destination snapshot.
- Recipient user 1:M notifications; outbox event 1:M logical channel deliveries, each delivery 1:M attempts. Unique event/recipient/channel/template deduplication and scoped request-id keys prevent duplicate logical commands.
- Restrict physical deletion of referenced users/facilities/incidents. Use status/end dates, not cascades that destroy history. Unknown legacy data stays null and displays Not recorded.

### Transaction and concurrency design

1. Agree a **shared lock order** before services are built. Serialize staffing changes using barangay/role capacity guards and a per-person guard. Dispatch and role changes both lock the relevant person's guard before checking active appointment/availability; do not let independent code paths bypass this guard.
2. Assign/transfer: lock all affected personnel guards in sorted user-ID order, then incident/current assignments in a fixed order; re-read authoritative state; validate revision, barangay, effective role, capacity and workflow; write assignment/end state, incident revision/history/audit/outbox; commit. Acquiring different locks in reverse order is not acceptable. DBA and programmers must test the precise protocol, including concurrent role changes.
3. Ordinary limits are 2/1. A Captain override, if ratified, needs explicit confirmation/reason and durable metadata. Override never bypasses role, account status, tenant or incident-state checks.
4. A unique generated nullable active key on `(alert_id, role)` can enforce one active assignment per incident/role; MySQL does not provide a generic filtered partial index. Use a separate unique current-assignment table instead if the team selects it. Document one choice, not two competing implementations.
5. Two officials assigning the same last free worker to different incidents must contend on that worker guard. Locking only one incident and then counting rows is insufficient. Release capacity on assignment completion/cancellation/transfer/incident closure, based on active records, not stale pointer IDs.
6. Pending SOS is idempotent per resident and command key, with a guarded one-active-SOS rule. Review/resubmission uses exact application/submission revision; terminal decisions cannot race a replacement upload. Facility deactivation and new destination use the same row lock/order so validation cannot race commit.
7. Store revisions; return HTTP 409 for stale state or capacity conflict with a safe machine code. Never retry a stale command silently. Roll back history, notifications and outbox with a rejected domain change.

### Common API contract (freeze Monday morning)

All paths below are **proposed**. API root `/api/v1`; success `{ data: <existing-DTO> }`, list pagination `{ data: [...], meta: {...} }`; adapter unwraps data so existing page models retain their expected shape. Error `{ code, message, fields, request_id }`; trusted field errors only. Map 401/403/404/409/419/422/429/503 to existing `ApiError` behavior, never raw provider/SQL errors.

Preserve numeric identifiers, exact current UI status labels, nullable count semantics, assignment flags and destination snapshots. Store UTC; return explicit-offset/UTC timestamps and format in Asia/Manila. Existing seed clock is not production time. Define page/filter contracts per method; do not return a paginated page where an existing model expects a complete scope for totals. Use dedicated aggregate endpoints or explicit pagination adaptation.

Domain writes accept an idempotency key where retry duplicates would matter and expected revision where the current contract uses it. A request key is bound to actor, route and payload hash; reuse with a different payload is a 409. Actor/tenant IDs never come from browser authority. Frontend production mode must never fall back to localStorage after network/authorization failure.

Integration also needs an awaited server logout (current shell handlers call synchronous demo `Auth.logout()`), authenticated `/me` hydration before role guards, and an API-backed clock instead of `Store.now()`'s frozen seed time. Replace `Api.subscribe()`'s browser-storage refresh with authenticated polling that returns an unsubscribe function, stops on logout/page teardown and handles role revocation. Keep existing refresh/focus/dirty-form guards. `Api.reports.snapshot()` is a real existing facade method: initially preserve its authorized scoped DTO through a proposed `/reports/snapshot` endpoint, or explicitly test an aggregate adapter before changing report models. Never expose a full database snapshot or user secrets.

Shared interfaces: `AuditRecorder.record(actor, roleAtAction, scope, resource, action, summary)` and `OutboxWriter.record(eventId, type, scope, resourceId, recipientRefs, occurredAt)` participate in the caller's transaction and never invoke external HTTP. P2 owns these writers and the in-app creation handler; P1 uses them for verification/personnel/facility/security events. DBA owns persisted contracts, the single outbox dispatcher, per-channel delivery receipts, Semaphore client/jobs/status reconciliation and Make scenarios/webhook commands. Domain owners define eligible recipients and versioned minimal event payloads; dispatcher retries cannot duplicate another channel's completed delivery. P1 retains recovery/authentication mail.

## 7. Three-Member Workload Distribution

| Member | Primary ownership | Shared support / workload balancing |
| --- | --- | --- |
| **Backend Programmer 1 (P1)** | Laravel bootstrap/auth/session/profile/recovery mail; registration/household; private documents; verification; Captain personnel and facilities; corresponding adapters/policies. | Own common HTTP transport, `/me`, CI/Pages safety and shared config registration. Publish domain events through P2's writers for DBA's delivery pipeline. |
| **Backend Programmer 2 (P2)** | SOS/manual dispatch; response/rescue; announcements; feedback; in-app notification APIs/handler; transactional audit/outbox writers; report/performance APIs and their query tests; corresponding adapters/policies. | Define business event triggers/eligible recipients with P1, hand off committed fixtures to DBA. Own report query implementation previously supported by DBA; no SMS client, Make scenario or second dispatcher. |
| **DBA + SMS/Automation Integration Engineer** | Schema/models/migrations/factories; constraints/capacity guards; MySQL CI/restore tests; outbox dispatcher and SMS jobs; Semaphore; Make account/scenarios/webhook commands; delivery tracking/retries and runbooks. | Review event contracts and critical indexes, pair on transaction/delivery boundaries. P2 takes report query implementation to make room for SMS/Make. Keep richer automation and nonessential optimizations secondary if core work slips. |

P1 and P2 each own the browser integration and end-to-end tests of their domains. DBA does not become the sole integration tester. No member edits another member's shared files without coordinating a small PR. The exact standalone prompts are in sections 10–12 and sibling files.

## 8. Five-Day Development Timeline — November 2–6

| Day / gate | P1 | P2 | DBA | Integrated exit evidence |
| --- | --- | --- | --- | --- |
| **Mon Nov 2** | Verify PHP/framework/host; scaffold Laravel; safe Pages artifact; sessions/login/me; HTTP transport. | Freeze incident/business-event contracts and audit/outbox writers; authenticated SOS service slice. | Freeze schema/lock/delivery contracts; identity/incident/outbox migrations first; verify Semaphore/Make access and sender setup. | Contracts first; migrations next. By evening, frontend login -> `/me` -> SOS -> committed MySQL row with test notifications. No provider dependence. |
| **Tue Nov 3** | Registration, private document submission, review/correction/resubmit; personnel/facility services and policies. | Manual acknowledgment + responder, response/no-rescue path, manual rescuer, rescue completion/resolution; notifications ledger. | Civic/personnel/file/verification migrations; unique/FK/active-slot constraints; race fixtures and query indexes. | A verified resident can complete both no-rescue and rescue branches on integrated environment. Wrong-role/cross-barangay requests fail. |
| **Wed Nov 4** | Finish profile/password/recovery mail, private downloads, personnel and facility integration. | Announcements/feedback/in-app notifications and reports; pair on committed-event handoff. | Complete fixtures/recovery schema; queued Semaphore/status reconciliation, one nonurgent Make flow; specifically approved real SMS test if ready. | Correction/resubmit/review and facility synchronization work; trace SMS from committed event to honest provider status, or report external blocker. |
| **Thu Nov 5** | Security/session/document/adapter tests. | Domain concurrency/privacy tests, report/performance projections and query tests; paired delivery-boundary checks. | MySQL races, migration/restore checks; worker/timeout/retry/Make replay tests; critical index review. | Integrated staging; worker restart recovery, capacity/stale-state and replay defenses proved. |
| **Fri Nov 6** | Auth/upload/privacy release checks and fixes. | Five-role E2E, domain/in-app/SMS handoff, report coverage and adapter regression. | Restore/migration integrity plus Semaphore/Make acceptance, delivery evidence, queue/scenario runbooks. | Scope freeze around noon Manila; reviewed required-green release candidate by agreed cutoff. Deferred work stays on branches. |

**Immediate team actions Monday:** confirm runtime/database versions, hosting/document root, same-origin authentication topology, owner for mail and Semaphore account/sender, approved test recipient/budget, and the two rule discrepancies above. Sender approval, inaccessible hosting or lack of mail are external blockers: complete local/staging tests with fakes, but do not label real delivery/security as tested.

### Small reviewable implementation units

For each unit below: write the named failing tests first, run them to confirm the intended failure, implement only the unit, run targeted and shared gates, then submit a focused commit/PR. Never use migrations against a production database as a test.

- [ ] **Foundation (P1 + DBA):** proposed `backend/` scaffold and `routes/api.php` importing domain route files, MySQL test configuration, private storage, common errors and public artifact. Tests: `SessionBoundaryTest` (no demo ID trust), `FrontendArtifactTest` (no backend/secrets).
- [ ] **Identity/civic vertical slices (P1):** proposed `app/Services/Identity`, `Verification`, `Personnel`, `Facilities`; DTO Resources and `assets/js/adapters/identity.js`, `civic.js`. Tests: `VerificationResubmissionTest`, `PersonnelCapacityTest`, `FacilityVisibilityTest` with exact rules from section 6 and P1 prompt.
- [ ] **Operations/in-app/report slices (P2):** incident/civic/report services, audit/outbox writers and in-app handler; adapters `operations.js`, `communications.js`, `reports.js`. Tests: `AssignmentRaceTest`, `NoRescueResolutionTest`, `RecipientIsolationTest`, source-based report query tests.
- [ ] **Data and delivery (DBA):** migrations/models/factories, single dispatcher, SMS provider/jobs, Make integrations and MySQL integrity suite. Tests: `ActiveAssignmentConstraintTest`, `AppointmentConcurrencyTest`, `MigrationUpgradeTest`, `BackupRestoreCheck`, `SmsUncertainSendTest`, `MakeReplayTest`.
- [ ] **Release (all):** real-host E2E flows, access-denial matrix, privacy projections, queue/cron and artifact inspection. Publish measured results and unimplemented coverage; merge only required-green work.

## 9. Shared GitHub Collaboration and Integration Strategy

### Repository organization and ownership

Keep the current root frontend. Add **proposed** `backend/` for Laravel; do not relocate/rebuild existing pages during the sprint. New proposed frontend adapters live under `assets/js/adapters/`, selected by a coordinated factory seam. `core/api.js` and `auth.js` are shared entrypoints, not parallel editing targets.

| Path | Owner / rule |
| --- | --- |
| `backend/database/**`, `backend/app/Models/**`, schema fixtures | DBA; programmers request schema changes via contract ticket and migration PR. Never independently generate duplicate tables. |
| `backend/app/Http/{Controllers,Requests,Resources}/Identity/**`, `/Verification/**`, `/Personnel/**`, `/Facilities/**`; matching services/policies | P1. P1 also owns framework bootstrap/config/composer files. |
| Equivalent `/Incidents/**`, `/Civic/**`, `/Reports/**`; notification API, audit/outbox writers and in-app handler | P2. |
| `backend/app/Services/Messaging/` delivery dispatcher/Semaphore/Make services; `backend/app/Jobs/Messaging/**`; `backend/app/Http/{Controllers,Requests}/Integrations/**`; `backend/config/messaging.php` | DBA; excludes P2-owned OutboxWriter and in-app handler. |
| `backend/routes/identity.php`, `civic-admin.php` | P1. |
| `backend/routes/operations.php`, `communications.php`, `reports.php` | P2. |
| `backend/routes/integrations.php`, secret-free Make blueprint and delivery runbooks | DBA; P1 registers route/config/queue/scheduler hooks in coordinated foundation PR. |
| `backend/routes/api.php`, shared error format, auth middleware, workflow YAML | One P1-maintained foundation PR; changes reviewed by P2/DBA. |
| `assets/js/adapters/http.js`, identity/civic adapters | P1. |
| Operations/communications/report adapters | P2. |
| `assets/js/core/api.js`, `auth.js`, `config.js` | P1 coordinates small factory/config edits after both domain adapters have tests; preserve demo mode. No giant facade rewrite. |

Use short-lived `codex/backend-p1-<slice>`, `codex/backend-p2-<slice>`, `codex/backend-db-<slice>` branches from updated main. An optional integration branch can collect compatible PRs for joint testing, but must not replace required main checks. Establish the foundation PR first; thereafter merge schema/contract slices ahead of dependent endpoints. Rebase/merge updated main before final checks, resolve conflicts with the affected owner, rerun the **combined** suite on the merge result, and require review by a teammate. Do not force-push shared main, reset another person's branch, or merge failing work.

Meet at start, midday and end of each day for 10–15 minutes: contract changes, migration status, blockers and one integrated flow. Use GitHub issues for endpoint owner, migration dependency and acceptance evidence. Each PR includes endpoints/DTOs, migration impact, authorization matrix, tests/commands, UI evidence, remaining limitations and rollback. Credentials are shared via approved secret storage, never issue bodies/chat screenshots.

CI must run existing frontend gates, PHP syntax/style (Laravel Pint), Laravel tests, MySQL-backed migrations/constraints/concurrency tests and dependency/secret checks; use actual MySQL for locking tests rather than relying on SQLite. Isolate CI databases. No real SMS/mail in normal CI: fake the transport and separately record a controlled staging delivery test. Protect main and production deployment environments; deploy immutable tested revisions with migration backups and supervised queue restart.

## 10. Prompt for Backend Programmer 1

Copy the complete standalone prompt: [2026-11-02-backend-prompt-p1.md](2026-11-02-backend-prompt-p1.md). It includes its own context, files, endpoints, rules, dependencies, test cases, five-day milestones and completion criteria; it does not require the P2/DBA prompts.

## 11. Prompt for Backend Programmer 2

Copy the complete standalone prompt: [2026-11-02-backend-prompt-p2.md](2026-11-02-backend-prompt-p2.md). It owns operations/messaging and defines integration boundaries with P1 and DBA.

## 12. Prompt for Database Administrator

Copy the complete standalone prompt: [2026-11-02-backend-prompt-dba.md](2026-11-02-backend-prompt-dba.md). It owns schema/models/migrations and shares the same transaction and policy assumptions.

## 13. Final Integration, Testing, and Deployment Checklist

- [ ] Versions/hosting/MySQL verified, framework pinned, migrations installed on a disposable fresh DB and upgraded seeded DB.
- [ ] Every endpoint has unauthenticated/wrong-role/wrong-barangay/other-owner tests, including lists, exports and private downloads. Role removal immediately revokes protected API access.
- [ ] Registration cannot create an official; profile cannot change role/tenant/email authority; real credentials are hashed, never demo-derived.
- [ ] Known/unknown recovery requests are indistinguishable; expiry, cooldown, five-attempt lockout, superseded code and one-use authorization races tested; real mail separate from API acceptance. Current-password change and reset revoke/rotate sessions as designed.
- [ ] Valid ID/proof upload -> correction reason -> same-application new submission -> new 7-day deadline -> final decision works; correction waiting does not auto-expire. Terminal and stale decisions are blocked.
- [ ] Staffing 3/6/6 occupied limits, Inactive slots, Tanod return, external unassignment and busy-role change restrictions pass. Captain override rule is explicitly ratified before live use.
- [ ] Repeated/concurrent SOS creates one active incident. Acknowledgment requires selected responder. Response cannot auto-select a rescuer. Only assigned staff log their own work.
- [ ] Concurrent ordinary dispatch at the 2/1 boundary, competing same-role assignment, cancellation, transfer, completion, stale revision and role-change races pass against MySQL. Only explicit audited Captain override may exceed ordinary capacity if enabled.
- [ ] Responding + completed response + rescue_required=false can resolve; rescue-required branch needs appropriate rescue progression and official resolution. Completion releases capacity without fabricating skipped milestones or overall resolution.
- [ ] Facility management respects managing barangay; shared visibility does not grant write access. Deactivated destinations cannot be newly selected; old destination snapshots remain intact. Pin updates preserve 0–100 image coordinates and scoped artwork.
- [ ] Announcements/status/expiry and complaint/suggestion workflows retain current labels; General Feedback remains separate; unknown historical timing is not invented.
- [ ] Resident nearby DTO contains no private reporter/household/contact/document data. Every notification/read/dismiss/clear-read is recipient-scoped.
- [ ] Transaction rollback emits no notification. Worker restart recovers outbox. Duplicate dispatch jobs do not create duplicate logical sends. Definite failure, provider rate limit, ambiguous timeout, low balance and disabled-provider states are tested and visible to operators.
- [ ] A controlled, approved real SMS captures event ID, recipient confirmation, provider ID and precise provider status. Network-sent is not labeled handset-delivered. No public testing prefix that the provider silently ignores; use an approved informational template.
- [ ] Reports reconcile with recorded fixtures, Manila month boundaries and null histories; CSV export escapes spreadsheet-formula content; print keeps native browser behavior.
- [ ] Frontend adapter tests and all existing 405 checks pass; `node scripts/check.mjs` passes; backend Pint/tests/dependency checks and MySQL suite pass on the integrated revision.
- [ ] Frontend Pages archive and production web root inspected: no backend source/config, `.env`, private uploads, SQL dump or logs served. HTTPS/CSRF/CORS/session/headers/debug/private DB settings verified on actual staging.
- [ ] Backup restored successfully; migrate/rollback or forward-fix process rehearsed; private storage permissions, worker supervision, cron, failed-job alerts and SMS budget controls verified.
- [ ] Friday release notes distinguish implemented/tested, partial, externally blocked and deferred features. Main merge is reviewed and required-green; do not call the system production-ready based on frontend tests alone.

**Planning output only:** these documents do not implement a Laravel application, database, provider configuration or deployment. They may be shared through a documentation branch/PR; existing frontend source and workflows remain unchanged.
