# P2 lock correction and operational forms — November 4, 2026

P2 draft PR #50 remains stacked on planning PR #47. This slice corrects the incident-to-person lock inversion and connects P2's original operational controllers to P1's submission-intent interface. It does not enable production integration or merge any branch.

## Frozen composition

| Source | Exact revision |
| --- | --- |
| P1 #49 | `aec4e78dab6557a41053d5a76c6ee217db73a16e` |
| DBA #48 | `b9f7a7e106fe7fe699abad1afd900c6141c38756` |
| Reviewed P2 starting head | `3d23092883e0f24aa89b4c86ce93862e35880e3e` |
| P2 planning base | `ef9a57a2ea0feeb99829e7928595cc925c25bcc7` |
| Unchanged main | `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0` |

The published PR head identifies this patch. [The manifest](P2-INTEGRATION-MANIFEST.json) records exact owner Git-blob hashes and canonical-LF P2 source hashes, including modified original page controllers. Tests run in a private composition, never by overlaying teammate code into the P2 branch or a live checkout. No owner source, migration, model, transport, Composer lock, bootstrap or CI file is changed.

## Lock correction

Previously, `ReferenceData::person()` changed display/reference reads into user/appointment/Tanod `FOR UPDATE` reads whenever a transaction was open. Assignment could hold the incident and wait for its resident, while the resident's details update held that identity and waited for the incident.

`person()` and household projections now perform authorized, minimal nonlocking reference reads. They do not grant directory access or replace mutation eligibility checks. `EligibilityReferences::eligiblePerson()` requires an active transaction and a person already declared to the same `GuardedStore`; it reads current user, appointment and Tanod state under locks. Current role/account/generation/capacity checks remain. Inactive Tanod membership or account is rejected even after an older repeatable-read snapshot. SOS uses a distinct guarded `sosHousehold()` current read before creating its incident.

Protocol for DBA/P1 coordination:

1. P1 staffing-scope guard when changing staffing positions; no barangay-wide operations guard is added.
2. Operations-person guards for the command's mutable people, sorted by ID; SOS guard when applicable. Assignment declares actor and selected personnel; transfer declares actor, old and new personnel; resolution pre-reads participants and revalidates the submitted revision after taking guards. Response/rescue/details declare their original actor.
3. Current user rows, appointments and Tanod membership rows for those people.
4. Incident/source rows and current assignment rows, then the selected destination facility for rescue. Destination eligibility remains a current P1 locked source read.
5. Source, history, revision, audit, outbox and idempotency writes remain in the caller's transaction and roll back together. Nested `once`/`atomic` calls in these paths reuse the declared actor and add no new person IDs. Future nested commands needing more people must plan them before source locks, rather than using display `person()` for eligibility.

P1 `locked(observed)` still validates the captured security generation. Reentrant reads of already-held people are allowed. Historical names, resident notification references and official audiences do not expand the mutable lock set. The dispatcher obtains recipient identity before source reads and reauthorizes the source; projections introduce no new participant-user locks. No notification-audience or whole-barangay lock is introduced. `ReferenceData` receives the selected scoped `Store` so guard assertions observe the same transaction instance.

The deterministic regression runs actual P2 services in independent PHP processes/MySQL connections, with a barrier immediately after assignment's incident lock. Its external caller already holds its own resident identity. MySQL **1213** was observed before correction; both writes commit exactly once afterward with retries disabled at that outer boundary. Early schedules were rejected because guard-upsert gap locks hid the intended cycle; guard rows are initialized before the valid schedule. Normal guard-upsert contention is retained for DBA coordination. This does not claim every possible deadlock is eliminated.

Assignment, transfer, response, rescue, resolution, feedback and delivery projection paths were inspected. Current-read/capacity/rollback/transfer privacy tests remain intact. Actual P1 staffing mutation versus P2 transfer, and actual P1 facility deactivation versus rescue, still require P1 mutation services; direct fixture updates do not prove those workflows.

## Original operational forms and P1 registration

Existing SOS/details, assignment/transfer/cancellation, response/rescue and explicit-resolution controllers use `assets/js/adapters/p2-form-intent.js`. It injects P1's existing helper and implements neither another transport nor another idempotency mechanism.

P1 must register its helper **before initializing original pages**, in the shared composition entry point:

```js
import { createSubmissionIntent } from './submission-intent.js';
import { configureOperationalSubmissions } from './p2-form-intent.js';
configureOperationalSubmissions({ createSubmissionIntent });
```

Imports assume a registration module beside the adapter modules; adjust in P1's entry point. Use existing `createP2DomainFactories`, shared HTTP and `createRefreshReaders`. P2 does not edit global registration. Missing registration returns `NOT_AVAILABLE` before mutation, with no demo fallback. Missing P1 source-page reference readers remain necessary for full original-browser integration.

- SOS/details/response/rescue retain one P1 key, exact body and original revision across uncertain replies. Editing a failed intent, switching account or supplying another revision cannot silently start a new attempt. Deliberate cancel/reopen starts a new intent.
- Assignment/transfer/cancellation/resolution retain the revision observed at dialog opening. Availability refresh/conflicts cannot replace it. These revision-guarded commands do not invent an extra idempotency-header contract.
- Public details/response/rescue require nonnegative integer `expected_revision`. PATCH details also requires `Idempotency-Key`. Actual details changes advance `assignment_revision`; identical replay adds no audit. Legacy internal callers remain compatible; the public boundary is mandatory.
- Authorization precedes guessed revision comparisons, preventing private-incident revision probing by another resident or unassigned staff.
- P2 `Problem::render()` preserves safe status/code/request-ID envelopes. Real HTTP reproduced a Laravel revision conflict returning500 before this correction; it now returns409 without changing P1's renderer.
- Unknown coordinates remain `null/null`; viewport centering cannot fabricate a pin. Valid0/100 edge pins remain exact; a deliberate map pick supplies coordinates. Backend photo selection remains disabled pending actual private byte storage/attachment; filenames are not uploaded evidence.

Demo design/workflows remain intact. Announcements/feedback publishing and P1 account/administrative forms are not activated by this operational registration request.

## Preserved interfaces

P2 uses P1 captured `EffectiveIdentity`, `SourceReferences`, typed `AuditSummary`, `ResourceReference`, UUIDv4 `EventId`, `EventContext` and `RecipientReference`. All production persistence/writers share the caller's transaction. Seven P2 event families retain event-time status/kind snapshots and bounded fanout. Relational recipients remain **in-app only**. DBA's dispatcher/receipt ledger is the single delivery implementation; no SMS intent, Make activation or photo metadata change occurs here.

Privacy remains scoped: residents see their own private records; staff see current assigned sources; Captain/Secretary are barangay-scoped. Nearby DTOs contain sanitized approximate area/type/pin only. Reports are Captain-only. Unknown history, unavailable sources and unsupported P1 event families are not reconstructed or falsely completed. Prior minor limitation remains: some report display names use the current directory instead of historical name snapshots.

## Verification and limits

Runtime: PHP8.5.12, Laravel13.39.0, Testbench11.3.0, PHPUnit12.5.43, genuine MySQL Community8.4.13/InnoDB, Node24.15.0. Fictional data, fresh isolated loopback targets, normal providers disabled/fake.

- **41 P2 SQL/HTTP/concurrency cases**, plus two nested original-controller workflow branches, pass. Coverage includes deterministic lock order, current eligibility/generation/destination, capacity, transfer privacy, rollback, idempotency, stale details, unauthorized revision guesses and inactive Tanod.
- Original controllers execute both branches over real P1 cookie/CSRF HTTP and MySQL: SOS → manual responder → current assessment → rescue/no-rescue → explicit official resolution. Dropped replies replay one command; stale writes fail; unrelated recipients cannot read the incident. DOM/navigation and missing P1 reference-page reads are explicit boundaries: **not fully registered browser E2E release acceptance**.
- All405 original frontend checks,48 portable P2 contract checks,19 Node entries for adapters/intents/original controllers,8 actual P2 factory/shared-HTTP checks and16 shared transport checks pass. Script entries additionally assert their individual controller scenarios.
- All unchanged P1/DBA Unit/Feature/Database/Integration/Compatibility suites pass: **181 tests /795 assertions /0 errors /0 failures /0 skips**, including P1's required actual-service lock-order gate. DBA's unchanged manual order review also passes: no late user locks, both response/details workers committed, one response row, victim_count0, deadlock counter unchanged during its isolated run.
- DBA's actual configured production `TypedOutboxWriter`/`InAppHandler` SQL probe passes: caller rollback, event-time in-app delivery, independent receipt replay, revocation, cross-scope/malformed typed contracts, provider calls0. SMS intent is explicitly not requested.
- Read-only Pint passes all214 published-owner/P2 PHP files; Composer strict validation, platform requirements and locked audit pass; frontend/backend artifact isolation and staged module-graph checks pass; the P2 static scanner passes471 files. Exact hashes preserve127 P1 files,116 DBA files and75 P2 source files. No private scratch harness is part of that source set.
- Setup failures were corrected and rerun without weakening tests: P1's new disposable confirmation was supplied by P2's runner; MYSQL_TEST_BIN was corrected to the binary directory; artifact tests ran outside the filesystem sandbox after Node realpath was denied. Earlier failed setup runs are not passing acceptance.

Before production, P1 reviews/selects this published candidate, updates owner pins/allowlists, supplies shared registration/readers/private byte services, and completes original-browser five-role/cross-owner races. DBA independently reviews the protocol and reruns its gate. Release/scale/query-plan, worker/scheduler and deployment evidence remain separate. Incomplete factories/readers and production flags stay disabled.

## Reproduction

Compose exact owner revisions unchanged with this P2 head; install P1's lock. Add DBA Database/Integration/Compatibility directories to a private PHPUnit configuration without altering owner suites. Confirm a fresh `bc_dba_p1_*` database and matching `DB_TEST_*`/`DB_*`, `P1_COMBINED_TESTS=1`, `DB_TEST_DISPOSABLE=1`, private `APP_BASE_PATH`, and `MYSQL_TEST_BIN` pointing to the MySQL **binary directory**. Run all Unit/Feature/Database/Integration/Compatibility tests, including `CombinedP2LockOrderTest`; never suppress it.

From composition root:

```sh
php backend/tests/P2/run.php
node --experimental-vm-modules --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs tests/p2-form-intents.mjs tests/p2-report-forms.mjs tests/p2-official-forms.mjs tests/p2-location-forms.mjs
node tests/domain-transport.mjs
node tests/backend-transport.mjs
node scripts/run-tests.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
./backend/tests/P2/run-sql.ps1 -Php <php> -Mysql <mysql-client> -Port <isolated-port>
```

The SQL runner creates fresh `p2_test_*` and sets current P1's disposable confirmation. Only unchanged DBA migrations are applied there. The HTTP router requires the guarded loopback test context and is excluded from artifacts. Run DBA's unchanged `tests/Review/p2-lock-order.php` separately on a confirmed disposable `p2_test_*` database. For its production-adapter probe, use a separate fresh `bc_dba_p2_*` schema and `tests/P2/check-shared.php`: this test-only boot/binding wrapper invokes DBA's probe, not another checker/dispatcher.
