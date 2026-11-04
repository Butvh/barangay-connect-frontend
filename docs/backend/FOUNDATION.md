# Backend foundation — P1 / DBA / P2 review

Status: P1 compatibility follow-up, November 3, 2026. **Not a completed backend release.**

November3 update: [compatibility matrix and exact owner requests](COMPATIBILITY.md) supersede the initial interface proposals below. It pins all three actual branches and documents candidate typed contracts, safe registration gates and reproducible combined tests. Joint acceptance remains pending; no live feature is enabled.

The current reviewed heads are DBA `b9f7a7e` and P2 `acc9f56`. Their exact source is overlaid only in private combined tests. P2 supplies five production adapters, its lock correction and original-controller intent integration. [Required November4 CI](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41764879472) clears the specific historical lock-order blocker. [The original-browser slice](OPERATIONAL-BROWSER.md) prepares disposable-only shared registration and minimal P1 source reads; final DOM acceptance is recorded in PR49. Production stays off. P1 creates no owner models/migrations, delivery transport or competing business writer.

## Runtime and safe local setup

- Verified locally: PHP 8.5.12 with Argon2id, PDO MySQL, fileinfo and mbstring; Composer 2.11.1; Node 22.14.0. Laravel framework is locked to 13.39.0 in `backend/composer.lock`. The PHP constraint deliberately selects the verified 8.5 line. Teammates must confirm a compatible runtime before merging.
- The installed database **client** reports MariaDB 10.11.16. Nothing accepts a connection on local port 3306. This does not establish a MySQL server. CI uses MySQL 8.4/InnoDB. No SQLite substitution or domain concurrency claim is made.
- Keep the frontend as native HTML/CSS/JavaScript. No frontend framework or runtime package was added.

From the repository root in normal PowerShell, with PHP, Composer and Node on PATH:

```powershell
Set-Location backend
$firstBackendSetup = -not (Test-Path -LiteralPath .env)
if ($firstBackendSetup) { Copy-Item -LiteralPath .env.example -Destination .env }
composer install
if ($LASTEXITCODE -ne 0) { throw 'Composer install failed.' }
if ($firstBackendSetup) { php artisan key:generate }
Set-Location ..
node scripts/stage-backend-frontend.mjs
Set-Location backend
php artisan serve --host=127.0.0.1 --port=8000
```

Create `.env` before Composer's application discovery so the local environment is explicit. Preserve an existing key/configuration; if an interrupted first setup left APP_KEY empty, generate it once before serving. Do not use the repository root as a web-server document root. The local entry is `http://127.0.0.1:8000/frontend/login.html`; `/` redirects there. Apache/Nginx must also serve only `backend/public`. No production host, URL, mail provider, or cloud resources were configured.

`IDENTITY_ENABLED=false` is intentional. `/api/v1/auth/csrf` works, guest `/me` returns 401, and a valid-shaped login returns 503 until the DBA identity slice passes integration review. This is a clear dependency failure, not a demo login. Domain facade methods return `NOT_AVAILABLE` until their owners install reviewed adapters. Do not enable identity merely to hide that message.

File sessions/cache are private local-development defaults so the scaffold can boot without DBA tables. Database sessions/cache/queue configuration must be reviewed with their schema before shared integration. Recovery mail, queue jobs and schedules are not implemented here. Queue connections are configured to dispatch after commit; the database queue still needs DBA tables and a supervised worker.

## Same-origin session contract

Implemented routes, all under Laravel's **web/session/request-forgery** middleware:

| Route | Result / protection |
| --- | --- |
| `GET /api/v1/auth/csrf` | `{data:{csrf_token},meta:{server_time}}`; private/no-store; throttled. |
| `POST /api/v1/auth/login` | Only email/password; email normalized, password bytes unchanged; Laravel guard, no remember-me; session ID/token rotation; safe user Resource; IP + account throttles. Disabled until DBA integration. |
| `GET /api/v1/me` | Hydrated safe user DTO plus UTC server time. Reread identity through the guard; compare effective role and `auth_version` against the session. |
| `POST /api/v1/auth/logout` | Invalidate session and rotate CSRF; `{data:{signed_out:true}}` only on completion. |

Success is `{data:DTO,meta?:{server_time,...}}`. Errors are `{code,message,fields,request_id}` with static copy and generated request IDs. Validation values, SQL errors, paths, password hashes and exception traces never enter error JSON. Standard status mapping is 401 AUTH, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 419 CSRF, 422 VALIDATION, 429 RATE_LIMIT, 503 NOT_AVAILABLE. Domain codes may specialize 409/422/429 after agreement. Private API responses are not cached. The `fields` object contains safe generic field copy.

Same origin needs Laravel's session guard, not browser bearer tokens or cross-site cookie workarounds. There is no credentialed CORS allowlist because no cross-origin browser API is enabled. `web.php` mounts browser `routes/api.php` at `/api/v1`, keeping sessions/CSRF on identity and future P1/P2 browser routes. Separately, bootstrap mounts DBA's `routes/integrations.php`, when present, in a stateless `api` group at the same prefix. Its server-to-server bearer/credential authorization stays DBA-owned, as proposed in PR48. No broad CSRF exemption is added, and the callback must pass combined security tests before enabling it.

Production boot rejects debug enabled, HTTP app URLs, non-secure/non-HttpOnly cookies, or a cookie SameSite value other than Lax. This is a configuration check, not evidence that a production deployment has passed its security review. Configure HTTPS/proxies, DB/session storage, private durable files, mail, workers, backups and monitoring before live use.

## Browser seam

- `assets/js/core/runtime-config.js` is **demo** in the source/Pages artifact. Only `stage-backend-frontend.mjs` writes **backend** into its generated copy under `backend/public/frontend`.
- Backend mode awaits `/me` at module initialization before synchronous page guards. It never reads demo localStorage/sessionStorage, imports the seed, or constructs the demo API singleton. Unknown runtime modes throw.
- `Http.request(path, options)` returns `data`; `Http.envelope(...)` preserves `meta` for pagination/aggregates. Paths are relative API segments, query values use `URLSearchParams`, and requests use same-origin credentials. Writes get CSRF first. There are no automatic write retries or demo fallbacks.
- 401 clears the hydrated identity and hides the protected app before sign-in navigation. Temporary polling outages preserve the displayed identity/dirty form, expose an unavailable error to guards, and do not manufacture successful writes. Server policy remains authoritative.
- `Store.now()` in backend mode advances from server UTC time using elapsed monotonic time. It never uses the frozen October demo epoch; if no server time is available it fails explicitly.
- `assets/js/adapters/domains.js` is the small **shared review seam**. Owners add `domainFactories[group]({http,auth})` and scoped `refreshSources[entity]({http,auth})` factories there. Existing facade methods stay asynchronous. Missing methods reject, never return empty fabricated data.
- Refresh source readers receive `{signal}` and return a stable string/number revision for the **authorized projection**. The first poll establishes a baseline; later changes emit `{entity,revision}`. Polling checks `/me`, avoids hidden documents/overlapping requests, returns unsubscribe functions, and tears down on pagehide. Page controllers retain existing dirty-form checks; P2 owns its refresh endpoints/readers.
- Sign-out handlers await server invalidation. Failure stays on the page with retry copy. Browser sessions are shared across tabs on the same origin, unlike the fictional demo's per-tab role IDs. Do not claim simultaneous real multi-account tabs are supported.

The generated frontend is still an **integration build**, not an approved production bundle. It excludes the seed and hides demo controls, but some unreachable demo helper source still contains fictional demo literals. Remove those helper branches from the release artifact in a reviewed production-build slice; they never authenticate a server account. There is no real credential or real personal record in source.

## Ownership and first dependency PRs

| Owner | Paths / responsibilities |
| --- | --- |
| P1 | `backend` scaffold/config/bootstrap; identity/verification/personnel/facilities controllers, requests, policies, resources, services; identity/civic adapters; safe artifact scripts; common transport/auth/factory seam. |
| DBA | `backend/database/**`, `backend/app/Models/**`, relationships/casts/seeders/common factories; session/cache/queue/recovery schema; messaging config, SMS/Make/delivery/integration services and routes. These paths are intentionally absent in this slice. |
| P2 | Incidents/manual dispatch/response/rescue, civic content/feedback/in-app notifications/reports, transactional audit/outbox writer implementations, and their domain refresh endpoints/adapters. None implemented by P1 here. |

1. Review this foundation and `API-MATRIX.md` together **before dependent merges**. The PHP interfaces under `app/Contracts/Events` are proposals, not a unilateral contract freeze.
2. DBA's first PR supplies an Authenticatable User and core identity/schema slice; P1 reviews model/cast/session compatibility and integrates it on a separate branch. Do not copy the demo's plaintext passwords into MySQL.
3. P2's first small PR binds the agreed `AuditRecorder` and `OutboxWriter` contracts, using DBA models, with transaction rollback tests. Domain writes must remain disabled until those bindings exist; no P1 alternative writer.
4. P1 implements persistent identity/registration/profile/recovery, verification, personnel and facilities against those reviewed models. P2 implements incidents against the same transport/identity boundary. Use reviewed short PRs, then integrate on main with all checks green.

### DBA identity contract — migration present, enablement reviewed separately

`App\Models\User` implements Laravel `Authenticatable`, uses a full-length Argon2id hash and the standard guard contract. P1 now matches PR48's relational design: only `is_captain` and `is_resident` are stored booleans; Secretary/Responder/Rescuer flags and personnel status are derived from the scoped `appointment` relationship; Tanod membership is derived from `tanodMembership`. `account_status` must be Active even for a resident or Captain. No duplicate operational role columns are requested. Needed scalar fields include integer `id`/`barangay_id`, nullable integer `household_id`, name/email/contact and nullable genuine `created_at`. Laravel remember-token behavior must be supported even though remember-me login is disabled. Never return hashes/tokens or raw models.

**DBA implementation present:** the pinned PR48 contains additive users.auth_version with a nonnegative integer cast/default0. All six earlier positive real-model identity/revocation skips execute against it. P1 keeps missing/invalid generations denying access and creates no model/migration. Production identity remains disabled pending the reviewed environment/integration gates, not a missing-column claim.

Every request loads current DB identity. Inactive/Unassigned staff fall back only to an independent resident membership; no remaining effective role is denied. A changed role or security version invalidates the existing portal session. Increment `auth_version` for password/recovery reset, role/scope/status revocation, and other security resets. Agree atomic locking around concurrent login/password/role changes. A scope must be an actual positive barangay ID, never a cast-from-null zero.

DBA also supplies households/map percentages, unique normalized email, private document metadata/submissions, immutable appointment/facility history, staffing guards and recovery-challenge storage. Confirm exact model names/relationships in their PR before P1 writes ORM queries. P1 creates no competing schema or model.

### P2 event contract request

The candidate signatures now use `AuditSummary`, UUIDv4 `EventId`, `DateTimeImmutable` and a bounded historical `EventContext`; see `COMPATIBILITY.md` and `app/Contracts/Events`. `scope` is the barangay ID; actor/role come from the server; nullable actors are only explicit system actions. `ResourceReference` contains type/id. `RecipientReference(userId,inApp=true,sms=false,audience=null)` maps to PR48's recipient/channel rows; P2 derives and persists the intended audience from authorized source and validates any optional server intent hint, with no phone/email/credential/document payload. P2's current array/32hex/string-time writers are not yet compatible bindings.

Both implementations must use the caller's transaction/connection, perform no HTTP, create no independently committed side write, and leave dispatch to DBA. Persist a unique event ID/deduplication key. Resources are reread/authorized by consumers; no client-controlled URL, recipient or arbitrary template. Type names and versioned templates still require all three reviewers' agreement.

Proposed P1 event families: resident registered; profile/household updated; verification submitted/resubmitted/Approved/Rejected/Resubmission requested/Expired; personnel added/appointed/reassigned/removed; facility created/edited/deactivated/reactivated/pin changed; password changed/reset. PR48 now defines all14 explicit v2 envelope families and preserves legacy v1 rows. PHP interface version1 is distinct from persisted envelope version2. P1 typed contexts match the unchanged DBA fixture; actual producer, recipient/source-policy and one-recipient handler adoption remains P2-owned and unbound.

### Lock protocol to ratify before domain merges

Align with PR48's proposed helpers: staffing first takes `CapacityGuard::lockScope('barangay', id, 'staffing')`, then `lockPeople` operations guards in ascending user-ID order, then incidents/assignments in ascending incident-ID order, then facilities, then history/audit/outbox inserts. Dispatch and role removal use the **same operations person guards**. Verification uses its separate verification guard before application/submission rows; SOS uses its SOS guard. Facility deactivation locks the facility and never subsequently acquires person/incident guards, while rescue use locks it after those guards. Recovery challenge/user/session lock ordering still needs joint review. Recheck expected revision after locks; stale writes return409 with rollback. Do not introduce a contradictory order. P1's domain races have not been tested against the DBA branch.

PR48's test harness pins Testbench11.3.0 separately. Before integrating that PR, review the root test dependency and suite configuration with DBA: the current foundation deliberately does not claim to run the DBA's `tests/Database` races or import its harness. Run their full MySQL suite and P1's actual session/schema tests together on the reviewed combined revision; a green standalone foundation job is insufficient.

Preserve occupied Secretary3/Responder6/Rescuer6 positions, including inactive incumbents. The brief's “active Secretaries” discrepancy remains for team decision; this slice changes no rule. Normal dispatch is Responder2/Rescuer1; P2's audited Captain override needs team ratification before live enabling.

## Validation, evidence, and remaining acceptance

Run from root:

```powershell
node scripts/check.mjs
node scripts/run-tests.mjs
node tests/frontend-artifact.mjs
node --experimental-default-type=module tests/backend-artifact.mjs
```

From `backend`:

```powershell
composer validate --strict
composer install
composer check-platform-reqs
composer audit --locked
php artisan test --compact
vendor/bin/pint --test
```

Windows can use `php vendor/laravel/pint/builds/pint --test`. Use PHP's normal Windows permissions if a sandbox falsely reports directories as unwritable; do not edit framework checks or weaken directory ACLs. Composer's optimized classmap scan stalled in this environment; ordinary PSR-4 autoload is used locally. Optimize autoload during deployment after validating that host.

The session feature tests use a **test-only user provider**, not an alternate database or a production model. They cover guard login, `/me`, logout, CSRF, revocation, allowlisted DTOs, throttles, malformed fields and safe errors. MySQL engine verification is explicitly skipped locally unless `MYSQL_INTEGRATION=1`; CI requires it with MySQL 8.4. It proves the engine, **not** persistence/races. The artifact/module-graph test proves hydration before guards, disabled browser storage, no seed, and server time.

Still unverified/unimplemented: DBA schema/model integration; durable registration/profile/password/recovery; private upload/download authorization and orphan cleanup; verification/correction state transitions; personnel/facility policies and race locks; P2 domains/event writers/polling sources; real mail/SMS/Make/queue delivery; reviewed production hosting and security controls. No Monday dependency check is a substitute for those release gates.

Rollback: revert the foundation PR without migrating any data (no migrations in this slice). Remove only generated `backend/public/frontend`/`.frontend-dist` if needed. Never delete DBA records/private files or rotate an existing APP_KEY as a rollback shortcut.
