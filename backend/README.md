# P2 backend integration candidate

P2 owns the operations/civic/report services, relational adapters, transactional writer implementations, in-app handler, route fragments and frontend adapters/readers. P1 owns Laravel/authentication/shared registration; DBA owns models/migrations/guards and dispatch/Semaphore/Make. Do not scaffold another application or schema over these files.

Read [the current compatibility matrix](../docs/P2-COMPATIBILITY.md) for actual tested revisions, SQL/HTTP/race evidence, reviewed binding requests and remaining gates. [Endpoint and facade handoff](../docs/P2-BACKEND-INTEGRATION.md) retains API details.

Portable checks from repository root:

    php backend/tests/P2/run.php
    node --test tests/p2-adapters.mjs

Actual SQL tests require the private P1+DBA+P2 composition and a dedicated MySQL8.4 test instance:

    ./backend/tests/P2/run-sql.ps1 -Php <php-executable> -Mysql <mysql-client> -Port <dedicated-port>

The runner creates fresh p2_test_* databases and retains evidence. Never target shared data. MemoryStore and fictional references live only in tests. P2 provider requires and preserves P1-selected bindings; it does not install a fake or override configuration.

P2 consumes P1's actor-bound safe SourceReferences and supplies the latest-assignment policy. The frontend demo remains unchanged and production integrations remain disabled pending owner binding review, original-form registration, private photo bytes and cross-owner acceptance. No real SMS/mail, live migration, deployment or main merge occurs.

DBA's unchanged production-adapter probe is invoked by `php backend/tests/P2/check-shared.php` after explicitly configuring/migrating a NEW disposable bc_dba_p2_* MySQL database with APP_ENV=testing and DB_TEST_DISPOSABLE=1. The runner supplies only candidate production bindings; DBA owns the checker and dispatcher. It intentionally requests no SMS intent.
