# Joint current acceptance — November 5, 2026

**Current November5 candidate review:** [9bc1a04/f4e8df9/22365ad privacy and presentation handoff](CURRENT-CANDIDATE-PRIVACY-READINESS-2026-11-05.md). Reviewed Linux CI41883691022 passes384 tests/2108 assertions but is **overall RED** at the required photo opening-session browser gate; resident gallery is absent. Independent DBA target120 tests/709 assertions passes with one Windows symlink skip; actual local producer/fake-worker modes and replay pass. P1 facility history/UTC and P2 actual producers are implemented. Final corrected-pin photo/browser/Linux acceptance and host operations remain pending; real external delivery is untested. Normal optional/SMS/Make/dispatch flags stay off.

The remaining document is the retained **historical04cf76c/9fbe5d3/b05cb64** matrix. Its383/2104 result does not certify P19bc1a04.

**One frozen current combination passes383 tests /2,104 assertions, with zero errors/failures/warnings and one explicit Windows symlink skip.** Actual P1 facility-history/photo/consent services, P2 administrative/photo/SMS producers and the existing DBA worker are used. External HTTP is fake. This supersedes absent-UTC/absent-producer/history-implementation rulings at older pins; it is not production or current-browser certification.

## Exact source and schema

| Input | Frozen revision |
| --- | --- |
| P1 |04cf76c53be175ae2f0a99ac9b5df8b4039425a6 |
| P2 |9fbe5d3cb0246ab79517506ad69a09562d7e3f1b |
| DBA runtime/tests |b05cb64ffb7ee602c5b43e948c6bb2adea569c94 |
| Unchanged main |3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |

The evidence/documentation commit is a descendant; it changes no tested application/configuration/migration/test code. All preceding eleven migrations match8cd2740. New12/13 provide lossless160/300/50 facility widths and scoped immutable full history. Actual metadata: **42 InnoDB tables,13 migrations,67 FK relationships**. [ERD](DATABASE-ERD.md), [actual dictionary](data-dictionary.md), [schema/snapshot/rollback contract](FACILITY-PERSISTENCE-CONTRACT.md).

P1 **573** nonoverlap tracked files and P2 **105** changed files match exact owner blobs after text CRLF normalization; binary bytes remain exact. Five reviewed original frontend overlays select P2. App/config/database/routes/tests fingerprint: **2ee377ecb0eb91f58f69fd88a770de7dd23a7029d60e4e7aa2710bbc58b2d7ba**, 298 files. No teammate service/shared Composer/bootstrap/CI/frontend source was edited by DBA.

P1's UNCHANGED composeSnapshot/verifySources also assembled the explicit current test lock in a clean detached P1 checkout: **831 fingerprints**, 153 DBA owner blobs, 105 P2 owner blobs, five overlays, dirty=false. Only the function's test lock argument was supplied; no shared integration-lock, gate or owner manifest was patched. This is source/artifact review, not deployment. Source hashes and the separately labelled passing7abfd84/cc0847d380/2063 checkpoint are retained.

## Measured current gates

| Gate | Exact result |
| --- | --- |
| All unchanged owner + DBA PHPUnit suites |**383 tests /2104 assertions**,0 errors/failures/warnings;1 Windows symlink skip;05:41.568 |
| Actual P1 full-history + DBA persistence target |**30 tests /137 assertions**,0 errors/failures/warnings/skips |
| Current P2 genuine SQL/process/original-controller branches |**48 SQL cases +2 HTTP branches**, pass |
| Isolated one-attempt/lower-ID/declared-person order |Enabled lock_deadlocks 4->4, delta0 |
| Independent actual responder/details service race |No late people; both commit;1 response/victim_count0; observed row-lock wait delta1; deadlocks 4->4 |
| Configured production in-app probe |Exit0, provider_calls0,0 remaining event/recipient/receipt/SMS/attempt/authorization rows |
| Separate default SMS-intent probe |Expected exit2 sms_intent_unsupported_in_app_only_writer;0 remaining rows |
| Actual-source positive/missing/revoked/wrong-purpose consumer |Accepted fake POSTs2/0/0/1; each intended delivery one attempt +reservation/pre_send proof; real calls0 |
| Completed source-report replay |Positive/wrong-purpose add0 fake POSTs/attempts/evidence |
| Read-only frontend/artifact/source checks |6 commands pass;24 P2 Node entries;48 portable checks;483-file scanner |
| Snapshot/style/dependencies |8 snapshot tests;Pint294 PHP files;Composer strict/platform pass;locked audit0 advisories |

The real native PDFINFO_BINARY/GD cases ran; PDF acceptance is not skipped. The single skip is PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected because this Windows OS does not permit that fixture. Linux execution of this exact source and original-browser certification remain P1's joint gate. Older CI/screenshots do not certify this combination.

The current broad P2 batch records enabled lock_deadlocks **4->4**. Latest engine metadata already points to ["bc_dba_p1_joint04cf_20261105.capacity_guards"] / ["capacity_guard_unique"]. Only table/index metadata is exported; statements/record bytes remain private. The final deterministic and independent schedules add0 deadlocks; this is not a claim that every full-suite schedule is deadlock-free. Prior allocator-contention findings remain in the earlier measured records. No new user/incident inversion is established and no audience lock/blind retry is introduced.

## Actual source and accepted fake attempts

These events were created locally by unchanged P2 producer-fixture.php using actual consent and source services. Each mode uses its own newly created scope/actors in a confirmed fresh current schema. Source SHA256: **0bc53587f46db1227c0798611a7c4f78f7b9313b9b84c63d18bf98a2469e7204**; consumer SHA256: **d8e6a7bf88fc27905f8249d482cd81275334d5a629d483451862404ba317f0a4**. [Machine-readable source inputs, exact report hashes, current authority evidence and replay](evidence/2026-11-05-produced-delivery.json).

| Mode | Incident in_app/SMS | Publication in_app/SMS | Accepted fake POSTs |
| --- | --- | --- | --- |
| positive |1/1 |2/1 |2 |
| missing |1/0 |2/0 |0 |
| revoked |1/0 |2/0 |0 |
| wrong_purpose |1/0 |2/1 |1 |

Wrong-purpose grants publication only to the Captain; that publication SMS is valid. Default TypedOutboxWriter stays allowSmsIntent:false. The real source fixture explicitly selects the true writer AND real consent port; a phone, role, registry, global switch or in-app intent never substitutes for consent. The default --sms-intent exit2 is kept separate from this actual positive source/worker acceptance.

| Case | Source event | This device's UUID | In-app/SMS | Delivery:fake provider ID |
| --- | --- | --- | --- | --- |
| positive | incident.created.v2 | ae19436d-153a-48a0-bb08-0512386fdc09 | 1/1 | 1: 85001 |
| positive | announcement.published.v2 | df15cb80-ebf4-48fc-b9d8-127db8f42477 | 2/1 | 2: 85002 |
| missing | incident.created.v2 | 92ff61f2-ead8-4973-ab72-5ea92348fa47 | 1/0 |  |
| missing | announcement.published.v2 | 697d7a45-1df6-414a-86d3-7fedc826cdf1 | 2/0 |  |
| revoked | incident.created.v2 | dcb6eff8-515a-48d0-86c7-be88bc58841a | 1/0 |  |
| revoked | announcement.published.v2 | 8bafcbd9-baef-432c-8989-d7e3adbe09d7 | 2/0 |  |
| wrong_purpose | incident.created.v2 | 78130f2a-7862-422f-b73c-2e16bba14203 | 1/0 |  |
| wrong_purpose | announcement.published.v2 | 07ff7d59-0c56-4e55-872c-ea0880f3f4e5 | 2/1 | 3: 85003 |

Each accepted fake row has one attempt and private current reservation/pre_send revision/policy/template evidence. Actual configured TypedOutboxWriter/InAppHandler and the single dispatcher produce independent in-app receipts. Urgent incident.created.v2 uses the existing Laravel->Semaphore worker directly. Publication waits for the actual in-process authenticated scoped Make HTTP command, records the expected credential/payload hash and deduplicates replay, then uses the SAME ledger/worker. Fake/stray prevention precedes temporary in-process enablement; no external Make/scenario or real provider request occurs. Queued fake acceptance is not handset delivery.

ProducedEventWorkerTest invokes the owner fixture in a child process for current consent/account/role/contact/source revocation before and after reservation; captured generation/appointment changes; current Make credential/scope changes; retry/conservative budgets and uncertain outcomes without blind POST retry. In-app receipts remain independent. Scope defense includes deliberate isolated FK-bypass corruption; normal scoped FKs already refuse moving the user. No authorized transfer workflow or invented enqueue-time generation is claimed. Existing actual stale-RR/current-read, independent revoke/worker waits, rate/segment/allowlist/day-budget/fencing/reconciliation tests remain in the full suite.

## Actual facility-history adoption

P1's actual04cf76c writer/projection is accepted with the real table/model. Source create/key replay, edits/pins, Deactivated/Reactivated state, full multibyte snapshots and original actor/name/role/revision are retained. Source/history/audit/outbox/create-receipt failure rolls back together. Legacy rows receive no manufactured Created event; their first real change starts at the true source revision. Shared-directory readers cannot see manager history. Existing rescue destination JSON survives facility edit/deactivation unchanged. SQL UPDATE/DELETE and private model mutation refuse; retained rows block downgrade.

The width migration preserves each original utf8mb4 column collation. An independent connection's wide write after downgrade precheck is rejected by strict atomic narrowing without losing it; caller sql_mode is restored. Compatible interrupted DDL repairs missing guards; incompatible retained objects refuse. No shared/live migration was used.

## Reproduction and retained setup evidence

Use the exact owner sources/lock with a NEW device-local confirmed MySQL8.4 test schema, matching DB/DB_TEST connection values and disposable flags. P1's native PDF parser/GD must be inherited by children; its named MySQL connector selects+00:00. This local test account also has SELECT on ONLY performance_schema.data_lock_waits and threads for the unchanged recovery-race observer; no owner test/CI was weakened. The first7ab full attempt had1 diagnostic-access error (0 assertion failures/1 OS skip), preserved separately; correcting only those read privileges made the original race pass1/10, then a new full fixture passed380/2063. The later383 report is the single final history combination, not a sum of those phases.

~~~text
php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.combined.xml --display-warnings --display-skipped --fail-on-warning
php backend/tests/P2/sql.php
php backend/tests/Review/p2-lock-order.php
php backend/tests/Compatibility/check-shared-contracts.php
php backend/tests/Compatibility/check-shared-contracts.php --sms-intent
php backend/tests/P2/producer-fixture.php positive > PRIVATE_REPORT.json
php backend/tests/Compatibility/check-produced-delivery.php --fixture-report=PRIVATE_REPORT.json
~~~

The private measured runner uses P1's unchanged phpunit.xml plus DBA Database/Integration/Compatibility suites and a private bootstrap for confirmed connection/flags; it seeds no grants. SQL/races/probes and heavy checks ran sequentially. Repeat the owner producer for missing/revoked/wrong_purpose and regenerate local IDs; never import another device's schema/path/event IDs. Repeat a completed report to prove0 extra POSTs. The source-preserved P1 snapshot composer accepts all current paths without relaxing gates. No owner runtime patch or alternate source/writer/client was installed.

The new width migration's original collation precondition was corrected at815c272 after a fresh actual P1 installation exposed it. Separate fixture-only retraction/stub/fake-ID corrections and the passing fallback source snapshots remain labelled in history/private evidence. The old ambiguous fake claim is retained rather than resent. The final source evidence above comes from fresh owner-created events and distinct fake IDs; no failed phase is hidden inside a combined success count.

## Remaining certification and presentation

P1 owns final current-pin Linux/original-browser certification and presentation-machine restore/rehearsal. Normal optional/SMS/Make/dispatch/production workers remain off. External provider/account/sender/credit/recipient/Make/host delivery remains untested; no spending or real send was authorized. Keep PR48 draft: no main/teammate merge/retarget/deploy, shared/live migration, real SMS/mail or activated scenario/production worker.

November5 schedule:8AM readiness, noon source/data freeze,2PM checks,3PM rehearsal,4PM restart/restore,5PM presentation. [Truthful source/reset and transaction/outbox/queue/ledger explanation](DBA-PRESENTATION.md). Preserve the separately passing380/2063 checkpoint; do not substitute its screenshots/counts for this final source.
