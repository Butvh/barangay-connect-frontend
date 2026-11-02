# Backend work log

## November 3, 2026 — focused compatibility slice

- Rechecked main and PR48/49/50 at the pinned review SHAs; preserved a clean P1 branch and every DBA/P2 source byte.
- Added the candidate canonical compatibility matrix and exact requests; no unilateral owner agreement or substitute production writer/Store.
- Fixed tenant-bound session snapshots, negative generation denial and stale-tab write preconditions; supplied private effective-identity/current-locked-reference boundaries.
- Added the P2 envelope/path/header bridge and actual factory composition, preserving submit keys and observed revisions; missing readers/modules explicitly unavailable.
- Gated provider/routes/handler/scheduler registration on reviewed implementations, retained cookie/CSRF authentication and stateless DBA callbacks, and set the database retry window to180 seconds. All enablement flags remain false.
- Added the exact Testbench dependency and pinned private snapshot/combined CI job, retaining existing frontend, P2 and DBA suites. Real DBA-model positive auth/revocation checks remain conditional on the missing DBA generation field/cast; no substitute migration or shared-database write.

## November 2, 2026 — initial P1 foundation

- Started from main `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`; its tree matches audited `928505bcecad3ba153a764b86c51718c35de7695`.
- Commit `673f31d` isolates the allowlisted Pages artifact **before** backend files were added. No backend/docs/tests/uploads/vendor/dumps enter that artifact.
- Added Laravel 13 / verified PHP8.5 scaffold, lockfile, private-storage configuration, safe error envelopes, session/CSRF routes, guard/revocation checks, Argon2id and throttles.
- Added backend-mode hydration, same-origin HTTP, unavailable-domain seams, server clock, polling lifecycle and awaited sign out. Existing design/navigation remain unchanged in demo mode.
- Added artifact/module-graph and session/security tests. Backend domain and MySQL race acceptance remain pending DBA/P2 integration, not implied by isolated guard tests.
- Added shared proposals for event interfaces, model/cast needs, lock ordering, endpoint/facade mapping and reproducible local setup. No migrations, models, provider pipeline or P2 business implementation was created.
- No production deploy, real mail/SMS, teammate branch merge or schema write performed.
- Inspected newly published DBA draft PR48 (`32ff81f`); adapted only P1 projection/bootstrap/contracts for relational appointments, account-status denial, recipient channels and stateless integration routing. Requested a DBA-owned security-generation field and joint event/test-harness review before identity/domain enablement.
- First CI run completed the genuine MySQL8.4.13 check but exposed suppressed missing-.env warnings. CI now creates its placeholder environment and fails on test warnings; isolated tests force a public test-only encryption key instead of inheriting a developer key.
