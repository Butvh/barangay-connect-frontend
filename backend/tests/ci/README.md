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
