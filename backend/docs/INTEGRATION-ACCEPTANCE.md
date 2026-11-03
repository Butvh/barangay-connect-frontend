# DBA lock/photo/delivery acceptance — November 3, 2026

**Lock-order acceptance remains unresolved.** Latest combined run: **181 tests / 797 assertions, one failure, zero errors/skips**. The sole failure is P1's new actual-P2-service lock-order gate; it is retained unchanged. All DBA photo/delivery tests pass. The photo schema is an **unratified proposal outside active migrations**. No teammate services, Composer/bootstrap/CI, shared/live database, production binding, real SMS, Make activation, deployment or main merge was changed.

## Exact reviewed inputs

| Input | Revision |
| --- | --- |
| Main |3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |
| Starting DBA #48 |3d2b3a2dd6afa88ea34b9a441f48da3863787bbd |
| Published DBA review implementation |ea542833b5fb3638fbeb913f54a39559bea02bed |
| DBA implementation tree |37e48f7ffd497b093223383680c94e3bdb45a9f5 |
| Starting P1 baseline |c0a32cfaf4b26b86d57681cd1ed6aa42d6c87bb1 |
| Latest reviewed P1 #49 |aec4e78dab6557a41053d5a76c6ee217db73a16e |
| P2 #50, still uncorrected |3d23092883e0f24aa89b4c86ce93862e35880e3e |
| P2 planning base |ef9a57a2ea0feeb99829e7928595cc925c25bcc7 |
| Local-only frozen composition |cd1e37bc2e2428fe0c5f7e3b1ca40cf44c57d7eb |
| Local composition tree |99e8b4c7ee4bc754682213b046b0c88f45f43971 |

The private composition starts at P1, copies the exact P2 planning-base diff and adds DBA-owned source. It is not a published integration branch or approved merge. All **499 P1 tracked files and62 P2 changed files** match their pinned Git blobs after checkout CRLF normalization; per-file SHA256 records are retained. All eight existing migrations match the starting DBA revision. Tested application/config/database/route/test fingerprint: **208 files, SHA256 `6b532e9f66a59773ea8d96ad8973ab63e84873711be7bc0c45089ad00d491938`**. Later documentation changes do not alter tested code.

Runtime: PHP8.5.12, Composer2.11.1, Node24.22.1, P1's unchanged root Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43 lock, genuine MySQL Community8.4.13/InnoDB/utf8mb4. Dependencies use an external vendor directory (`composer install --no-scripts`) and private ignored vendor junction; no P1 source/dependency patch. SQL ran only on loopback disposable bc_dba_p1_*/bc_dba_p2_*/p2_test_* databases with a database-scoped account. The private deadlock observer used the existing local administrator separately, without granting monitoring privileges to the app account. No credentials or private bootstrap are published.

## Work delivered and measured results

| Gate | Exact result / limit |
| --- | --- |
| Latest P1 aec4e78 combined profile |181 tests,797 assertions,1 failure,0 errors/skips;146.818118s JUnit test time; fail-on-warning enabled |
| Sole failing case |CombinedP2LockOrderTest::test_actual_assignment_never_acquires_a_new_person_row_after_the_incident_lock; newly acquired participant15 reported |
| DBA photo candidate |23 tests /56 assertions,0 failures/errors/skips;20 invalid SQL cases, seeded additive up, rollback/intent uniqueness, retained-data down refusal and empty down/up |
| New delivery acceptance |3 tests /19 assertions,0 failures/errors/skips; credential ID, immutable v2 template/no fabricated SMS, shared one-segment budget/channel independence |
| Unchanged core DBA suite |Migration/seeded upgrade, generation, constraints, protocol races, encrypted backup/restore, EXPLAIN, delivery uncertainty/replay/reconciliation and recovery all execute; no DBA test failure |
| P2 actual published runner |33 SQL/HTTP/race cases pass on P1 c0a32cf composition; real services/SQL/independent processes, no MemoryStore substitution |
| Additional actual P2 race/order review |Both response/details processes commit,1 response, victim_count0; new user after incident confirmed; manual gate exit2, lock_order_accepted=false |
| Latest configured actual adapter CLI |Pass with P1's guarded P2_TEST_BINDINGS profile selecting TypedOutboxWriter/InAppHandler; provider calls0, SMS intent not requested |
| Explicit real P2 SMS-intent probe |Exit2: writer remains in-app-only; no provider sends; separate owner dependency |
| Frontend/portable/style/artifacts |Original405 frontend checks plus current P1 transport/polling/intent/bridge pass; P2 portable48 and adapters11 pass;435-file scanner, both artifact suites and combined LF-normalized Pint pass |
| Dependencies / ownership |P1 strict Composer validation and locked security audit pass, no advisories;499/62 teammate files preserved and8 migrations unchanged |

Before P1 published aec4e78, the same DBA changes passed **178 tests /781 assertions, zero failures/errors/skips** against c0a32cf (151.857408s). That baseline remains separate evidence. P1's new update adds guarded disposable real-class selection, current P2 pin/allowlist, SQL/HTTP/race CI registration and the required failing lock-order test. We copied every changed P1 file unchanged and reran the full profile; **the newest result is not green**. No test was removed, skipped, made expected-success or patched to clear the gate.

## Lock review — correction still unpublished

The user confirmed P2 has not published the correction. Actual acknowledgment locks actor/candidate users, then incident, then a previously unheld resident via ReferenceData.person -> user(). Nested once/atomic planning can also expand an incomplete person set. See [precise source findings and owner changes](P2-LOCK-ORDER-REVIEW.md).

DBA's manual review uses actual P2 services and a common-start independent-process response-versus-resident-edit race. Both requests succeeded in the observed run; a private observer measured zero new deadlocks. This does not clear the confirmed SQL order violation or replace P2's deterministic failing concurrency regression. The gate remains exit2. Guard helpers alone are not presented as actual-service proof. P2 must publish a complete outermost lock plan/correction and rerun the specified actual-service races; P1 still owns future role/status/facility mutation races. P1 should also make its own lock-test ID extraction distinguish user IDs from integer scope bindings; no P1 test is edited here.

## Photo proposal — not ratified or auto-applied

[Proposal and ownership decisions](INCIDENT-PHOTO-METADATA-PROPOSAL.md) define scoped uploader/incident-owner FKs, UUID token, HMAC submit intent, private disk/random object key, detected MIME/size/hash, original generation, lifecycle/cleanup claims, UTC timestamps and expiry/recovery indexes. The executable candidate is in **database/proposals/**, not database/migrations; it adds no active model or byte service. Existing verification/personnel document purposes are untouched. Candidate tests call it only on disposable data and remove only that candidate before other migration tests.

P1/P2 must agree uploader roles,24h staging lifetime, exact attach/download purpose policy, resolved/history access, cleanup/retention and storage-integrity semantics before an additive migration/model is published. P1 owns actual byte inspection/staging/private download/cleanup; P2 owns exact persisted incident/source/revision authorization. Metadata tests do not prove byte privacy, token-consumption/cleanup concurrency or the future photo service.

## Make/Semaphore — fake acceptance and missing P2 intent

[Delivery evidence and exact P2 contract request](DELIVERY-FAKE-ACCEPTANCE.md) retain the one dispatcher and independent receipts, all14 in-app definitions, two narrowly permitted v2 SMS events, replay/credential scope, budgets/rate/low balance, timeout uncertainty and known-ID reconciliation. Urgent delivery remains Laravel worker directly to Semaphore; approved announcement automation remains nonurgent Make -> scoped Laravel command -> the same SMS ledger. All normal transports are fakes.

P2's actual in-app adapter now passes the unchanged configured SQL/receipt checker through latest P1's isolated profile. Earlier absent-adapter/Pint/context/discovery statements are superseded. Default production flags remain off. Both Module::event and TypedOutboxWriter still deliberately exclude SMS. A real source transaction must explicitly select approved SMS recipients/channels for incident.created.v2 or announcement.published.v2 and persist that intent; neither Make, an in-app permission nor phone presence may invent it. Other12 v2 families remain in-app only. No real SMS or Make scenario is activated.

## Reproduction and remaining release gates

Private bootstrap supplies exact matching DB_*/DB_TEST_* values, APP_BASE_PATH in process/$_ENV, root autoloader, MySQL binaries, APP_ENV=testing, DB_TEST_DISPOSABLE=1, P1_COMBINED_TESTS=1 and MYSQL_INTEGRATION=1. Provider/module/dispatch flags remain false. From the workspace root:

```powershell
# Latest unchanged P1 root settings + its Database/Integration/Compatibility discovery.
php work/lock-photo-vendor/phpunit/phpunit/phpunit --configuration work/dba-lock-photo-verification/backend/phpunit.review.xml --bootstrap <absolute>/work/lock-photo-bootstrap.php --display-warnings --fail-on-warning --log-junit work/lock-photo-latest-results.xml
# Earlier c0a32cf baseline used the same command with lock-photo-combined-results.xml.
```

From the combined root, with fresh `p2_test_*` env and IDENTITY_ENABLED=true: `php backend/artisan migrate --force --no-interaction`, then `php backend/tests/P2/sql.php`; the latter refuses populated fixtures. The manual `php backend/tests/Review/p2-lock-order.php` adds its own fictional fixtures and returns2 at this candidate. For latest P1's configured CLI use a migrated bc_dba_p2_* database, **P2_TEST_BINDINGS=true**, IDENTITY_ENABLED=true and providers/modules/dispatch false, then `php backend/tests/Compatibility/check-shared-contracts.php`. All actual bindings come from P1's guarded test profile; no test double is selected.

Independent passing commands: `node scripts/run-tests.mjs`, `node scripts/check.mjs`, `node tests/frontend-artifact.mjs`, `node tests/backend-artifact.mjs`, `node --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs`, `php backend/tests/P2/run.php`, root Composer strict validation/locked audit and read-only combined Pint on an isolated LF copy. Private setup initially lacked the worker identity env and the new budget test initially compared SUM's string to an int; these harness issues were corrected before final recorded runs, without owner code changes.

Keep #48 draft. Required remaining inputs: P2's published lock correction/regression, photo agreement and actual private bytes/policy, explicit authorized P2 SMS intent, P1 pin to this DBA review, broader source-family/form registration, required-green combined CI and original-domain/host acceptance. P1's safe Pages artifact/private Laravel web root remain release gates; main is unchanged and its old whole-checkout upload is not a safe backend release. Windows results do not certify Linux-only artifact branches. No live deployment/worker/provider success is claimed.

History retained separately: [135/567 typed-checker round](INTEGRATION-ACCEPTANCE-TYPED.md), [99/421 initial integration](INTEGRATION-ACCEPTANCE-INITIAL.md), [55/218 original standalone](ACCEPTANCE.md). None is the latest combined result.
