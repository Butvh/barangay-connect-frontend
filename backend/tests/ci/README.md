# DBA test harness and MySQL fixture

This directory is test infrastructure, not the Laravel application. P1 owns backend/composer.json, application bootstrap, shared CI and Pages. Do not copy a Laravel scaffold into this branch. This harness verifies the DBA files before P1's application is available. PHP 8.5.12, Laravel 13.39.0, Testbench 11.3.0 and MySQL Community 8.4.13 were used locally; the team/host runtime pairing still requires agreement.

Install this Composer project with an **external vendor directory**, e.g. set COMPOSER_VENDOR_DIR to an absolute private work directory, then run `composer install --working-dir=backend/tests/ci`. Its locked dependencies are test-only. Never place vendor in the frontend artifact.

Create a random disposable password. Set DB_TEST_PASSWORD and DB_TEST_PORT, then `docker compose -f backend/tests/ci/mysql.compose.yaml up -d --wait` if Docker is available. The volume is ephemeral, the port binds loopback and the test user has only the test database. Alternatively use a private MySQL 8.4 instance. Normal CI must not have any live SMS/Make secrets.

Environment for the runner:

```dotenv
DB_TEST_DISPOSABLE=1
DB_TEST_HOST=127.0.0.1
DB_TEST_PORT=33384
DB_TEST_DATABASE=bc_dba_test
DB_TEST_USERNAME=bc_dba_test
DB_TEST_PASSWORD=
DBA_TEST_AUTOLOAD=/absolute/private/vendor/autoload.php
MYSQL_TEST_BIN=/absolute/path/to/mysql/bin
```

Run the external vendor's `phpunit` with `--bootstrap /absolute/repo/backend/tests/ci/bootstrap.php /absolute/repo/backend/tests`. Use absolute paths, including on Windows. MYSQL_TEST_BIN enables the encrypted dump/restore test and must contain mysql and mysqldump. Both are required in the integrated CI gate; missing settings are a blocker, not acceptance. These tests truncate **every table in the explicitly selected disposable database**. They never target production.

Run `pint --test backend/app backend/database backend/routes backend/config/messaging.php backend/tests` from the external vendor bin directory, then `composer audit --locked --working-dir=backend/tests/ci`. P1 should wire these into the shared workflow after reviewing the target PHP/framework version and safe Pages artifact. Existing frontend gates remain `node scripts/run-tests.mjs` and `node scripts/check.mjs`.

`AppointmentConcurrencyTest` starts independent PHP processes behind a file barrier, using committed fixtures. It proves the proposed guard/lock protocol and constraints. It does **not** exercise P1/P2 domain services: those owners must use these guards and add their integrated authorization/revision/workflow race tests. No report queries or domain controllers are implemented here.

## November 4 independent acceptance: current P1 root runtime

**November4 independent refresh:** P1 5447d87 / P2 acc9f56 / DBA review passes184 tests/811 assertions, zero failures/errors/skips. The old P2 lock failure is superseded for this candidate. The unchanged manual gate and deterministic one-attempt regression pass with enabled lock_deadlocks0->0. The new lower-ID transfer case passes1/12. See [current exact evidence](../../docs/INTEGRATION-ACCEPTANCE.md); historical counts below remain dated setup context. P1's published detector fix passes the retained scope-binding counterexample and helper tests3/7, and its6 snapshot tests pass.

P1 #49 `5447d87` retains **Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43** in the root application. The missing-Testbench request is resolved. The independent harness above remains useful for DBA-only checks; it does not replace P1's current root runtime. Do not edit P1 Composer/bootstrap/CI.

Install P1's unchanged root lock with an external COMPOSER_VENDOR_DIR and `composer install --no-scripts`. The root autoloader's App/Tests paths must resolve to the actual private composition. Root framework/Testbench loading must also resolve that same vendor directory (the local Windows snapshot used an ignored private vendor junction). This is runtime setup, not a committed application/source change.

P1's current preparer discovers Unit, Feature, Database, Integration **and Compatibility**, pins P2 acc9f56 and safely selects its five common-base operational overlays. P2_TEST_BINDINGS is restricted to disposable/disabled-provider builds. The required CombinedP2LockOrderTest and its fail-closed binding extractor pass. Request the new DBA pin; the current P2 pin/allowlist and P1 detector requests are resolved. The private composition preserves exact owner source and equivalent discovery; no shared source/CI or production enablement is changed by DBA.

For all real-model tests set DB_TEST_DISPOSABLE=1, MYSQL_INTEGRATION=1 and P1_COMBINED_TESTS=1. Use a dedicated `bc_dba_p1_*` MySQL8.4 database; set both DB_TEST_* and matching DB_* including DB_CONNECTION=mysql. Set APP_BASE_PATH in both the process environment and $_ENV to the combined backend, and DBA_TEST_AUTOLOAD to its reviewed root autoloader. MYSQL_TEST_BIN must include mysql/mysqldump so encrypted restore is exercised. Keep SMS_ENABLED/MAKE_ENABLED/P2_MODULES_ENABLED/OUTBOX_DISPATCH_ENABLED false. A private bootstrap may supply these explicit test settings. [Current acceptance](../../docs/INTEGRATION-ACCEPTANCE.md) records the exact run and all zero skips.

## Configured typed SQL acceptance command

Run the CLI **outside any open transaction**, against that same explicitly disposable migrated database:

```powershell
php backend/tests/Compatibility/check-shared-contracts.php
# Optional reviewed explicit implementation classes; these are actual production classes, not wrappers to guess:
php backend/tests/Compatibility/check-shared-contracts.php --app-base=<absolute-combined-backend> --outbox=<FQCN> --handler=<FQCN>
# Separate authorized SMS-intent case; still fake transport and zero provider sends:
php backend/tests/Compatibility/check-shared-contracts.php --sms-intent
```

The default fixture uses P1 EventId, RecipientReference(inApp=true,sms=false), DateTimeImmutable and EventContext. It resolves the actual P1 interface binding first, then `integration.outbox_adapter`/`integration.notification_adapter`, or explicit validated classes. Tests/ classes and sources outside app/ cannot be selected as production. There is no CLI switch to bypass that restriction. Invalid/missing adapters return exit2 with static diagnostics. Bare production config remains unselected. P2's actual TypedOutboxWriter/InAppHandler now pass with its explicit disposable `tests/P2/check-shared.php` bindings; they are real app classes, not checker doubles. The separate SMS-intent case remains blocked because that writer deliberately accepts only in-app intent.

## Lock/photo/delivery review

The final184/811 profile retains IncidentPhotoProposalTest, DeliveryAcceptanceTest, the P1 required gate and every existing suite, plus the one actual lower-ID transfer case. Older failures/totals remain dated evidence in [current acceptance](../../docs/INTEGRATION-ACCEPTANCE.md). The metadata candidate is **not an active migration**; only its disposable test calls database/proposals/incident-photo-metadata.php directly. See [unratified proposal](../../docs/INCIDENT-PHOTO-METADATA-PROPOSAL.md).

Run the separate actual protocol gate from a migrated disposable composition with IDENTITY_ENABLED=true, exact DB_DATABASE=DB_TEST_DATABASE under p2_test_*, APP_ENV=testing and DB_TEST_DISPOSABLE=1:

```powershell
php backend/tests/P2/sql.php
php backend/tests/Review/p2-lock-order.php
```

The first requires an initially empty database and now runs P2's actual41 cases plus two original-controller workflow branches. The second remains unchanged, adds its own fictional rows and races actual response/details processes; it now returns0 with no late users on acc9f56. P2's deterministic sql-lock-order.php uses independent actual services and a one-attempt outer transaction, with committed guards before barriers so gap-lock setup does not mask the schedule. Read enabled INFORMATION_SCHEMA.INNODB_METRICS.lock_deadlocks before/after with a separate private observer; no nonexistent status counter or retry count substitutes for it. These review files modify no P1/P2 service. See [scoped acceptance](../../docs/P2-LOCK-ORDER-REVIEW.md) and [photo/SMS ratification dependencies](../../docs/PHOTO-SMS-CONTRACT-DECISIONS.md). The proposal remains outside active migrations, and actual SMS intent remains unsupported until approved producer fixtures arrive.

The probe uses isolated fictional SQL rows, independent-connection visibility/rollback checks, the real targeted dispatcher/receipt transaction, event-time snapshots after source status changes, replay, recipient-account revocation, cross-scope rejection and invalid persisted contracts. It cleans only its known fixture IDs. HTTP/queue are faked and SMS attempts must stay zero. `--sms-intent` separately verifies pending SMS intent; an in-app-only implementation need not support it to pass the default contract. Unit/SQL test doubles in Compatibility/Fixtures validate the checker itself and cannot certify an absent production adapter. P2's existing MemoryStore runner remains separate, as do production audit validation, source-access revocation and actual-domain SQL race/E2E gates.

See [typed mapping and lock protocol](../../docs/INTEGRATION-CONTRACT-V2.md). P2 owns the production Store/ReferenceData/audit/outbox/notification adapters under this assignment.
