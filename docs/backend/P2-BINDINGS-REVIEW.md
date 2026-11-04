# P2 binding review and isolated integration refresh — November 3, 2026

November4 current refresh: P2 5f3828566f73c40c9473b6b2276206ae07f17b8c is now pinned with DBA9d6c699. P1 adopts its exact unbound photo policy; the former missing-policy request is obsolete. The new45 SQL cases and retained original browser acceptance must pass on this composition; older41-case results below remain historical. See PHOTO-SMS-HANDOFF.md for the four-required-argument attach revision and concrete consent/worker contracts. Active DBA metadata/model and agreed consent persistence remain external prerequisites.

**November4 superseding evidence:** reviewed P2 acc9f56f37d34c96021c415ab81612bef92dac63 with DBA b9f7a7e106fe7fe699abad1afd900c6141c38756. Required [CI41764879472](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41764879472) on P1 5447d8723c84caf98844df8a4276d3c21c727546 passes183 tests/798 assertions, P2 deterministic SQL/race/form cases and DBA manual review (`late_user_ids=[]`, `lock_order_accepted=true`). The specific historical lock blocker below is resolved at that tested composition. Preserve the regression; this is not universal deadlock/release acceptance. [Original-browser slice](OPERATIONAL-BROWSER.md) is the current next acceptance gate, and [photo/SMS handoff](PHOTO-SMS-HANDOFF.md) records remaining dependencies. The remainder records the November3 review against the older source.

The original-browser slice subsequently passes all10 operational and5 identity scenarios in required [CI41768154719](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41768154719), P1 96632bfe320997b3e239be6dbe9444f7ff18b151; root185/824, no failures/errors/skips. This resolves the named operational-form/browser handoff for that composition. DBA then published9d6c699 with an additional lower-ID transfer test; it is now pinned, with final combined results in PR49. Private bytes/consent, future cross-owner mutation services and production release remain separate.

Reviewed P1 baseline c0a32cfaf4b26b86d57681cd1ed6aa42d6c87bb1, DBA3d2b3a2dd6afa88ea34b9a441f48da3863787bbd and P2 production candidate3d23092883e0f24aa89b4c86ce93862e35880e3e. Main remains3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0. The attached plan(2) is byte-identical to plan(1); immediate scope is the user's P1 integration-refresh assignment, not another member's backlog.

## Actual production-class review

| Selected class under App/Services/P2/Persistence | Reviewed behavior | Remaining acceptance |
| --- | --- | --- |
| RelationalStore | Explicit logical-to-DBA field mappings; parameterized values/field allowlists; one default MySQL transaction; nested work joins; operations/SOS guards, current user/appointment rows then incident/assignment/facility rows. Derived historical assignment pointers are not writable. | **BLOCKED:** late participant row locks from projections and nested transaction planning need correction. Passing existing races is not proof of global lock order. |
| ReferenceData | Captured EffectiveIdentity bound to an Actor clone; current/locked request identity delegates to P1; scoped SourceReferences and selected locked destination; persisted-recipient lookup separate from HTTP current(request). Minimal participant provenance/internal official recipients avoid a public directory. | user() locks additional users/appointments whenever a transaction is open, including during incident projections after higher-ranked rows. P2 must fix the lock plan/read purpose without weakening original-generation/current eligibility checks. |
| TypedAuditRecorder | Implements shared typed port; requires caller transaction, scope/action/summary bounds, paired nullable actor/role and matching server role; writes DBA aliases/structured summary with no network/independent commit. | P2 SQL cases exercise its domain use/rollback. DBA outbox probe does not independently certify every audit/system-actor/security-domain path; those remain source-owner review. |
| TypedOutboxWriter | Implements EventId/DateTimeImmutable/EventContext/RecipientReference port;7 canonical P2 v2 families; source scope/current row, exact feedback snapshot, max1000 distinct active same-scope in-app recipients, server-derived audience/hint agreement; no SMS or nested commit. | P1 event families remain unavailable. Current-read/recipient lock interactions and original domain concurrency remain release gates. |
| InAppHandler | Implements DBA's per-recipient interface, joins receipt transaction, validates committed event/recipient/scope, reauthorizes source/audience, preserves event-time status and deduplicates event/person. No dispatcher/provider duplicate. | Execute DBA's unchanged configured production-adapter probe with these actual classes. No test double may stand in for them. |

This is selective acceptance for isolated tests, **not production enablement**.

## Selection and isolation

backend/config/integration.php retains null active adapters and false flags by default. Its reviewed_test_adapters map names the five real classes. P2_TEST_BINDINGS=true is opt-in and IntegrationServiceProvider accepts it only for:
- testing + DB_TEST_DISPOSABLE=1, matching DB_DATABASE/DB_TEST_DATABASE, allowed disposable bc_dba_p1_*/bc_dba_p2_*/p2_test_* schema and one named/default mysql connection;
- the existing P2 loopback HTTP harness, additionally requiring local + P2_TEST_HTTP=1 and its p2_test_* dataset;
- SMS/Make/automatic dispatch disabled.

The profile selects normal adapter configuration keys/bindings and registers actual P2 services/policy. It does **not** set p2_enabled, wire original forms, register global factories/readers or start workers. The owner HTTP harness deliberately enables its private test routes; it is neither the Laravel production entrypoint nor a public artifact. Production/shared-data selection is rejected.

## Required lock-order blocker

CombinedP2LockOrderTest invokes the actual SOS/assignment services using real reviewed classes. It records FOR UPDATE queries, allows reentrant already-held user locks and fails when a previously unheld participant is acquired after an incident row. Reporter is created before the Captain/operator so descending acquisition is observable.

P2 must preplan the complete ordered guard/current-row set or use appropriately authorized nonlocking projection reads where no mutation authority is required. In particular, an incident projection's ReferenceData.person -> user() must not introduce an unplanned lower-rank lock after incident/assignment/facility locks. Nested Module.once/atomic calls must not acquire a new lower-ranked guard after already-held higher ranks. Request P2's correction and independent-process regressions against opposite ordering/current source changes. P1 has not edited their implementation or marked this gate expected-success.

Original-domain enablement remains blocked until this regression and P2's correction/races pass **and** original-form integration is reviewed.

## Preserved and added CI commands

From the private composed root, install the unchanged backend Composer lock; preserve any developer .env/APP_KEY. SQL requires confirmed disposable genuine MySQL8.4, never a shared/live schema.

```powershell
node scripts/prepare-integration.mjs
# Enter the returned private snapshot; configure the documented disposable DB_* / DB_TEST_* variables.
php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.combined.xml --display-warnings --fail-on-warning
php backend/tests/P2/run.php
node --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs
node scripts/run-tests.mjs
node scripts/check.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
```

P1/DBA root suites, original405 frontend checks, P2 original47+1 portable cases and8+3 adapter checks are retained. Owner sources are exact pinned Git blobs; the allowlist adds only P2-COMPATIBILITY.md, P2-INTEGRATION-MANIFEST.json, the exact November3 P2 plan, and p2-foundation-adapters.mjs. Existing owned backend/adapters paths remain constrained. No owner source is patched.

CI prepares fresh p2_test_integration through P1's guarded prepare-p2-database.php (refuses preexisting targets), migrates only that disposable schema and runs unchanged tests/P2/sql.php. That runner includes sql-cases.php, http-cases.php, sql-races.php and sql-review.php and starts actual loopback HTTP/independent processes. No PowerShell root-password assumptions or shared database migration are used.

DBA's production-adapter CLI runs against the confirmed bc_dba_p1_* composition with per-process P2_TEST_BINDINGS=true and IDENTITY_ENABLED=true, while modules/dispatch/SMS/Make stay false. The normal configured selection resolves the five actual production classes; test doubles are not bound for this acceptance.

All independent gates continue after failures so failures remain visible while preserving source/format/artifact evidence. Exact final P1/merge SHAs, totals/skips and any failing case are in PR49. Genuine MySQL evidence is from CI; no local real-MySQL server is assumed.

## Shared factory/reader/form handoff

P1 retains createP2DomainFactories and Http.request(data)/Http.envelope(metadata). P2's new p2-domains.js supplies createRefreshReaders({http,auth}), producing scoped cancellation-aware readers. For future registration each entity source factory must return that entity's reader from its own {http,auth}; do not pass the whole reader object as a single function or create another fetch/auth stack.

After P2 fixes concurrency and integrates owned forms, a coordinated P1 change can compose the actual factories and readers in domains.js. Until then both exports remain empty. Forms create one createSubmissionIntent per intent, retain key/body/observed revision on retry, complete only after confirmed success and return false from dirty/focus-deferred refresh callbacks. No stale revision replacement, new retry key or demo fallback in backend mode.

P1 asks P2 to provide the corrected commit and original-form five-role evidence. Private photo bytes/metadata/policy and cross-owner mutation races remain separate unfinished work. No deployment, merge, real message, Make activation or production binding is authorized here.
