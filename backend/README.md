# P2 module preparation

This directory contains **P2 modules, not a Laravel application**. P1 owns the application foundation/authentication and DBA owns schema/models/migrations and messaging transport. Do not run `create-project` over these files without preserving them.

Start with [the integration handoff](../docs/P2-BACKEND-INTEGRATION.md) for registration, API examples, logical storage fields, locking/index requirements, frontend adapter signatures and remaining acceptance gates.

Runnable isolated checks from the repository root:

```powershell
php backend/tests/P2/run.php
node --test tests/p2-adapters.mjs
```

The in-memory Store and fictional reference gateway live **only in tests**. They are not production database/authentication implementations. No binding to them is registered in the provider. Passing these tests does not prove MySQL concurrency, Laravel HTTP authorization or backend browser integration. Those must be tested after the shared dependencies arrive.

P2 does not provide a Semaphore client, Make endpoint, dispatcher or SMS job. No real SMS/mail was sent. The existing frontend remains in demo mode.
