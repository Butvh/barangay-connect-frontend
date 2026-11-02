# DBA acceptance evidence — November 2, 2026

Historical standalone evidence for head `32ff81f4cb1c7e2f704dc5f93168f1261787e376`. See [November 3 integration acceptance](INTEGRATION-ACCEPTANCE.md) for the new additive changes, combined source inputs, commands, results and unresolved P1/P2 compatibility gates. The old55-test result below must not be presented as current combined acceptance.

Branch: `codex/backend-db-schema-delivery`. Base and rechecked remote main: `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. Only `backend/**` is added; existing frontend, workflows, shared bootstrap and P1/P2 domain implementation remain unchanged.

## Implemented and locally verified

- Six ordered migrations create 38 genuine MySQL tables, including scoped composite FKs, nullable generated unique active keys, explicit check constraints, circular verification FK ordering, framework persistence and independent messaging receipts/attempts.
- Models/casts/relationships, immutable-history hooks, fictional two-barangay scenario seeder, four useful factories, lock helpers, schema dictionary and DTO/event/lock proposals.
- One outbox dispatcher and SMS ledger, direct urgent route, Make-mediated nonurgent route, authenticated idempotent callback, encrypted destinations, approved-recipient/segment-budget guards, shared endpoint rate gates, bounded retries, uncertain timeout/restart handling and status reconciliation.
- Secret-free Make import candidate and manual configuration instructions; queue, credential rotation, incident, migration and restore runbooks.

| Gate | Actual result |
| --- | --- |
| PHP/Composer verification environment | PHP 8.5.12; Composer 2.11.1 |
| Test-only framework | Laravel 13.39.0; Testbench 11.3.0; PHPUnit 13.4.6 |
| SELECT VERSION() | MySQL Community 8.4.13; loopback-only disposable instance; InnoDB/utf8mb4 verified |
| DBA test suite | **55 tests, 218 assertions, 0 failures/errors/skips**, 48.893 seconds |
| Migration/upgrade | Fresh schema, identity-populated ordered upgrade, seeded rollback/recreate pass |
| Database integrity | Scope/orphan rejection, appointment/active-assignment/current-verification uniqueness, submission ownership, zero/null/bounds pins, counts/ratings, explicit response evidence and deletion restrictions pass |
| Concurrent independent-process fixtures | Last staffing slot/first guard, last dispatch slot across different incidents, dispatch/removal, transfer/completion, review/resubmit, deactivate/destination, repeated SOS, double reset consumption pass |
| Backup/restore | Encrypted fictional SQL/file package restored using MySQL clients; counts/FK orphan join/file bytes verified; **2.257 seconds** in the local test; temporary dump and option files removed |
| Focused EXPLAIN | 5,000 synthetic historical incidents; scoped status/time query selects composite index with estimated rows <100; outbox ready index available |
| Messaging fakes | Rollback/no-send, duplicate jobs, channel completion, expired claims, timeout hold, malformed response, low balance, 429 Retry-After, disabled/budget guards, provider-status reconciliation pass |
| Urgent isolation | Backlog of 501 unconfirmed Make events cannot occupy the urgent SMS scan; regression failed before fix and passes after |
| Make callback fakes | Duplicate/replay, forged credentials, stale timestamp, cross-scope and arbitrary relay rejection, minimal authenticated webhook mapping and urgent route exclusion pass |
| Frontend regression suite | Existing **405 checks pass** |
| Static scanner | Pass; unchanged checks scan frontend and new tracked source without weakening exclusions |
| Laravel Pint | Pass on DBA PHP files |
| Composer | Test harness manifest valid; locked dependency audit reports no advisories |
| Patch/ownership check | Whitespace check passes; only DBA backend additions; no application scaffold/controllers/adapters/reports added |

The backend tests use Orchestra Testbench outside P1's application, faked provider HTTP, a test-double P2 handler, and committed fictional fixtures. Concurrency tests exercise the **shared protocol**, not the absent P1/P2 domain services. The tested harness is pinned in tests/ci/composer.lock, separate from P1's future application lock. These results do not prove a working integrated application or hosting setup.

## Required integration and external gates

1. **P1 foundation/Pages blocker:** main still uploads `path: .` to Pages. P1 must install an allowlisted frontend artifact before this backend branch merges. P1 also creates the Laravel scaffold, reconciles generated migrations/models, agrees host PHP/framework/MySQL pairing and reviews shared configuration.
2. **P1/P2 contract review:** proposed DTO columns, lock ordering and the two initial event types require agreement. P2 supplies transactional audit/outbox writers, recipient eligibility and the real in-app handler; P1 binds/registers routes, scheduler and queues. Other domain event types must be explicitly versioned/allowlisted. Integrated policy, revision, domain race and adapter tests remain those owners' work.
3. **Rule decisions:** Secretary occupied-vs-active discrepancy and Captain emergency override remain pending ratification. Metadata is retained; no DBA code enables an override.
4. **Live Semaphore:** no account key, sender approval or specifically authorized recipient/segment budget was provided. No SMS was sent, credits purchased, handset confirmation recorded or provider live status verified.
5. **Live Make:** no workspace access supplied. Blueprint import/credential setup/error-handler configuration and real execution remain unverified. Tested fakes are not a configured scenario. The blueprint is explicitly an unconfigured candidate.
6. **Hosting/release:** private storage and actual-host encrypted backup restoration, worker supervision/cron/alerts, document root, HTTPS, session/CSRF/CORS configuration and complete five-role E2E are unverified dependencies. The Compose CI fixture is supplied but was not run locally; equivalent genuine MySQL tests ran on the portable Windows server.

This branch is suitable for **draft contract/code review**. It is not a production-ready release and must not merge until the foundation and integrated required-green gates are satisfied. Do not rewrite these migrations after sharing/applying them; use reviewed additive follow-ups and forward fixes.
