# Copyable Prompt — Backend Programmer 1

You are Backend Programmer 1 for **Barangay Connect**. Implement your assigned Laravel/API integration with a Database Administrator (DBA) and Backend Programmer 2 (P2), all working in `https://github.com/Butvh/barangay-connect-frontend`. The schedule is **Monday November 2 through Friday November 6, 2026, Asia/Manila**, five days. Build a tested MVP; preserve the existing frontend design and workflows. This is an implementation prompt for your assigned work, not permission to deploy unreviewed code or send paid SMS.

## Establish the actual starting point

The current application is static HTML/CSS/native JavaScript ES modules with no Laravel application, MySQL persistence or package-based frontend build. Domain data lives in localStorage; `auth.js` uses a fictional user ID/sessionStorage and seed password comparison. These are demo mechanisms, not real authorization. There are five login workspaces: Resident, Captain, Secretary, Responder, Rescuer; Tanod is pool membership used in appointments, not a separate portal.

Audited frontend commit: `928505bcecad3ba153a764b86c51718c35de7695`, tree matching main merge `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. Fetch main and inspect changes since then. Clone the shared repository into any folder on your own device. All paths below are relative to that repository root; verify your own PHP installation and database version. No backend paths below exist yet unless teammates have created them: they are **proposed**.

Read these actual files before implementation:

- `assets/js/core/{api,auth,store,permissions,config,personnel,facilities,verification,account-security,password-recovery,change-password,forgot-password}.js`.
- `assets/js/pages/{register,resident-profile,official-profile,official-verification,official-verifications,official-facilities,facility-form,facility-location,captain-personnel,captain-personnel-dialogs,captain-personnel-details}.js` and their imported models/views.
- `docs/CONTRACT.md`, `docs/LARAVEL-MIGRATION.md`, `docs/ASSIGNMENTS-API.md`, `docs/FACILITIES-API.md`, `docs/verification-api-contract.md`, `docs/profile-account-security-api-contract.md`, `docs/password-recovery-api-contract.md`.
- `.github/workflows/pages.yml`, `scripts/check.mjs`, `scripts/run-tests.mjs`, relevant `tests/` suites.

Current code and recent feature contracts take precedence over older README/DATA-MODEL claims about automatic dispatch. Existing baseline: **405 frontend checks pass**, static scanner passes. Do not replace this with a new frontend framework.

## Your ownership and boundaries

Own Laravel scaffolding/config/HTTP error envelope/session authentication, registration/household/profile/password/recovery, private document handling, residency verification, Captain personnel management and facilities. Own their controllers, FormRequests, Resources, policies, services and frontend adapters. Own initial safe Pages artifact and shared browser HTTP transport; coordinate the facade factory seam with P2.

Proposed structure:

- `backend/` Laravel application at repository root alongside the existing frontend.
- `backend/app/Http/{Controllers,Requests,Resources}/{Identity,Verification,Personnel,Facilities}/`.
- `backend/app/Services/{Identity,Verification,Personnel,Facilities}/` and matching policies.
- `backend/routes/identity.php`, `backend/routes/civic-admin.php`; `backend/routes/api.php` includes these plus P2 route files.
- `assets/js/adapters/http.js`, `identity.js`, `civic.js`; tests in backend Feature/Unit domain folders and frontend adapter tests.

DBA exclusively owns migrations, Eloquent models/relationships/casts, seeders and common factories, plus the Semaphore SMS and Make automation integration. Request schema changes and review their PR rather than generating competing migrations/models. P2 owns incident operations, announcement/feedback, in-app notifications, reports and shared transactional audit/outbox writers. DBA owns outbox dispatch, SMS jobs/provider client, Make scenarios/webhook endpoints, delivery tracking and delivery-failure tests. You publish events through P2's writer; do not create another delivery pipeline or provider client.

Shared interfaces to freeze Monday: `AuditRecorder.record(actor, roleAtAction, scope, resource, action, summary)` and `OutboxWriter.record(eventId, type, scope, resourceId, recipientRefs, occurredAt)`. Both write within the caller's transaction, perform no HTTP, and are supplied by P2 against DBA models. Agree concrete PHP DTO/signatures in a contract PR before dependent merges. Use fakes while implementing isolated tests, not a second production implementation.

Coordinate with DBA on event names, minimal recipient references, template keys and payload versions for verification/correction, personnel/facility and security events. P1 owns password-recovery codes, reset authorization and mail delivery; this reassignment does not change recovery into SMS or pass codes through Make. DBA's integration credentials remain server-only. For each event, P1 tests the committed/rolled-back outbox record; DBA tests dispatch and provider handling. P1 owns common backend config/bootstrap and includes DBA's proposed `routes/integrations.php`; DBA owns `config/messaging.php`, SMS jobs and integration services. Coordinate shared queue/scheduler registration through a small P1-reviewed PR.

## Foundation decisions

1. Verify `php -v`, Composer, hosting and actual database engine. Prefer a current supported Laravel/PHP pair; analysis found Laravel 13 requires PHP 8.3+, Laravel 12 supports PHP 8.2. Pin the chosen version and composer.lock together. Do not assume XAMPP's database is MySQL; use actual MySQL/InnoDB for shared CI and concurrency tests.
2. Prefer **same-origin HTTPS** hosting of existing frontend assets and Laravel `/api/v1`; web root must be `backend/public`, never repository root. Alternatively use owned `app`/`api` subdomains under the same domain. Sanctum stateful-cookie authentication requires compatible same-site hosting: do not assume `butvh.github.io` can cookie-authenticate against an unrelated host. Keep Pages as a fictional demo if necessary; never solve this with a long-lived localStorage token or wildcard credentialed CORS.
3. Before backend files are added, replace Pages' existing `upload-pages-artifact path: .` with an allowlisted static staging directory containing intended HTML/assets only. Exclude backend, docs, tests, dotfiles, dumps, uploads, logs and vendor. Scope static scanner rules to frontend paths and add backend checks without weakening frontend rules.
4. API root `/api/v1`; JSON success `{data: DTO}`, list `{data: [...], meta: {...}}`; adapter unwraps to current page-model shapes. Errors `{code,message,fields,request_id}` with safe static messages. Map 401/403/404/409/419/422/429/503 into existing ApiError behavior. Numeric IDs, exact UI statuses and null semantics must remain compatible.
5. Preserve demo mode separately. Backend mode never falls back to localStorage on network/auth failures. Add a hydrated `/me` session bootstrap so existing synchronous `Auth.current()` consumers cannot render privileged content from stale demo identity. P2's adapters depend on your HTTP transport; coordinate shared `core/api.js`, `auth.js`, `config.js` edits in a small reviewed seam PR.

Also change logout call sites to await actual server session invalidation before redirecting; existing shell/profile handlers call synchronous demo logout. Supply server time for consumers of frozen `Store.now()`. Define an authenticated polling replacement for `Api.subscribe(entity, callback)` with an unsubscribe return value, teardown and revocation handling; preserve dirty-form refresh protection. P2 supplies domain refresh sources, rather than adding a second transport or silently retaining localStorage-only updates.

## Required proposed endpoints and behavior

Routes below are contracts to implement, not existing endpoints. Inventory actual facade methods first and record a method-to-endpoint matrix so no page lookup/aggregate is omitted.

| Endpoint | Contract |
| --- | --- |
| `POST /auth/register` | Resident-only account/household registration; validated names/email/contact/address/barangay; ignore no protected field silently—reject role/official injection. |
| `POST /auth/login`, `POST /auth/logout`, `GET /me` | Server session, actual user/effective role/barangay/status; rotate session on login; return no hash/secret. |
| `GET/PATCH /profile`, `GET/PATCH /household` | Own permitted profile/household fields only, preserve existing data and map pins. Official email/role/tenant/status remain protected; read barangay official details without inventing municipality/address/last login. |
| `POST /account/password` | `{current_password,password,password_confirmation}` -> `{password_changed:true}` only after commit; reject wrong current password; rotate/revoke sessions according to documented policy. |
| `POST /password-recovery/requests` | `{email,portal}` -> `{accepted:true,challenge_id,expires_in:600,retry_after:60}`; identical neutral behavior for known/unknown/ineligible addresses. |
| `POST /password-recovery/verifications` | `{challenge_id,code}` -> `{verified:true,reset_authorization,expires_in:600}` only after valid one-use six-digit verification. |
| `POST /password-recovery/resets` | `{reset_authorization,password,password_confirmation}` -> `{password_reset:true}` only after atomic authorized reset; no automatic login. |
| `GET /verifications`, `GET /verifications/{id}` | Resident-owned application views or Captain/Secretary scoped queue/detail; current/latest submission/deadline/reviewer metadata and authorized document links. |
| `POST /verifications`, `POST /verifications/{id}/submissions` | Multipart valid ID/proof uploads; new application where required, existing application resubmission only in allowed states; idempotency and expected revision. |
| `POST /verifications/{id}/decisions` | Approve/Reject/Request resubmission, reason/checklist/submission revision; actor server-derived. |
| `GET /documents/{id}/download` | Authenticated owner/authorized reviewer access; stream private file; no public storage URL. |
| `GET /personnel`, `GET /personnel/{id}`, `GET /tanods` | Captain-only own-barangay directory/capacity/detail/history and fixed pool projections. |
| `POST /personnel/external`, `POST /tanods/{id}/appointments` | Captain-only validated addition/appointment, guarded staffing capacity, effective date, notes, private requirements. Never create/delete a Tanod pool member. |
| `POST /personnel/{id}/reassignments`, `POST /personnel/{id}/removals` | Captain-only revision-guarded role change; retain account/history, return appointed Tanod to pool, external member becomes unassigned. |
| `GET /facilities`, `GET /facilities/{id}` | Role-scoped visible directory, filters and actual map availability; inactive records allowed in authorized history views. |
| `POST /facilities`, `PATCH /facilities/{id}`, `PATCH /facilities/{id}/status`, `PATCH /facilities/{id}/location` | Captain/Secretary of managing barangay only; expected revision; full active/inactive/reactivation/pin workflow; audit. |

Return existing projection fields, not raw models. Common lookups include barangays, current verification, staffing capacities and map-visible facilities; define their routes in your mapping. Do not send only a paginated subset when page code computes full totals—supply aggregate DTOs or adapt pagination explicitly.

## Domain rules that must survive

- Staffing occupied limits: **Secretary3/Responder6/Rescuer6 per barangay**. Current code counts Inactive staff still holding their role. The user's brief says active Secretaries; flag this difference in the PR and preserve current occupied-position behavior until deliberately changed.
- Only Captain changes personnel appointments. Independent resident and Tanod memberships survive operational role changes. Inactive/unassigned staff lose effective official access immediately. Role change is blocked while the old role has active responsibility on an unresolved incident. Coordinate guard locks with P2 to prevent dispatch racing removal.
- Normal dispatch capacity is Responder2/Rescuer1; current frontend also has an explicit audited Captain emergency override. P2 owns that workflow; do not enforce inconsistent staffing/dispatch assumptions in profile/personnel endpoints. Team ratification is required before a live override is enabled.
- Verification states: Pending, Resubmission requested, Approved, Rejected, Expired. Correction reason required; review tied to exact document revision. Pending/correction uploads append a submission to the **same** application, return Pending and establish a fresh seven-day deadline. Awaiting requested correction does not expire automatically. Rejected/Expired require a new application; Approved is final. Only Approved unlocks SOS. Never infer approval from client UI flags.
- Verify ID/proof each JPEG/PNG/PDF, nonempty, max10MiB; private actual bytes and detected type. Personnel requirements max10 supported files, 5MiB each. Stage/quarantine and clean orphaned uploads after failures; no publicly executable files or private-doc symlink.
- Facilities: shared/referral visibility is not write authority. Store definite managing barangay; ordinary newly created facility belongs to actor barangay. Preserve historical rescue destination snapshots across edits/deactivation. Reject inactive destinations for new rescue use; synchronize changes through reads/polling, not browser-only events.
- Map coordinates are paired nullable percentages0–100, including valid0,0; not GPS. Do not label unknown as0 or fabricate other-barangay artwork/routes.

## Security and persistence dependencies

DBA supplies barangays, users, households, Tanod membership, current appointments/history/capacity guards, verifications/submissions/documents, facilities, sessions/cache/jobs and recovery challenges. Use UTC persistence and Asia/Manila deadlines/report boundaries; unknown legacy fields remain null.

Authenticate and authorize every request and private download, with tenant scope in queries. Use FormRequests, field allowlists, parameterized queries, escaped output, safe errors, explicit CORS/CSRF, secure production cookies/HTTPS, APP_DEBUG=false. Passwords:8–128 characters with uppercase/lowercase/digit per current UI policy; no trimming/normalizing/truncation; select a hasher that handles full length. Protect login/recovery endpoints with independent server throttles.

Recovery uses a cryptographic six-digit code with a server-keyed digest, max five failed attempts, ten-minute expiry, minimum60-second resend cooldown and supersession of previous codes. Verification issues a high-entropy short-lived authorization stored only as digest. Atomically consume it with password update; invalidate other reset credentials/sessions, preserve all domain records, send security mail without passwords. Unknown users get an opaque dummy challenge and equivalent timing/rate-limit behavior. Never return codes, reveal account existence, log submitted credentials or claim mail delivery from queue acceptance. This custom UI contract is not Laravel's default reset-link broker protocol.

Use a shared documented lock order with DBA/P2 for personnel capacity/role changes and facility destination races. Revision conflicts return409. Profile/files/recovery/verification changes emit audit/outbox records in the same transaction; queued mail after commit, never provider calls inside the transaction. Keep `.env`, APP_KEY, credentials, private documents/data/dumps/logs outside Git and public artifacts. `.env.example` has placeholders only. No real seed personal data or account passwords from demo.

## Work sequence and acceptance tests

Use small TDD slices: a named failing test, minimal implementation, targeted run, combined run, focused commit/PR. Do not require schema implementation to be duplicated while DBA works—pair on contracts and use their migration slices.

- **Mon2:** foundation + secure Pages artifact + sessions/me + HTTP adapter. Prove frontend login can read real `/me`, demo ID cannot authenticate, root/backend/secret files are absent from public artifact; pair with P2's first SOS slice.
- **Tue3:** verification submission/private download/correction/resubmit; staffing/facility APIs. Prove owner/other-resident/other-barangay/operational-role access denial, stale-decision409, terminal states, correction no-expiry, occupied-slot race and busy-role restrictions.
- **Wed4:** profile/password/recovery and full personnel/facility browser integration. Prove uniform recovery requests, attempts/expiry/supersession, two concurrent reset attempts only one succeeds, role/session revocation, protected-field rejection, file MIME/size limits and inactive historical destination retention.
- **Thu5:** negative tests and cross-domain races; pair with P2 and DBA on role-change-versus-dispatch and deactivate-versus-rescue tests on MySQL. Fix adapters without redesign.
- **Fri6:** full integration/security review, release notes and green PRs; no unfinished privileged feature merge. Report any real mail/hosting dependency unverified.

Run existing `node scripts/check.mjs` and `node scripts/run-tests.mjs`; from proposed backend run `php artisan test` and `vendor/bin/pint --test` (Windows equivalent if needed), Composer validation/audit, and actual-MySQL integration tests. No new frontend runtime dependencies. Test production-mode failure handling and clear separation from demo storage.

## Git and completion

Use short branches `codex/backend-p1-<slice>` from current main. P1 owns shared framework/transport/factory edits; communicate them to P2 and DBA before merging. DBA owns schema/models and SMS/Make delivery services; P2 owns incident/in-app notification services and event writers. Never force-push main or overwrite teammate changes. Each PR supplies contract changes, migration dependencies, policy matrix, test output, browser evidence, limitations and rollback. Rerun checks on integrated merge result, not just your branch. Merge only reviewed required-green work under existing repository rules.

Complete when your domains persist through Laravel/MySQL, original UI/navigation still works, server policies reject forged requests, file/credential handling is private, existing tests pass, integration tests prove the key workflows, and the team has reproducible setup/deployment instructions. Do not call untested mail, auth topology or production privacy controls complete. Deliver your endpoint-to-facade matrix and testing evidence with the PR.
