# P1 validation — November 3, 2026

## November4 corrected composition

Original-browser follow-up: P1 96632bfe320997b3e239be6dbe9444f7ff18b151 / synthetic86bb7e9f9248bd0af1279570a75e18f4598d946b passes all required jobs in [CI41768154719](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41768154719):185/824/zero errors/failures/skips,10 original operational browser scenarios with4 screenshots, preserved5 identity scenarios with4 screenshots,19 owner Node entries,48 portable cases,4 P1 polling scenarios, genuine SQL/HTTP/deterministic races, configured production adapters and DBA manual order acceptance.707 source fingerprints preserve198 exact owner blobs and5 common-base overlays. Source hashes and sanitized browser evidence are uploaded separately. This run used DBA b9f7a7e; final latest9d6c699 test addition/results are recorded in PR49 without substituting an older pin.

P1 5447d8723c84caf98844df8a4276d3c21c727546, synthetic test merge14caaf96718096968c300b358e8e0edf7ddd7787; DBA b9f7a7e106fe7fe699abad1afd900c6141c38756; P2 acc9f56f37d34c96021c415ab81612bef92dac63. [Required CI41764879472](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41764879472) is green:183 tests/798 assertions/zero failures/errors/skips,19 P2 Node entries,48 portable checks, required actual-service lock regression and DBA manual review pass.198 exact DBA/P2 blobs and five common-base overlays are preserved among696 source fingerprints. Combined Pint216 files, dependencies, browser identity, artifacts and private-root gates pass. This supersedes the specific November3 late-participant lock blocker. Full original operational browser results are separately reported from the subsequent committed run in PR49.

Current baseline pins are in integration-lock.json. Final follow-up P1/synthetic-merge SHAs, CI totals and browser artifacts are recorded in [draft PR49](https://github.com/Butvh/barangay-connect-frontend/pull/49). A standalone green job is not combined acceptance.

## Current P2 production refresh

The current candidate is P2 `3d23092883e0f24aa89b4c86ce93862e35880e3e` with unchanged DBA `3d2b3a2dd6afa88ea34b9a441f48da3863787bbd`. It publishes the five production adapters, scoped readers, foundation-adapter checks and SQL/HTTP/race commands previously unavailable. [The binding review](P2-BINDINGS-REVIEW.md) records selection, isolation and commands. The combined job now runs the actual configured adapters, the unchanged DBA production probe and P2's original suites. An additional P1 actual-service lock-order regression remains a required release gate. No expected-failure suppression or owner patch is used.

Local PHP skips are reported because genuine MySQL/DBA composition is unavailable locally. Final measured totals, failing cases, source-preservation results and exact P1/synthetic-merge SHAs are published in PR49 after CI. Earlier results below remain historical evidence; absence of P2 adapters/commands is no longer a current blocker.

## Historical pre-fix baseline

The follow-up first repinned unchanged owner source to DBA f641918d37ff2ecd49cc47b3437bb0e159d6a10a and P2 c902d9f7239a8fcefdddf293fbc531876548c10a; P1 preflight head41b6c42fc536237b10034b3eb3fe058f9ee71fc1. [Run41604926592](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41604926592) tests clean synthetic merge5a9876c31f7c0a8278a8a371594797d81a44af60.

| Gate | Observed result / limit |
| --- | --- |
| Actual DBA identity | All six earlier lifecycle/revocation dependency skips execute successfully with the new migration/cast. They are no longer missing-column blockers. |
| Combined root + DBA discovery |124 tests,529 assertions,0 skips,1 error. Error is the unchanged DBA Integration/P1IdentityModelContractTest session fixture omitting identity_scope before expecting200. P1 requests the actual scope in that fixture and preserves the middleware. |
| P2 contract/adapter/shared HTTP |47 PHP checks,8 original adapters and8 actual-factory/shared-transport checks pass. The PHP runner is MemoryStore evidence, not SQL/domain races. |
| Existing frontend / artifacts | All405 original checks retained. Static scanner, allowlisted Pages artifact, backend module graph and private-path HTTP checks pass. |
| Owner preservation |135 pinned DBA/P2 source files retain their bytes; no owner code was changed. |
| Known owner gates | Read-only Pint fails on P2 NotificationController. DBA compatibility script reports four P2 writer/time/handler/canonical-fixture mismatches. All later independent gates still run; no failures are suppressed. |

## Current DBA revision and P1 checks

The latest pin is DBA3d2b3a2dd6afa88ea34b9a441f48da3863787bbd. It fixes the identity_scope fixture, accepts the typed PHP boundary, preserves microseconds/strict v2 UUIDv4 and replaces portable-wrapper checks with configured production-port SQL/receipt acceptance. Those earlier fixture/four-wrapper blocker statements in the historical run above are superseded. P1 preserves the reviewed incident-status/recipient constructors, adds all new Compatibility tests to discovery and retains the new CLI's truthful unconfigured-production-port failure.

## P1 follow-up implementation checks

Local owned PHP: **41 passed,20 skipped,123 assertions** before final committed CI. Skips require the actual combined MySQL/DBA fixture; no local real-MySQL server is claimed. The committed job must execute those tests against the pinned actual models. The six historical identity skips were changed to explicit schema/cast assertions in the combined profile.

Local JS: original405 checks plus16 HTTP/session/lifecycle checks, three new polling consistency scenarios, immutable submission intent, sign-out and bridge checks pass. Both frontend/backend artifact gates pass. Test-only Playwright1.64.1 is separately locked under tests/browser and installed outside the repository; npm audit reports no advisories. It is not a frontend runtime dependency.

Named failures reproduced before implementation:
- EventV2BoundaryTest: missing family-bound context factory and recipient serialization.
- SourceReferenceBoundaryTest: missing safe source gateway (after correcting the test fixture's GenericUser flags).
- IncidentPhotoContractTest: missing opaque typed receipt; implementation is a contract, not an actual upload service.
- polling-consistency: dirty/focus deferral consumed its revision; failed callback and account-switch cancellation were also covered.
- submission-intent: missing helper; the final check preserves one key/body/observed revision and rejects a new account or stale replacement.
- Real Chromium in run41608664260 caught two competing navigations after successful sign-out. A follow-up named regression also proved explicit sign-in was mislabeled as a background refresh. P1 now emits signed_in/signed_out and leaves explicit navigation to the awaited caller; background revocation/account-switch navigation remains automatic. The browser assertions are retained for rerun.

New real-SQL tests cover safe household/approval/visible-facility/personnel projections,403/cross-scope policy, locked original-generation comparison (including a stale REPEATABLE READ snapshot), stale-tab409 and photo503. Browser QA uses real random fictional DBA accounts, the original sign-in/sign-out forms and shared-origin cookies, captures screenshots and tests generation revocation/private paths. **Results of these added SQL/browser cases are reported from the committed CI, not inferred from the baseline above.**

## Disabled / unverified

Production identity/P2/dispatch flags remain false. The five P2 production classes are selected only in the isolated disposable-test profile; global factories/readers and original forms remain unregistered pending the lock-order correction and original-form acceptance. SQL/HTTP/race and DBA production-adapter results must be read from the current committed CI, not inferred from portable tests. No real worker/scheduler delivery is claimed.

Private incident-photo metadata/policy/byte service is absent; authenticated routes intentionally return503. DTO tests prove neither uploaded bytes nor download authorization/cleanup. P1 password/reset/verification/personnel/facility mutation services remain later reviewed slices; the test-only guarded generation change is not a production endpoint.

No shared/live migration, production host, deploy, main/teammate merge, real mail/SMS or Make activation. Existing private .env/APP_KEY are preserved. Public artifacts exclude backend/vendor/private files/config/logs/dumps/tests and the backend-mode seed; Laravel's only web root is backend/public.
