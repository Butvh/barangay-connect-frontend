# P1 compatibility follow-up — November 3, 2026

This is the P1 implementation/contract handoff for joint review, not unilateral DBA/P2 agreement or a production release. Current owner pins: DBA #48 `f641918d37ff2ecd49cc47b3437bb0e159d6a10a`, P2 #50 `c902d9f7239a8fcefdddf293fbc531876548c10a`, P2 planning base `ef9a57a2ea0feeb99829e7928595cc925c25bcc7`. Exact tested P1/synthetic-merge SHAs and measured totals are recorded in [PR49](https://github.com/Butvh/barangay-connect-frontend/pull/49), with generated source hashes.

## Current acceptance / request matrix

| Boundary | P1 implementation and source authority | Owner action / acceptance |
| --- | --- | --- |
| Identity | Actual DBA User/account_status/memberships/current appointment. Session verifies id, role, scope and captured nonnegative integer auth_version. Current request carries EffectiveIdentity with a private generation; locked(observed) compares that original observation to a current FOR UPDATE user/appointment read. | DBA auth_version migration/cast is **present**, and all six prior positive lifecycle/revocation skips executed successfully in run41604926592. Do not retain the old missing-column blocker. P2 must carry this original observation through Actor/mutation locks, not rebuild it from a fresh user. |
| Scope fixture | CurrentIdentity requires identity_scope as well as identity_role/version. | DBA-owned Integration/P1IdentityModelContractTest currently omits identity_scope before expecting200. Requested actual user's barangay_id in its session fixture; retain the generation mutation. P1 has not weakened middleware or edited that test. |
| PHP interfaces | App/Contracts/Events, **interface version1**: AuditRecorder.record(?int actor, ?string role, int scope, ResourceReference, string action, AuditSummary): void; OutboxWriter.record(EventId, string type, int scope, int resourceId, list<RecipientReference>, DateTimeImmutable, EventContext=empty): void. | P1 accepts these typed candidate boundaries for adapter review. P2 owns the single implementations/adapters; its current Actor/array/string-time signatures do not implement them. DBA v2's string/array signature was a proposal, not an adopted competing interface. Owner ratification remains required. |
| Audit limits | ResourceReference has positive JS-safe numeric ID and an allowlisted resource (canonical incident/personnel_appointment included). AuditSummary permits status/assignment_id/previous_user_id/user_id/reason/revision, rejects unknown fields, reason max1000 characters and encoded object max4096 bytes. | P2 must enforce actor-role-scope authorization, nullable actor+role only for trusted explicit system actions, same-transaction rollback and DBA JSON_STORAGE_SIZE<=4096. No null actor may be supplied by a browser. |
| Persisted envelopes | **Envelope version2**, independently configured from interface version1. Use exact DBA v2 type/resource/template definitions and flat payload; no new v1 emit, aliases, old32hex conversion or dispatch-time type renaming. EventId is new lowercase UUIDv4; time is DateTimeImmutable normalized to UTC. | DBA owns EventContract/registry/storage. P2 writer must validate its one canonical persisted event against that contract and join the same named mysql transaction. Legacy v1 rows remain readable and unchanged. |
| Bounded contexts | EventContext.forEvent(type,payload).payloadFor(type) binds an exact family and freezes only its allowlisted snapshot, max256 JSON bytes. Covers all14 DBA v2 fixture shapes: incident status, verification status, personnel role/status, facility status, security action, feedback kind/status and exact empty families. | Shared executable fixture is tests/Unit/EventV2BoundaryTest using unchanged DBA tests/Fixtures/events-v2.json plus actual EventContract. No arbitrary message/contact/file/code/recipient arrays. P1 family mutations remain disabled until source policies and P2 handler are reviewed. |
| Recipients | RecipientReference(userId,inApp,sms,audience) requires explicit resident/official audience, safe positive ID and at least one channel. toArray gives only user_id/audience/in_app/sms. | P2 chooses eligible same-scope recipients, rejects duplicates, max1000 rows/event and validates channel permissions. Only DBA's two explicitly SMS-authorized types may request SMS; consent/budget/transport remain separate. |
| Transactions / locks | Named mysql connection, default connection must match. Staffing scope when relevant -> sorted operations-person guards -> sorted current user/appointment reads -> sorted incidents/assignments -> selected facilities -> histories/audit/outbox. Recovery adds recovery guard before user/challenge/session rows. | DBA helpers are available. P2 owns SQL Store/repositories and must map keys/current reads. P1 source methods marked locked require the caller's complete ordered guards/rows already held; no independent commit. No production MemoryStore. |
| Household / residency | SourceReferences.household(observed,residentId,locked=false) gives id/barangay_id/address/paired nullable image pins/revision. approved returns actual latest scoped application's Approved status. Own resident or scoped admin; operational other-resident access requires P2 IncidentReferenceAuthorization. | P2 supplies that incident-policy adapter and must hold all affected guards/rows before locked calls. No adapter ->503, not an empty household/false success. A real absent household returns null; an actual absence of approval returns false. |
| Facility references | SourceReferences.facilities(observed) gives the safe own-managed/shared directory, including inactive history. facility(observed,id,locked=true) is the current single-destination read after ordered locks. Includes true manager, visibility, is_active, safe directory/pins/revision; no internal notes. | P2 adapts new rescue validation to the single locked reference. Listing or shared visibility grants no write authority. P1 retains managing-barangay policy for future mutations. |
| People / reports | IdentityReferences.person for self/scoped admins; SourceReferences.people for scoped admins; personnel for Captain; verifications for scoped admins; barangay for own scope. Explicit projections exclude credentials, contacts, private paths/documents, recovery state and security generation. Personnel returns appointment identity/role/status/source/effective date/revision; verification returns status/review/deadline/revision only. | P2 maps existing report DTOs; missing extra authority must be requested. Historical person/worker lookups must not broaden these methods into an unrestricted User directory. |
| Worker recipients | Request actor lookup is distinct from persisted event/recipient source authorization. No actorFor(arbitraryId) worker bypass is supplied. | P2 must implement handle(OutboxEvent,OutboxRecipient): void on DBA's event/receipt transaction and reauthorize exact persisted recipient/source. Revoked access throws InAppRecipientUnavailable; no silent success, inner transaction, second dispatcher or generic raw User exposure. |
| Browser | One web cookie/session/CSRF/current.identity scheme. Http.request unwraps data; Http.envelope retains meta. createP2DomainFactories uses actual createOperations/createCommunications/createReports through createDomainTransport. | P2 must replace auth:sanctum, supply complete Store/reference/typed writers/handler and scoped readers before any binding/global registration. Its current published source remains incompatible. |
| Form handoff | createSubmissionIntent({auth}) owns one in-memory key and immutable body/observed revision per form intent. prepare/retry retains them; changed body/revision/account fails; complete only on confirmed success; discard only after deliberate cancellation/review. | P2/P1 form owners must integrate the helper when their domain is enabled. No auto-generated retry key or silently refreshed revision in the facade; current incomplete forms remain unavailable. |
| Refresh | Existing scoped async({signal}) reader seam; abort on account/scope/role switch, logout, final unsubscribe and teardown; ignore late scoped responses. Handler returning false (dirty/focus guard) or throwing does not consume the revision. | P2 supplies real scoped readers. View callbacks must return false when deferring; preserve focused fields/dirty forms and check supplied signal before late DOM updates. Missing readers throw NOT_AVAILABLE. |
| Private incident photos | [Private-photo contract](PRIVATE-INCIDENT-PHOTOS.md); typed IncidentPhotos stage(EffectiveIdentity,UploadedFile,intentKey), attach(observed,uploadId,incidentId), download(observed,photoId). A staged DTO is not proof of bytes. | DBA photo metadata and P2 source authorization are absent. Upload/download routes deliberately return503 after auth/CSRF; no implementation bound, filename accepted as bytes, public URL or fake successful upload. |
| Registration | IntegrationServiceProvider rejects missing reviewed interfaces/classes/marker/connection. Root config keeps identity/P2/dispatch false, adapters null and global factories/readers empty. | P2 must publish exact implementation classes and SQL/HTTP/race commands. Then a reviewed config-only P1 change can bind complete domains and enable them in test/staging only. A marker/flag alone is insufficient. |

## Current owner requests

**DBA:** fix the scope fixture above; review explicit typed RecipientReference audience and EventContext v2 fixture compatibility; review [photo metadata request](PRIVATE-INCIDENT-PHOTOS.md). auth_version/storage are no longer missing. Keep migrations/models/delivery helpers DBA-owned. No shared migration has been run.

**P2:** publish actual SQL Store and purpose-safe reference adapter (ownership is P2, not DBA), typed single audit/outbox writer adapters, v2 producer calls, per-recipient handler, current.identity routes, original generation propagation, scoped refresh readers and SQL/HTTP/actual-service race commands. Bind P1 IncidentReferenceAuthorization for assigned private references. Adopt shared submission intents in owned forms and fix NotificationController's existing Pint findings. No unpublished local adapters are reproducible dependencies.

**P1:** reference gateways, typed boundaries, transport/form/refresh handoff and root runtime/CI are supplied here. No password/reset/personnel/status/scope mutation services are enabled by this slice; their future implementations must increment auth_version inside the documented guarded transaction and publish audit/outbox through the reviewed P2 writer. A fixture-only guarded increment tests revocation and is not a production security endpoint.

## Reproduce safely from the repository root

Preserve existing .env/APP_KEY. Foundation.md has normal same-origin setup. All SQL tests require a dedicated disposable genuine MySQL8.4 schema named bc_dba_p1_* and matching DB_* / DB_TEST_* settings, DB_TEST_DISPOSABLE=1, P1_COMBINED_TESTS=1 and MYSQL_INTEGRATION=1. Never set them against team/staging/live data.

```powershell
git fetch origin main codex/backend-p1-foundation codex/backend-db-schema-delivery codex/backend-p2-modules
node scripts/check.mjs
node scripts/run-tests.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
Set-Location backend
composer install
composer validate --strict
composer check-platform-reqs
composer audit --locked
php artisan test --compact --display-warnings --fail-on-warning
php vendor/laravel/pint/builds/pint --test
Set-Location ..
$snapshot = node scripts/prepare-integration.mjs | ConvertFrom-Json
Set-Location $snapshot.directory
```

The private snapshot overlays pinned owner Git blobs without edits, verifies every source hash, and records actual P1 SHA/dirty state. Install its backend lock; copy .env.example only if .env is absent. Combined discovery includes Unit, Feature, Database **and Integration**. Run all gates even if one owner gate fails:

```powershell
# From snapshot/backend, after setting the confirmed disposable DB variables:
php vendor/phpunit/phpunit/phpunit -c phpunit.combined.xml --display-warnings --fail-on-warning
php vendor/laravel/pint/builds/pint --test
$env:DBA_TEST_AUTOLOAD = (Resolve-Path vendor/autoload.php).Path
php tests/Compatibility/check-shared-contracts.php
Set-Location ..
php backend/tests/P2/run.php
node --test tests/p2-adapters.mjs
node scripts/run-tests.mjs
node scripts/stage-backend-frontend.mjs
node tests/backend-live.mjs
$browserRuntime = Join-Path ([IO.Path]::GetTempPath()) 'bc-browser-runtime'
New-Item -ItemType Directory -Path $browserRuntime -Force | Out-Null
Copy-Item -LiteralPath 'tests/browser/package.json','tests/browser/package-lock.json' -Destination $browserRuntime
npm ci --prefix $browserRuntime --ignore-scripts
npm audit --prefix $browserRuntime --omit=optional
node (Join-Path $browserRuntime 'node_modules/playwright/cli.js') install chromium
$env:P1_BROWSER_MODULE = Join-Path $browserRuntime 'node_modules/playwright/index.mjs'
node tests/browser/identity.mjs
node scripts/verify-integration.mjs
```

The browser test creates random fictional credentials in that disposable DB and uses the original forms plus real cookies/middleware. It captures identity screenshots at1440/768/390 and checks sign out, stale-tab419/409, generation revocation and private paths. It supplies no demo provider, persists no credentials in artifacts and allows no external browser requests. Dashboard/domain unavailable states are explicit; identity evidence does not establish P2 workflows.

P2 has published no SQL/HTTP/race suite commands at the pinned head; its47-check MemoryStore runner is preserved and is not a replacement. The separate unchanged DBA compatibility gate remains blocking on four P2 signature/fixture mismatches; read-only Pint remains blocking on its owned controller. No gate is suppressed.

No deployment, main/teammate PR merge, shared/live migration, real mail/SMS or Make activation. Roll back P1 code/config only and preserve private bytes/environment/key; any future schema change is a separate DBA review. [Playwright installation/CI guidance](https://playwright.dev/docs/intro) applies only to the locked test-only browser package; no frontend runtime dependency or redesign was added.
