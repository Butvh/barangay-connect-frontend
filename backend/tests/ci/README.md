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

## November 3 follow-up: current P1 root runtime

P1 #49 `c0a32cfa` locks **Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43** in the root application. The missing-Testbench request is resolved. The independent harness above remains useful for DBA-only checks; it is not required to replace P1's current root runtime. Do not edit P1 Composer/bootstrap/CI.

Install P1's unchanged root lock with an external COMPOSER_VENDOR_DIR and `composer install --no-scripts`. The root autoloader's App/Tests paths must resolve to the actual private composition. Root framework/Testbench loading must also resolve that same vendor directory (the local Windows snapshot used an ignored private vendor junction). This is runtime setup, not a committed application/source change.

P1's `scripts/prepare-integration.mjs` discovers Unit, Feature, Database, Integration **and Compatibility**. Its newer aec4e78 update pins P2 `3d23092`, updates that file allowlist and supplies P2_TEST_BINDINGS only behind disposable/disabled-provider guards; those earlier requests are resolved. It also adds the required failing CombinedP2LockOrderTest. Request this DBA pin and P2's future corrected commit. The local private composition preserves current P1 files and equivalent suite discovery. No P1 Composer/bootstrap/CI is edited here, and no green-production claim follows from the older passing baseline.

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

The full P1 c0a32cf/DBA baseline includes IncidentPhotoProposalTest and DeliveryAcceptanceTest:178 tests/781 assertions,0 failures/errors/skips. P1 aec4e78 adds its required lock-order failure; see [latest exact totals](../../docs/INTEGRATION-ACCEPTANCE.md). The metadata candidate is **not an active migration**; only its disposable test calls database/proposals/incident-photo-metadata.php directly. See [unratified proposal](../../docs/INCIDENT-PHOTO-METADATA-PROPOSAL.md).

Run the separate unresolved order gate from a migrated disposable composition with IDENTITY_ENABLED=true, exact DB_DATABASE=DB_TEST_DATABASE under p2_test_*, APP_ENV=testing and DB_TEST_DISPOSABLE=1:

```powershell
php backend/tests/P2/sql.php
php backend/tests/Review/p2-lock-order.php
```

The first requires an initially empty database and runs P2's actual33 cases; the second adds its own fictional rows, traces a real acknowledgment and races actual response/details processes. It returns2 while late user locks remain, independently of passing PHPUnit. P2 must supply the corrected commit and failing concurrency regression; these review files modify no P1/P2 service. See [lock findings/required rerun](../../docs/P2-LOCK-ORDER-REVIEW.md) and [fake delivery evidence/SMS-intent request](../../docs/DELIVERY-FAKE-ACCEPTANCE.md).

The probe uses isolated fictional SQL rows, independent-connection visibility/rollback checks, the real targeted dispatcher/receipt transaction, event-time snapshots after source status changes, replay, recipient-account revocation, cross-scope rejection and invalid persisted contracts. It cleans only its known fixture IDs. HTTP/queue are faked and SMS attempts must stay zero. `--sms-intent` separately verifies pending SMS intent; an in-app-only implementation need not support it to pass the default contract. Unit/SQL test doubles in Compatibility/Fixtures validate the checker itself and cannot certify an absent production adapter. P2's existing MemoryStore runner remains separate, as do production audit validation, source-access revocation and actual-domain SQL race/E2E gates.

See [typed mapping and lock protocol](../../docs/INTEGRATION-CONTRACT-V2.md). P2 owns the production Store/ReferenceData/audit/outbox/notification adapters under this assignment.
