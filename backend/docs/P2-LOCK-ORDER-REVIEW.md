# P2 transaction protocol — independent DBA acceptance, November 4, 2026

**DBA accepts the published correction for the reviewed current command paths.** P2 `acc9f56f37d34c96021c415ab81612bef92dac63` was independently composed with P1 `aec4e78dab6557a41053d5a76c6ee217db73a16e`, then P1 `5447d8723c84caf98844df8a4276d3c21c727546`, and DBA b9f7a7e plus the focused transfer test. The [old failure/deadlock on3d23092](P2-LOCK-ORDER-REVIEW-2026-11-03.md) is historical and superseded for this candidate. This accepts the correction, not arbitrary future nested lock sets, all possible deadlock freedom or production enablement. Exact full-suite pins/results/hashes are in [current acceptance](INTEGRATION-ACCEPTANCE.md).

## Reviewed production behavior

| Boundary | Independently reviewed behavior |
| --- | --- |
| RelationalStore / GuardedStore | Declared operations-person guards are sorted by CapacityGuard, followed by SOS kinds where used, current users/appointments/Tanod, source/incident/assignments and selected destination. The Store retains/restores the declared people across nested calls. No audience/whole-barangay lock is introduced. |
| Mutable selection | EligibilityReferences.eligiblePerson requires an open transaction and assertPersonLocked on the **same selected Store** before current user/appointment/Tanod reads. Assignment, transfer and feedback Tanod selection use this seam; undeclared mutable people are rejected instead of locked late. |
| Display/reference reads | person()/household projections remain authorized and minimal but no longer acquire new participant locks just because a transaction is open. They cannot substitute for current mutable eligibility. SOS uses separate guarded sosHousehold before source creation. |
| Captured identity | Module atomic/once preserves the original Actor/EffectiveIdentity generation/role/scope; P1 locked(observed) performs current checks. No fresh observation replaces a revoked request. |
| Nested command sets | Actual once/atomic paths for SOS, response, rescue, details, publish and feedback reuse the declared actor. Assignment declares actor/candidate; transfer declares old/new/actor; feedback selection declares actor/Tanod. Resolution pre-reads participants then revalidates submitted revision under guards/source locks. New future mutable participants must be planned before sources. |
| Destination/history/rollback | Current selected facility remains after incident/assignment locks; capacity2/1, occupied staffing3/6/6, original revisions/keys, retained transfer/destination history, and caller source/history/audit/outbox/idempotency rollback remain intact. |
| Worker notifications | Persisted recipient identity is obtained before source reads; source/audience are reauthorized and event-time context retained in the existing receipt transaction. Nonlocking projections add no late participant locks. No second dispatcher or provider call is introduced. |

The source review covers RelationalStore, ReferenceData, Module, IncidentService and CivicService, including response/rescue/resolution and feedback. No P1/P2 service or DBA production guard was edited. The corrected protocol locks mutable command participants; it does not require locking every display name or event recipient.

## Independent executable evidence

1. P2's unchanged `tests/P2/sql.php` passes **41 SQL/HTTP/concurrency cases**, including two original-controller workflow branches over real P1 cookie/CSRF HTTP and MySQL. This retains last-slot/same-incident/completion competition, generation, current appointment/destination/Tanod, transfer privacy, stale revision and full transactional rollback cases. It is not MemoryStore or a fully registered original-browser release test.
2. P2's unchanged `sql-lock-order.php` is then rerun in isolation. Its actual assignment peer is wrapped in a one-attempt outer transaction; retries cannot turn a deadlock into success. The resident caller already holds its identity. Committed guard rows are initialized before the incident barrier, avoiding an artificial guard-upsert gap-lock obstruction. Both actual writes commit once; no production guard is changed.
3. DBA's **unchanged** `tests/Review/p2-lock-order.php` and worker pass: late_user_ids=[], both response/details processes commit, exactly one response remains and victim_count=0; gate exit0. The old detector is not weakened to obtain this result.
4. New DBA `P2GuardPlanContractTest` exercises actual transfer with old/new personnel IDs lower than the Captain. It verifies operations guards `[old,next,actor]`, exactly those prelocked users, no newly locked user after the incident, retained reassigned history, released old capacity, one new active assignment and revision advance. It passes1 test/12 assertions and introduces no teammate implementation.

Enabled `INFORMATION_SCHEMA.INNODB_METRICS` row `NAME=lock_deadlocks`, STATUS=enabled was read by a separate private administrator observer; the application account stayed database-scoped. Sequential measurements with no competing suite:

| Schedule | Before | After | Delta |
| --- | --- | --- | --- |
| Full published P2 SQL/HTTP/race runner |0 |0 |0 |
| Isolated unchanged deterministic regression |0 |0 |0 |
| Unchanged DBA manual order/race gate |0 |0 |0 |

These are recorded observations of meaningful independent-process schedules, not a claim that all future workload deadlocks are eliminated. `Innodb_row_lock_waits` remains only a contention statistic, never a replacement deadlock counter. Historical MySQL1213/deadlock evidence against3d23092 remains retained separately.

## P1 required detector and its published correction

The unchanged P1 aec4e78 detector initially failed on a populated test database by counting an integer barangay predicate as a user ID. A separate migrated disposable counterexample inserted only unrelated barangay5000; the actual P1 test created users1/2/3 in scope5001 and reported late user5001 although **no such user existed**. That failure is retained, not mislabeled as a remaining P2 inversion. A fresh full aec4e78 baseline passed182/807.

P1 then published5447d87. Its LockedUserIds helper extracts only ID-predicate bindings and rejects unknown whole-user lock predicates; it retains the required actual-service assertion. We copied P1's files unchanged and reran the mismatched-scope counterexample plus its helper tests: **3 tests/7 assertions pass**. The final complete result includes that unchanged gate and is recorded in current acceptance. No P1 test was patched/skipped by DBA, and the intermediate failing JUnit remains evidence.

## Acceptance boundary and remaining owner work

The previous incident-to-person inversion gate is closed for acc9f56 at the reviewed pins. Future nested commands must preserve complete declared mutable sets before source rows; display reads must never become eligibility authority. Actual P1 staffing/role/status change versus P2 transfer and P1 facility deactivation versus rescue still require the future P1 mutation services. Direct fixtures/current-read tests do not prove those cross-owner workflows.

P1 must pin the new DBA review and preserve current P2/registration isolation; original global form/readers, five-role release acceptance and operational checks remain owner work. [Photo/SMS decisions](PHOTO-SMS-CONTRACT-DECISIONS.md) are not ratified by accepting locks. Keep #48 draft; no merge, shared/live migration, worker activation or real provider action is included.
