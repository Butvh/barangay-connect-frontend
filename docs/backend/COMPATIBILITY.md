# P1 compatibility slice — November 3, 2026

This is a **candidate canonical v1 boundary awaiting DBA/P2 acceptance**, not a declaration that the three drafts agree. No PR is merged, no shared database is migrated, and identity/P2/dispatch remain disabled. P1 changes only its foundation, contracts, transport, registration and tests.

Reproducible owner baselines are in `integration-lock.json`: P1 review baseline `7dcf8447bbfc594d0cf42b7a1710f62a7856436c`, DBA `32ff81f4cb1c7e2f704dc5f93168f1261787e376`, P2 `c902d9f7239a8fcefdddf293fbc531876548c10a` on planning base `ef9a57a2ea0feeb99829e7928595cc925c25bcc7`. The generated snapshot manifest additionally records the **actual tested P1 commit**, dirty state and SHA256 of each untouched owner file. A dirty snapshot is development evidence only; CI tests the committed revision.

## Compatibility matrix

“Candidate” below means implemented/defined by P1, but owner acceptance or implementation is still required. None of these rows authorizes enabling a flag.

| Boundary / version | Candidate canonical interface and conversion | Implementing owner / current mismatch | Acceptance evidence or gate |
| --- | --- | --- | --- |
| Audit v1 | `Contracts/Events/AuditRecorder.record(?int actor, ?string roleAtAction, int scope, ResourceReference resource, string action, AuditSummary summary): void` | P2 owns the single writer/adapter. Its current Actor/array/array signature must map through this boundary, not become a second writer. Actor and role are both null only for an explicitly authorized system action; otherwise resolve current actor/scope under the mutation guards. | P1 DTO/allowlist/size tests pass. P2 must prove actor-role-scope validation, null-system expiry, same-transaction commit/rollback and DBA JSON_STORAGE_SIZE <=4096. |
| Audit resource/summary v1 | Resource has allowlisted type + positive numeric ID. Summary is a structured JSON object, not free-form text; keys status/assignment_id/previous_user_id/user_id/reason/revision only, bounded values and encoded size <=4096 bytes. | P1 owns DTO contract; P2 writes DBA activity_logs aliases (`role_at_action`, `occurred_at`, `recorded_at`). Reject unknown credential/private-document fields; do not silently drop them. | `EventBoundaryTest`; real writer/DB edge and rollback tests pending P2 adapter. |
| Event identity/time v1 | `EventId` is canonical lowercase UUIDv4; `DateTimeImmutable` is normalized to UTC by the adapter (`Y-m-d\TH:i:s.u\Z`). | P1 owns value types; P2 changes new-event generator and typed adapter. DBA UUID storage already matches. Current P2 random32hex/string-time protocol is incompatible. **Do not rewrite existing IDs or silently add dashes.** | UUID generation/legacy-ID rejection tests pass; P2 needs replay/deduplication tests on the canonical format. |
| Outbox v1 | `Contracts/Events/OutboxWriter.record(EventId, string type, int scope, int resourceId, list<RecipientReference>, DateTimeImmutable, EventContext = empty): void` | P2 supplies the one writer; DBA owns persisted envelope/dispatcher. `RecipientReference(userId,inApp=true,sms=false)` maps to outbox_recipients.recipient_id/in_app/sms. Audience is reauthorized from the current recipient/source, not used as client authority. | P1 channel/type tests pass. P2/DBA must prove recipient scoping, rollback and independent channel receipts. SMS intent is never consent/budget authorization. |
| Event names/context v1 | Initial mapping: P2 incident.created -> DBA alert.created.v1; P2 announcement.published -> DBA announcement.published.v1. Other event types need explicit versioned definitions. EventContext freezes only nullable incident status. | DBA currently permits only two types and an empty payload; P2 emits more types, recipients inside payload, and status context. DBA/P2 must agree the context representation and registry before binding. Never discard status context or substitute a later live status. | **Blocked:** type/context/storage adapter and per-recipient notification handler are not supplied. P1 verification/personnel/facility/security events remain disabled; no SMS expansion implied. |
| Transaction connection v1 | One named `mysql` connection, same Connection instance/transaction for Store, current references, audit and outbox. Writers require transactionLevel>0, never open/commit independent work or call HTTP. | DBA owns physical models/guard helpers; P2 owns logical domain/writer mapping. The production Store mapping owner must be explicitly confirmed: P2 handoff currently assigns that adapter to DBA. P1 implements no competing Store. | P1 preflight rejects a different default/driver; locked identity refuses reads without a caller transaction. Combined domain/adapter transaction and races remain blocked. |
| Identity v1 | Laravel `web` session guard; `current.identity` verifies active account, appointment-derived role, nonnegative integer generation and stored role/scope/version. | P1 implemented. DBA still needs additive users.auth_version and integer cast. Resident/Captain memberships and Tanod pool are independent; no duplicate operational role columns. | P1 tenant/invalid-generation/account/role regressions pass. Current real DBA model correctly denies login without the generation; positive real-model lifecycle/revocation tests explicitly skip. |
| Reference v1 | `IdentityReferences.current(Request)` returns only id/barangayId/role, with private generation. `locked(observed)` performs fresh scoped user/appointment locking reads on the named connection after caller guards. `person(actor,id)` gives administrative same-barangay or self-only minimal name/status/role flags. | P1 boundary implemented; P2 supplies its ReferenceData adapter and Actor conversion. Its unqualified actorFor(id), used for both requests and worker recipients, must be split by trusted purpose. Worker recipient resolution must start from a persisted, scoped recipient/source, never arbitrary browser IDs. | Request-body identity rejection, private-generation serialization and transaction precondition tests pass. P1 household/approval/facility/verification/personnel report projections are still explicitly unavailable pending their domain services. |
| Browser middleware v1 | Browser fragments load once under `/api/v1` with `web` + `current.identity`; errors use `{code,message,fields,request_id}`. DBA integrations stay in separate stateless `api` group with their own credentials. | P1 loader uses actual `operations.php`, `communications.php`, `reports.php`. P2 must replace auth:sanctum with current.identity (or rely on P1 parent group), not request a new auth scheme. No Sanctum package/guard/CSRF exemption added. | 401/419/503 and disabled-route tests; enabled flag alone cannot bypass missing owner bindings. |
| Browser transport v1 | `Http.request` unwraps data; `Http.envelope` retains meta. Inject `createDomainTransport(Http)` into P2's existing `{request}` factory argument. One leading slash/query string is safely normalized; no external/root-prefixed/traversal paths. | P1 implemented bridge. P2's existing createOperations/createCommunications/createReports work through it without edits. Headers allow only intent/concurrency metadata; cookies/CSRF stay transport-owned. | Eight actual P2 factory checks run through the real shared HTTP implementation, including complete-list rejection, URL encoding, stable keys and stale-revision no-write. Live Laravel probes test their actual request/error path. |
| Submit/cross-tab v1 | Keep caller's Idempotency-Key, observed revision and recipient/role checks unchanged. Transport generates no retry key or refreshed form revision. `X-BC-Identity` is an internal write precondition against the cookie's actual actor/scope/role; it grants no authority. | P1 preserves/validates metadata and captures context before CSRF waits. P2/P1 form owners must supply intent once per submit and retain it on retries before global registration. Cookies are shared across tabs; a changed account clears the old workspace. | Stable-intent and stale-transfer checks plus stale-tab conflict regression pass. Independent authenticated accounts per tab are **not** supported; real authenticated two-tab walk remains blocked by DBA generation. |
| Factory/polling v1 | `createP2DomainFactories({createOperations,createCommunications,createReports})` maps actual groups, including map and extra report methods. P2 readers: `createRefreshReaders({http,auth}) -> {entity: async({signal}) => scopedRevision}`; primitive string/finite number revision only. | P1 composition exists but `domains.js` stays empty. P2 has supplied no refresh readers yet. Missing readers throw NOT_AVAILABLE. P1 heartbeat, unsubscribe, revocation, hidden-document handling, dirty-form protection and bfcache teardown remain shared. | Missing-reader and lifecycle tests pass. **Global registration is blocked** until owners supply readers, form handoff and server ports. |
| Runtime/test registration v1 | Root Composer pins DBA's Testbench11.3.0 without replacing its harness. Private combined config preserves P1 Unit/Feature and adds DBA Database discovery; P2's separate47-check and8-adapter suites remain unchanged. | P1 implemented snapshot/CI registration. Owner source hashes are preserved; no source patch or alternate schema is used to pass a test. | Combined MySQL8.4/InnoDB job records actual totals/skips. Store/domain races and workers are not implied by separate legacy suites. |

## Exact owner requests before enablement

### DBA

1. Add an **additive** migration for `users.auth_version` as a nonnegative integer default0 and a User integer cast. Keep it protected from public input/DTOs. Do not rewrite a shared/applied migration.
2. Review generation increments with P1/P2: password change/reset, role reassignment/removal, appointment/account status changes and tenant changes must invalidate prior sessions. Increment in the same transaction under the shared operations-person guards and locked user; role/scope/status are independently compared as defense in depth. Role changes preserve resident/Tanod membership. Tenant changes must respect all scoped FKs, not just change a user ID field.
3. Confirm physical Store/lock mapping ownership with P2. Current keys `person:{id}` map to the same sorted operations CapacityGuard rows used by P1 staffing, before incident/assignment then facility locks. Verification/SOS keep their distinct guard kinds. Finalize recovery challenge/user/session ordering before that P1 slice; no provider call inside a retryable transaction.
4. Extend or explicitly reject each new versioned event definition and frozen status context; keep recipient rows/channel receipts. Approve P2's real per-recipient handler adapter to `InAppNotificationHandler.handle(OutboxEvent,OutboxRecipient)` within the receipt transaction. No arbitrary payload, recipient, template or SMS expansion.

### P2

1. Replace auth:sanctum in the three route fragments with current.identity/P1 parent middleware; use the web guard's current authenticated account. Global P1 handles auth/CSRF/throttle/unexpected errors; P2Errors can continue handling trusted domain Problems, with safe copy and one consistent request ID.
2. Implement adapters for the candidate typed audit/outbox contracts and DBA physical fields; retain one writer per concern. Add `P2ServiceProvider::P1_CONTRACT_VERSION=1` only **after** implementing/reviewing the contract, not as a bypass. Supply the production Store and purpose-safe ReferenceData adapter with the agreed owner; confirm all use the named connection.
3. Separate request actor lookup/current locked actor from committed-recipient lookup. Use P1's current/locked boundary for the first two. Request explicit authorized household/verification/facility/personnel projections where still missing; never use an unscoped raw User array or a fabricated empty success.
4. Adapt notification dispatch to DBA's persisted event/one-recipient signature and receipt transaction, including frozen event status, deduplication and access revocation. Current handle(array) fanout protocol is not a compatible binding. Keep P1 event source templates unavailable until reviewed.
5. Supply scoped refresh readers, coordinated submit-intent/revision handoff, and accept the existing shared envelope injection. No second fetch transport, silent revision refresh, new retry key, browser credential storage, or partial-list totals.
6. Correct the existing Pint findings in `app/Http/Controllers/P2/NotificationController.php`: unary_operator_spaces, statement_indentation and not_operator_with_successor_space. The combined read-only format gate reports this; P1 has preserved your source rather than auto-formatting it.

P1's `IntegrationServiceProvider` leaves all gates false and bindings null. After compatible owner implementations arrive, a reviewed P1 config change supplies Store/reference/audit/outbox/notification adapter classes, registers the actual provider/routes, and enables dispatch only with a database queue and real handler. DispatchOutbox is configured for messaging-control every minute **only behind that gate**. `retry_after=180` exceeds its60-second timeout and the30-second delivery workers. No worker/scheduler/provider send has been run or claimed by this slice.

## Reproduce without merging

Normal foundation setup remains in `FOUNDATION.md`; preserve existing `.env`/APP_KEY. From your clone:

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
vendor/bin/pint --test
Set-Location ..
$snapshot = node scripts/prepare-integration.mjs | ConvertFrom-Json
Set-Location $snapshot.directory
```

The snapshot is a private generated copy, **not a Git merge/worktree**. It refuses owned path collisions and excludes ignored private configuration/vendor/storage. Install its root backend Composer lock after copying `.env.example` only if `.env` is absent. No developer APP_KEY is copied into it. From the snapshot, P2's unchanged independent checks and the new real transport checks are:

```powershell
php backend/tests/P2/run.php
node --experimental-default-type=module --test tests/p2-adapters.mjs
node --experimental-default-type=module tests/domain-transport.mjs
node scripts/stage-backend-frontend.mjs
node --experimental-default-type=module tests/backend-live.mjs
```

For the combined SQL suite, first provision a **dedicated disposable MySQL8.4 database named bc_dba_p1_...**, never shared/staging/production. Configure DB_* and matching DB_TEST_* variables, DB_TEST_DISPOSABLE=1, MYSQL_INTEGRATION=1, P1_COMBINED_TESTS=1 and genuine MySQL client paths for MYSQL_TEST_BIN. The tests apply the unchanged DBA migrations and truncate/drop only this confirmed disposable test database. Do not set these flags against existing team data. Then run from snapshot/backend:

```powershell
php vendor/phpunit/phpunit/phpunit -c phpunit.combined.xml --display-warnings --fail-on-warning
vendor/bin/pint --test
```

Shared CI supplies that disposable server and records source manifest/test output. Positive real DBA-model login/me/logout and five revocation cases explicitly skip until the DBA generation column **and cast** exist; no fake production provider or extra test-only migration is substituted. Anonymous real-cookie continuity, CSRF419,401, disabled503 and public-root exclusions are separately testable now. MySQL engine/DBA guard tests do not prove P2's unimplemented Store/domain races or real worker delivery.

References: Laravel's [session authentication](https://github.com/laravel/docs/blob/13.x/authentication.md), [web middleware/routing](https://laravel.com/framework/docs/13.x/routing), and [queued scheduler jobs](https://laravel.com/framework/docs/13.x/scheduling). The reviewed sequence remains47 ->49 ->48 ->50, conditional on contracts and combined acceptance, not merely PR numbers.
