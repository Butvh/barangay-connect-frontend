# DBA integration acceptance — November 3, 2026, Asia/Manila

**Historical first integration run, retained unchanged below.** This used P1 `7dcf8447` and the then-current checker/runtime. Its missing-context/Testbench and hardcoded-wrapper findings are superseded by [current acceptance](INTEGRATION-ACCEPTANCE.md); do not treat them as current blockers or reuse 99/421 as the latest result.

DBA compatibility changes are implemented and tested, with remaining cross-owner gates explicitly **not passed**. No main/teammate PR merge, live database migration, real SMS, credit purchase or Make activation occurred.

## Reviewed source and environment

| Input | Exact reviewed revision |
| --- | --- |
| Main | 3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |
| Prior DBA #48 | 32ff81f4cb1c7e2f704dc5f93168f1261787e376 |
| Published DBA implementation update | 0c966860cb7dc9368031d47b27e7c560348633ea |
| Exact DBA implementation tree | bf2f78d9baaae954c4107437851b95451ba43f59 |
| P1 #49 | 7dcf8447bbfc594d0cf42b7a1710f62a7856436c |
| P2 #50 | c902d9f7239a8fcefdddf293fbc531876548c10a |
| Local-only combined assembly | 2eede4ea187de806b18d49dd11015472ff701b71 |
| Local combined tree | 4e4116123d494e594131490fed41830d5ba7c5bb |

The combined checkout starts at P1's revision, overlays P2's diff from its planning base (keeps P1's backend README), then adds DBA-owned source. It is a local verification assembly, **not a reviewed merge or published integration branch**. Tests ran on that assembled code, subsequently recorded in the local commit; documentation/cache-exclusion changes do not alter the tested code. A normalized-LF fingerprint of152 application/config/migration/route/test/fixture/dependency metadata files is `58a1915fca843450659f4eb6e3a5ca64ceb14062d6830d09258403d31ff42890`. All458 P1 tracked files and34 P2 changed files (excluding their overlapping backend README) were compared against their original Git blobs and are unchanged apart from checkout line endings.

Verified PHP8.5.12, Composer2.11.1, Node24.22.1, Laravel13.39.0 and MySQL Community8.4.13/InnoDB/utf8mb4 on a disposable loopback-only database. XAMPP MariaDB and SQLite were not used. Separate external vendor directories preserve P1's root lock (PHPUnit12.5.43) and DBA Testbench11.3.0/PHPUnit13.4.6 lock; no P1 Composer/bootstrap/CI source was changed.

## Passing evidence

| Gate | Result and practical limit |
| --- | --- |
| Combined P1 + DBA suite | **99 tests,421 assertions,0 failures/errors/skips**,99.076s; fail-on-warning/risky enabled |
| P1 exact locked runtime | **19 tests,79 assertions,0 failures/errors/skips**,1.961s; actual MySQL engine test enabled |
| P2 existing runner | **47 checks pass**; P2-owned MemoryStore contract tests, not SQL/domain race evidence |
| Original frontend regression suite | **405 checks pass** on DBA branch and combined source |
| P1 frontend additions |13 transport/lifecycle checks plus the awaited-sign-out check pass on combined source |
| P2 adapter suite |8/8 pass; no skips |
| Static checks |Pass: DBA source and combined frontend scanner; no weakening of P1-owned exclusions |
| Frontend Pages artifact |Both static artifact allowlist/root-destination checks pass on P1's combined source |
| Backend frontend artifact |Both secret/seed exclusion and actual hydrated module-graph checks pass using `node tests/backend-artifact.mjs` |
| DBA Pint |Pass for DBA-owned PHP |
| Composer |P1 strict manifest validation passes; P1 and DBA locked audits report no advisories |
| Migration immutability |Original six November2 migrations unchanged; two November3 migrations are additive |
| Ownership |DBA branch changes only DBA-owned backend paths; P1/P2 source checksums match reviewed inputs |

The99-test suite retains the original provider timeout/uncertainty, low-balance/rate-limit, replay/forgery, lease/fencing, channel deduplication, recovery, real-MySQL independent-process guard races, migration/seeded upgrade/rollback, encrypted fictional backup/restore and5,000-row EXPLAIN coverage. New tests verify auth_version default/cast/nonnegative/remember-token/upgrade/rollback, all14 v2 event shapes/eight invalid mutations, explicit channel permissions, snapshot status after a later source change, failed/unbound/missing-handler diagnostics, malformed SMS-ledger rejection, v2 Make replay, downgrade refusal and current locking reads after a stale repeatable-read snapshot. Real P1 role/resource/middleware code was tested against real DBA User/appointment/Tanod rows and a persisted generation change.

Named failing regressions were run before their fixes: `test_auth_version_defaults_to_integer_zero_and_missing_generation_stays_null`, `test_status_snapshot_is_explicitly_versioned_and_in_app_only`, `test_unknown_event_is_quarantined_once_without_success_receipts`, and the three GuardContractTest cases (coerced IDs, unsupported scope/kind and missing current-read helper). The final combined run has no skipped cases. Standalone DBA source intentionally lacks P1 classes; the two Integration tests explicitly skip there rather than pretending P1 integration exists. No new standalone-total claim replaces the historical55-test record in ACCEPTANCE.md.

## Exact commands and required P1 registration

In the local verification workspace, with external dependencies/private bootstrap paths and DB/DB_TEST variables targeting the same explicitly disposable `bc_dba_*` MySQL:

```powershell
# Combined Testbench profile; bootstrap supplies test-only DB settings and APP_BASE_PATH.
php work/combined-harness/vendor/phpunit/phpunit/phpunit --configuration work/dba-combined-verification/backend/tests/ci/phpunit.combined.xml --bootstrap <absolute>/work/combined-bootstrap.php --log-junit work/combined-results.xml

# From combined backend, P1's unchanged lock/profile and only its existing test paths:
php ../../p1-locked-vendor/phpunit/phpunit/phpunit --configuration phpunit.xml --bootstrap <absolute>/work/p1-locked-bootstrap.php --log-junit ../../p1-locked-results.xml tests/Feature/SessionBoundaryTest.php tests/Feature/MySqlEngineTest.php tests/Unit/FoundationSecurityTest.php

# From combined root:
php backend/tests/P2/run.php
php backend/tests/Compatibility/check-shared-contracts.php
node scripts/run-tests.mjs
node scripts/check.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
node --test tests/p2-adapters.mjs
```

Composer installs were `--no-scripts` with external COMPOSER_VENDOR_DIR; P1's tracked manifest, lock and bootstrap remained byte-equivalent. The independent harness's App/Tests namespaces point at the combined checkout. P1 must register the separate profile/suite commands or review an explicit root dependency update. Its current default PHPUnit discovery fails because Testbench is absent and its root suites also omit tests/Database. This failure was reproduced; it is **not** an integrated-green CI claim. See tests/ci/README.md for exact environment/registration steps.

The documented Node flag `--experimental-default-type=module` is unavailable in Node24.22.1; the supported flag-free command above passes the unchanged artifact test. Windows did not execute that test's conditional non-Windows symlink branch; no Linux symlink-branch evidence is claimed.

## Failed or unavailable integration gates — keep drafts

`check-shared-contracts.php` reports five current failures against the unchanged P1/P2 sources:

1. P2's writer does not implement P1's shared OutboxWriter interface.
2. P2's occurredAt argument is string rather than DateTimeImmutable.
3. P2's `handle(array): int` handler does not implement the per-recipient ORM `InAppNotificationHandler` contract.
4. P1's six-argument OutboxWriter needs the explicit optional bounded context argument (plus recipient audience/structured-audit review described in the contract).
5. P2's actual writer rejects the canonical UUID/v2/relational-recipient fixture.

These failures are deliberate release gates, not suppressed/expected-success tests. The v2 definitions are the exact DBA candidate; neither party's adoption/approval is invented. P2 must adapt producer names/IDs/DTOs, channel selection, repositories and handler; P1 must review interface/context/audience additions, auth-generation increments, source gateways and bootstrap/CI registration. The registration of in-app families does not mean P1 domain source handlers already exist.

No production SQL Store/ReferenceData or actual-domain MySQL race tests are provided by the reviewed drafts. P2's requested last-slot, same-incident, stale-revision, transfer/revocation, completion-release, facility/use and transactional side-effect races therefore remain **unverified on the actual services**. DBA's protocol fixtures are retained but are not substitutes; this assignment explicitly excludes implementing P2 repositories/business services. No production fake is bound.

Combined default Laravel Pint on an isolated LF-normalized copy still flags P2's `backend/app/Http/Controllers/P2/NotificationController.php` (unary spacing/statement indentation). Windows checkout line-ending noise was separated before identifying that remaining source finding. P2 must format its owned file and rerun the combined check; this branch does not edit it. DBA's scoped Pint passes.

P1's safe Pages artifact passes in its draft/combined checkout, but main still has the old whole-checkout upload. Keep #48/#49/#50 draft until safe-artifact integration, contract adoption, shared runtime/CI, real SQL-domain races and review gates pass. Live host/storage/session/mail/worker/monitoring and live Semaphore/Make setup remain external and unverified. No recipients/budget were authorized and no provider send or scenario activation occurred.
