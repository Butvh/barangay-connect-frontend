# Current worker acceptance — November4,2026

DBA code **81daca1e156854d4c8b74c6256a02358da9cb6fc** integrates the existing worker with actual P1 CurrentSmsConsent and retains private current-authority evidence. Consent persistence was published immediately at3e632f3 before this phase. [Behavior and owner contracts](CURRENT-SMS-WORKER.md), [implemented ERD](DATABASE-ERD.md), [actual data dictionary](data-dictionary.md).

## Frozen source and preservation

| Measured input | Exact revision |
| --- | --- |
| Actual P1 authority/photo source used for full suite |2e8161e7a9874af8bf88744066dacd9c43e5e776 |
| P2 used for full288 suite |5e61893861f04f652f4106a3ed923ab461b6a86b |
| Newer P2 independently tested SQL/probes |b477a7c6c259f9d981380f9a2c62320b7e080329 |
| DBA current worker/refinement code |81daca1e156854d4c8b74c6256a02358da9cb6fc |
| Unchanged main |3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |

Full-suite source fingerprint: **846a6b007dcf27bc6d6330ce175bf03a0335fa97aad32da5efd9e20a05cef4f7**, 261 app/config/database/routes/test files. After the P2-only test/document update: **0739ad2a676bce9542e56584622f2fc33bf7c2250ad216a905e799c23c74a054**, 261 files. 533 nonoverlap P1 tracked files and 94 P2 changed files match exact owner blobs after text CRLF normalization; binary bytes remain exact. Five explicitly verified common-base frontend overlays select P2. Preceding ten migrations are unchanged. No teammate service, Composer/bootstrap/CI/frontend was edited. Newer P104b9773 administration is outside this frozen worker certification.

P2's new delta changes only its guard-cleanup regression and handoff documents; its runtime producer is unchanged. The288 report remains pinned to5e61893; the separate48 SQL/+2 HTTP pass includes the strengthened b477a7c regression. Both source snapshots and owner hashes are retained independently.

## Measured gates

| Gate | Result |
| --- | --- |
| Actual P1 authority/current DBA worker + preserved transport/Make/uncertainty |43 tests /272 assertions;0 errors/failures/warnings/skips |
| Full unchanged owner + DBA suite on fresh genuine MySQL8.4.13 |288 tests /1415 assertions;0 errors/failures/warnings;1 Windows-only symlink skip;08:45.527 |
| Actual P2 SQL/independent processes/original controllers at b477a7c |48 cases +2 HTTP branches, pass |
| Isolated P2 one-attempt/lower-ID/current guard order |Enabled lock_deadlocks 3->3; delta0 |
| Independent DBA actual P2 response/details race |Enabled lock_deadlocks 3->3; delta0; no late people; both commands commit;1 response/victim_count0 |
| Actual configured production in-app CLI |Exit0; provider_calls0;0 remaining event/recipient/receipt/SMS/attempt/evidence rows |
| Separate configured SMS-intent CLI |Exit2, sms_intent_unsupported_in_app_only_writer;0 remaining rows; **positive producer acceptance unavailable** |
| Read-only source/frontend/artifact/portable gates |6 commands pass;19 P2 Node entries/48 portable checks;533 exact P1 +94 P2 files preserved |
| Snapshot/style/locked dependencies |7 snapshot checks;Pint257 PHP files;Composer strict/platform pass;locked audit0 advisories |

The current broad P2 SQL batch records lock_deadlocks **3->3**. The immediately preceding frozen5e61893 batch recorded **2->3**; both reports are retained. Latest captured engine metadata still refers to that older fixture: ["p2_test_dba_worker_20261104.capacity_guards"] / indexes ["capacity_guard_unique"]. Only schema/index metadata is exported; statements/record bytes remain private. This observation does not establish a new incident-to-user inversion. The two isolated deterministic schedules above remain separately measured; the broader batch is not described as universally deadlock-free.

The single Windows skip is PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected: this OS does not permit its symlink fixture. Matching older P1 Linux CI exercised earlier photo/consent pins; it does not certify this new worker SHA. New-pin Linux combined/browser acceptance remains an owner gate. A resumed run encountered an interrupted partial local fixture; it was preserved, and the passing final report uses a NEW isolated database. No shared/live or presentation dataset was reset.

## Actual authority, source and transport boundaries

Tests invoke actual CurrentSmsConsent.change/withCurrentEligibility and actual TypedAuditRecorder. Independent child processes run the actual revoke and actual worker; observed MySQL row-lock wait proves serialization, committed revoke denies reservation, and provider_calls remain0. Stale repeatable-read/current-read cases remain in the full P1/consent suites. Tests cover absent/granted/revoked/obsolete/wrong-purpose/scope authority, account/appointment/generation/role/contact changes, repeated explicit intent/current Make scope/payload checks, actual P2 announcement retraction, retry revocation and rollback/crash/retained-data/partial-DDL safety.

One original identity observation survives both gates. Current recipient/account/appointment -> consent precedes current source/event/recipient/receipt -> ledger/rate/budget. Reservation and final gate commit before the existing HTTP client. Private revision/policy/template proof records each accepted gate. Conservative Manila-day budget re-reservation covers next-day definite retries and midnight between gates. Original single dispatcher, independent channel receipts, authentication/credential scope/replay, budgets/rates/segments/allowlist, fencing, definite rejection, timeout uncertainty and GET-only reconciliation remain tested with fake HTTP. No carrier/Make delivery is claimed.

Transport fixtures construct isolated explicit intents; they are **not actual positive P2 producers**. No authority/writer double is accepted as production consent or positive producer proof. Real source producer rollback/replay and audience/consent intersection remain unavailable until P2 publishes the actual fixture/entry point. Only the two ratified v2 families may request SMS; unsupported SMS exit2 is denial evidence.

## Reproduction and remaining owners

Compose the exact pinned owner sources with preserved hashes and locked dependencies. Use unchanged P1 phpunit.xml plus DBA Database/Integration/Compatibility suites, explicit disposable matching DB/DB_TEST connection settings, P1_COMBINED_TESTS=1, MYSQL_INTEGRATION=1, DB_TEST_DISPOSABLE=1 and GD inherited by bounded-decoder children. Private credentials are never committed. The private bootstrap sets no consent grants; tests explicitly invoke real self-consent.

Measured full command from the composed root, substituting private fixture paths:

~~~text
php -d auto_prepend_file=PRIVATE_BOOTSTRAP backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.worker.xml --log-junit PRIVATE_REPORT --display-warnings --display-skipped --fail-on-warning
~~~

P2 sql-cases.php and unchanged Review/p2-lock-order.php run sequentially with enabled lock_deadlocks observation; configured Compatibility/check-shared-contracts.php runs separately in two fresh fixtures, with --sms-intent only for the explicit denial branch. Read-only frontend/artifact/portable/snapshot/style/dependency results accompany the exported evidence.

P1 owns the shared named MySQL session timezone +00:00 correction (PR49 comment6628096495). Actual root-P1 SYSTEM/+08 child connections reproduced conflicting grant/update chronology; only disposable test connections were aligned. The worker fails closed on non-UTC sessions. P2 owns actual positive/negative incident/announcement producer fixtures, source preflight outside locks and original successful-intent replay. PR50 comment6628401282 requests their real entry point/event identifiers. No additional consent approval is pending.

Keep PR48 draft. Normal SMS/Make/dispatch/production workers remain off; no merge/retarget/deploy, shared/live migration, real SMS/mail or scenario activation. November5 presentation:8AM joint readiness, noon source/data freeze,2PM checks,3PM rehearsal,4PM restart,5PM presentation. [Truthful fictional demo/reset and real-versus-fake explanation](DBA-PRESENTATION.md).
