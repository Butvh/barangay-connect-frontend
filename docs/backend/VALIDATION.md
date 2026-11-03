# P1 validation — November 3, 2026

Current baseline pins are in integration-lock.json. Final follow-up P1/synthetic-merge SHAs, CI totals and browser artifacts are recorded in [draft PR49](https://github.com/Butvh/barangay-connect-frontend/pull/49). A standalone green job is not combined acceptance.

## Current measured baseline

The follow-up first repinned unchanged owner source to DBA f641918d37ff2ecd49cc47b3437bb0e159d6a10a and P2 c902d9f7239a8fcefdddf293fbc531876548c10a; P1 preflight head41b6c42fc536237b10034b3eb3fe058f9ee71fc1. [Run41604926592](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41604926592) tests clean synthetic merge5a9876c31f7c0a8278a8a371594797d81a44af60.

| Gate | Observed result / limit |
| --- | --- |
| Actual DBA identity | All six earlier lifecycle/revocation dependency skips execute successfully with the new migration/cast. They are no longer missing-column blockers. |
| Combined root + DBA discovery |124 tests,529 assertions,0 skips,1 error. Error is the unchanged DBA Integration/P1IdentityModelContractTest session fixture omitting identity_scope before expecting200. P1 requests the actual scope in that fixture and preserves the middleware. |
| P2 contract/adapter/shared HTTP |47 PHP checks,8 original adapters and8 actual-factory/shared-transport checks pass. The PHP runner is MemoryStore evidence, not SQL/domain races. |
| Existing frontend / artifacts | All405 original checks retained. Static scanner, allowlisted Pages artifact, backend module graph and private-path HTTP checks pass. |
| Owner preservation |135 pinned DBA/P2 source files retain their bytes; no owner code was changed. |
| Known owner gates | Read-only Pint fails on P2 NotificationController. DBA compatibility script reports four P2 writer/time/handler/canonical-fixture mismatches. All later independent gates still run; no failures are suppressed. |

## P1 follow-up implementation checks

Local owned PHP: **40 passed,20 skipped,119 assertions** before final committed CI. Skips require the actual combined MySQL/DBA fixture; no local real-MySQL server is claimed. The committed job must execute those tests against the pinned actual models. The six historical identity skips were changed to explicit schema/cast assertions in the combined profile.

Local JS: original405 checks plus15 HTTP/session/lifecycle checks, three new polling consistency scenarios, immutable submission intent, sign-out and bridge checks pass. Both frontend/backend artifact gates pass. Test-only Playwright1.64.1 is separately locked under tests/browser and installed outside the repository; npm audit reports no advisories. It is not a frontend runtime dependency.

Named failures reproduced before implementation:
- EventV2BoundaryTest: missing family-bound context factory and recipient serialization.
- SourceReferenceBoundaryTest: missing safe source gateway (after correcting the test fixture's GenericUser flags).
- IncidentPhotoContractTest: missing opaque typed receipt; implementation is a contract, not an actual upload service.
- polling-consistency: dirty/focus deferral consumed its revision; failed callback and account-switch cancellation were also covered.
- submission-intent: missing helper; the final check preserves one key/body/observed revision and rejects a new account or stale replacement.
- Real Chromium in run41608664260 caught two competing navigations after successful sign-out. P1 now emits signed_out after clearing identity and leaves explicit navigation to the awaited caller; revocation/account-switch navigation remains automatic. The browser assertion was retained for rerun.

New real-SQL tests cover safe household/approval/visible-facility/personnel projections,403/cross-scope policy, locked original-generation comparison (including a stale REPEATABLE READ snapshot), stale-tab409 and photo503. Browser QA uses real random fictional DBA accounts, the original sign-in/sign-out forms and shared-origin cookies, captures screenshots and tests generation revocation/private paths. **Results of these added SQL/browser cases are reported from the committed CI, not inferred from the baseline above.**

## Disabled / unverified

Production identity/P2/dispatch flags remain false; P2 Store/reference/writer/handler/readers and global factories are not registered. P2 has published no actual SQL/HTTP/race commands at its pinned head. No actual-domain race acceptance or real worker/scheduler delivery is claimed.

Private incident-photo metadata/policy/byte service is absent; authenticated routes intentionally return503. DTO tests prove neither uploaded bytes nor download authorization/cleanup. P1 password/reset/verification/personnel/facility mutation services remain later reviewed slices; the test-only guarded generation change is not a production endpoint.

No shared/live migration, production host, deploy, main/teammate merge, real mail/SMS or Make activation. Existing private .env/APP_KEY are preserved. Public artifacts exclude backend/vendor/private files/config/logs/dumps/tests and the backend-mode seed; Laravel's only web root is backend/public.
