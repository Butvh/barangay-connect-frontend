# DBA follow-up acceptance — November 3, 2026, Asia/Manila

**Historical typed-checker round.** The135/567 result and then-unconfigured P2 candidate below are retained as dated evidence. [Current lock/photo/delivery review](INTEGRATION-ACCEPTANCE.md) supersedes availability statements and records the newer P1 required failing order gate. Do not reuse this older green total as latest combined acceptance.

**135 tests / 567 assertions pass; production integration remains blocked.** The corrected configured-adapter CLI exits2 because the production outbox writer and notification handler are unconfigured. Test doubles prove the checker and DBA pipeline, not P2 implementation. Keep #48 draft. No main/teammate merge, shared database migration, deployment, live SMS, purchase or Make activation occurred.

## Exact inputs and runtime

| Input | Reviewed revision |
| --- | --- |
| Main | 3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |
| Prior DBA #48 | f641918d37ff2ecd49cc47b3437bb0e159d6a10a |
| Published DBA implementation | 8f4d4f6a8ce2f4892766ac773d2bc09e86162758 |
| DBA implementation tree | b55159b47878f98038873d7086f788eab1eb0d63 |
| P1 #49 current | 41b6c42fc536237b10034b3eb3fe058f9ee71fc1 |
| P1 PHP/runtime baseline | bc2764a746d742efb655a4b3c752ad205e28f180 |
| P2 #50 | c902d9f7239a8fcefdddf293fbc531876548c10a |
| P2 planning base | ef9a57a2ea0feeb99829e7928595cc925c25bcc7 |
| Local-only frozen assembly | d1660a973dd4b774ee11130161e7e13df39223b2 |
| Local assembly tree | 37073438e63cf004392622bb3e10341fee53e709 |

The private assembly combines P1 source, P2's planning-base diff and DBA-owned files. All **477 P1 tracked files and35 P2 changed files** match their exact Git blobs after checkout CRLF normalization. No P1/P2 application, interface, Composer, bootstrap or CI source was edited by DBA. The local frozen assembly is evidence only, not a published integration branch or approved merge.

The SQL run used P1 bc2764a's PHP/runtime source. P1 published41b6c42 during verification: only workflow registration, the integration pin and snapshot discovery changed. Those three files were copied unchanged into the private assembly and all source comparisons rerun. The normalized application/config/migration/route/test/fixture fingerprint is identical before and after: **169 files, SHA256 `33c6e74e8f1ef01a45504d58d74ecc5132ef8079032bb6f45cde899455d57225`**. Documentation changes following the implementation do not alter that tested code.

Verified PHP8.5.12, Composer2.11.1, Node24.22.1, **P1 root Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43**, and genuine MySQL Community8.4.13/InnoDB/utf8mb4. All SQL used a loopback-only disposable `bc_dba_p1_*` database and a database-specific test account. MariaDB/SQLite were not used. Root dependencies were installed from P1's unchanged lock with `--no-scripts` and an external vendor directory; a private ignored vendor junction supplied framework/Testbench path resolution. No external provider credentials were loaded.

## Passing evidence and limits

| Gate | Result |
| --- | --- |
| P1 root combined PHPUnit | **135 tests,567 assertions,0 errors/failures/skips**,90.198046s JUnit test time; fail-on-warning enabled |
| Unit / Feature / Database |25/84;60/288;39/153 (tests/assertions) |
| P1 real-model Integration |2 tests/11 assertions; actual P1 role/resource/middleware with DBA models |
| New Compatibility suite |9 tests/31 assertions; SQL test doubles only, never production bindings |
| Current P1 generation/lifecycle |Real-model login/logout, role/status/generation revocation cases execute; no missing-generation skip remains |
| P2 portable runner |47 checks pass; expressly not SQL/HTTP integration |
| Frontend |Original405 regressions,14 P1 transport checks, sign-out/domain bridge and8 real P2 factories through shared transport pass |
| P2 adapter suite |8 tests pass,0 skips |
| Artifact/static checks |Both static Pages checks, both backend hydrated-artifact checks and421-file scanner pass on the private composition |
| DBA PHP style / dependencies |DBA-owned Pint passes; P1 root Composer strict validation and locked audit pass, no advisories |
| Migration immutability |All six original and both additive migrations are unchanged in this follow-up |

The full DBA suite retains fresh migration, seeded upgrade, destructive disposable downgrade, v2-preserving downgrade refusal/forward application, nonnegative/default0/integer generation, absent-generation denial, scoped constraints, immutable assignment/destination history, encrypted fictional dump/restore and5,000-row EXPLAIN checks. It also retains independent-process guard protocol races, provider timeout/uncertainty, rate/budget/low-balance, lease/fencing, independent channel replay, forgery, failed diagnostics and recovery. These delivery/guard fixtures do not prove P2's production domain services use the protocol.

New acceptance cases construct actual P1 typed objects and use real SQL, caller rollback, a second connection's visibility, the real dispatcher/receipt transaction, frozen event status after a later source status change, replay, account revocation, cross-scope rejection and invalid type/version/context/channel/template/size. An in-app-only writer passes without SMS permission. A separate explicit SMS-intent fixture creates a pending receipt/delivery with **zero HTTP calls, queued jobs or provider attempts**. Wrong interfaces, test-class production selections, independently committing writers, wrong persisted versions and no-op handlers fail. Named regressions reproduced the old hardcoded/raw-boundary gap, unrelated-event dispatch and noncanonical v2 UUID acceptance. The typed SQL fixture also exposed Eloquent dropping timestamp microseconds; OutboxEvent now preserves them.

The Compatibility/Fixtures implementations exist only to test the checker; the production resolver rejects them and has no CLI bypass. Recipient-account revocation is exercised here; production source-access revocation for every domain still requires P2's real handler/projections. Production audit writer persistence/rollback and actual-domain concurrency remain separate gates.

## Reproduction and current owner requests

Private bootstrap supplies APP_BASE_PATH (process + $_ENV), reviewed root autoloader, matching DB_TEST_*/DB_* for the same disposable database, DB_CONNECTION=mysql, DB_TEST_DISPOSABLE=1, MYSQL_INTEGRATION=1, P1_COMBINED_TESTS=1, MYSQL_TEST_BIN and disabled provider/module flags. Never publish that private bootstrap or credentials. From the local workspace root:

```powershell
# Root P1 settings plus Database/Integration/Compatibility discovery in a private generated profile.
php work/followup-root-vendor/phpunit/phpunit/phpunit --configuration work/dba-followup-verification/backend/phpunit.followup.xml --bootstrap <absolute>/work/followup-bootstrap.php --display-warnings --fail-on-warning --log-junit work/followup-combined-results.xml

# Corrected production gate, same explicit disposable runtime; current exit2 is required failure.
php -d auto_prepend_file=<absolute>/work/followup-bootstrap.php work/dba-followup-verification/backend/tests/Compatibility/check-shared-contracts.php

composer validate --strict --working-dir=work/dba-followup-verification/backend
composer audit --locked --working-dir=work/dba-followup-verification/backend
```

From the combined repository root, the following independently return0: `node scripts/run-tests.mjs`, `node scripts/check.mjs`, `node tests/frontend-artifact.mjs`, `node tests/backend-artifact.mjs`, `node --test tests/p2-adapters.mjs`, `node tests/domain-transport.mjs` and `php backend/tests/P2/run.php`. DBA Pint uses the reviewed root vendor executable against only DBA-owned app/database/config/routes/tests. Node24 does not support the older documented `--experimental-default-type=module` flag; the flag-free commands pass. Windows does not supply Linux-only symlink-branch evidence.

P1 now supplies root Testbench and its private snapshot preparer discovers Database **and Integration**; its workflow separately invokes the shared-contract CLI. These earlier requests are resolved. P1's current pin still points at DBA f641918d; request this implementation revision and **Compatibility suite discovery**, without changing P1's source from this branch. The private generated profile adds that suite for local evidence. See [runner setup](../tests/ci/README.md). No default combined-green CI claim follows from the local pass.

## Gates still blocked — retain draft status

The corrected CLI now resolves actual P1 bindings/configuration rather than guessing P2 portable wrapper names. Its exact current output is:

```text
BLOCKED: outbox_adapter_not_configured
BLOCKED: notification_adapter_not_configured
```

It exits2. The old five raw/wrapper-interface findings are historical, not the current configured-gate result. P1 has the seventh typed EventContext argument and structured AuditSummary; DBA no longer requests those as absent. DBA accepts RecipientReference without an audience argument: the authorized P2 writer derives/persists v2 audience and the handler reauthorizes current access. Interface-contract1 is compatible with persisted envelope2. See the [ratified DBA mapping](INTEGRATION-CONTRACT-V2.md).

P2 must deliver reviewed typed production Store/ReferenceData/audit/outbox/notification adapters, canonical UUID/names/physical-field mappings, current generation checks, the contract marker and real SQL tests. P1 then supplies reviewed bindings/enablement. No production fake is bound. The current EventContext can express incident stages/empty contexts; feedback kind/status, verification/personnel/facility/security payloads require deliberate bounded context and authorized projections/templates. Registry presence does not complete these families or authorize SMS.

Actual P1/P2 service races remain unavailable: last-slot and same-incident conflicts, stale revisions, role/status revocation, transfers, completion capacity release, facility deactivation/use and transactional audit/outbox rollback must run against the real implementations. The exact guard map is in the contract: staffing scope when relevant, sorted operations-person guards, current user/appointment reads, sorted incident/assignment rows, facility row; SOS retains its documented guard kind. Staffing3/6/6 and incident Responder2/Rescuer1 remain unchanged; emergency override stays disabled.

Combined read-only Pint on an isolated LF copy still fails only P2's `backend/app/Http/Controllers/P2/NotificationController.php` (`unary_operator_spaces`, `statement_indentation`, `not_operator_with_successor_space`). P2 owns that correction. DBA style passes. P1's safe Pages artifact and private Laravel public root remain required release gates; main still has the old whole-checkout upload. Five-role HTTP/E2E, actual host/storage/session/mail/worker operations and provider setup are not certified by these results. Urgent SMS remains Laravel worker directly to Semaphore; optional Make is nonurgent only.

## Preserved history

[Initial integration evidence](INTEGRATION-ACCEPTANCE-INITIAL.md) retains99 tests/421 assertions against older P1 and the old checker. [Original standalone evidence](ACCEPTANCE.md) retains55/218 against32ff81f. Neither is evidence for newer production integration. The current135/567 result uses P1's root runtime and includes new checker tests; it does not turn the missing production adapter gate green.
