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

## November 3 combined runtime handoff to P1

P1 #49 locks Laravel13.39.0/PHPUnit12.5.43; this separate Testbench11.3.0 harness locks the same Laravel13.39.0 with PHPUnit13.4.6. The root application does **not** currently install Testbench. Running its unchanged default PHPUnit discovery over combined Unit/Feature files fails at Orchestra\\Testbench\\TestCase. This is a real CI-registration gap, not a passed combined gate. Do not edit P1's Composer/bootstrap/CI from the DBA branch.

The reviewed approach uses two external vendor profiles on the same combined source checkout and MySQL engine, leaving P1's lock unchanged:

1. Install P1's root lock with an external COMPOSER_VENDOR_DIR and `composer install --no-scripts`; bootstrap its external autoloader explicitly. Run its exact tests with the root phpunit.xml and explicit existing paths `tests/Feature/SessionBoundaryTest.php tests/Feature/MySqlEngineTest.php tests/Unit/FoundationSecurityTest.php`. With MYSQL_INTEGRATION=1 these include the genuine-MySQL engine test.
2. Install the locked DBA test project in this directory with another external vendor directory. Set DBA_TEST_AUTOLOAD, APP_BASE_PATH (absolute combined backend path, also visible in $_ENV), DB_TEST_* and corresponding DB_* to the same disposable MySQL. Set MYSQL_INTEGRATION=1. Run that vendor's PHPUnit using `--configuration backend/tests/ci/phpunit.combined.xml` from the repository root. The config includes P1 Unit/Feature, DBA MySQL/delivery/Integration tests. Source App/Tests autoload maps must point at the combined checkout. `P1IdentityModelContractTest` checks real P1 role/resource/middleware with real DBA User rows; it explicitly skips when P1 classes are absent in standalone DBA source.
3. Run `php backend/tests/P2/run.php` for P2's existing MemoryStore checks. They remain isolated contract tests. Run `php backend/tests/Compatibility/check-shared-contracts.php` separately on the combined autoloader; **it must pass before integration**. It currently reports the actual writer/handler contract gaps. Do not count a passing MemoryStore runner as actual-domain MySQL races.

P1 must register both jobs/profiles, or jointly review an alternative root Testbench/PHPUnit update and rerun it. Its existing root phpunit.xml also omits tests/Database, so simply making class loading succeed is insufficient. The combined config supplied here is DBA-owned review material; no shared workflow or dependency file was edited. No fake handler, MemoryStore or test password has a production binding. Extend the combined gate with P2's real SQL domain-race tests once their repository/ReferenceData implementations exist.

See backend/docs/INTEGRATION-CONTRACT-V2.md for the additive migration order, required P1 interface/context/audience changes and precise P2 persistence/lock map.
