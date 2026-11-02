# P1 foundation validation

## November 3 compatibility update

See [candidate canonical matrix / owner requests](COMPATIBILITY.md) and `integration-lock.json` for the pinned P1/DBA/P2 baselines. The focused slice adds tenant/generation/stale-tab regressions, minimal current/locked reference tests, typed event validation, explicit module/reader gates and real shared transport composition.

Local P1 checks retain all405 original frontend checks; the transport/lifecycle suite now has14 checks plus the domain bridge/sign-out tests. P2's untouched snapshot suite passes47 PHP checks and8 adapter tests, plus8 new checks exercising its actual factories through P1's real shared HTTP implementation. Normal root tests deliberately skip unavailable combined-DB cases. Final committed CI totals and each positive real-model skip are reported in PR49; green standalone CI is not evidence of domain compatibility.

Local root Laravel result: **35 passed, 9 skipped, 105 assertions**. The skips are eight combined-model cases requiring the disposable MySQL job and one engine check. Composer strict validation/platform checks/locked audit, Pint, both artifact gates and the414-file scanner pass. Live loopback probes in the private development snapshot pass cookie continuity across clients, CSRF419, actual P2 adapter401, disabled-login503 and private-path404 checks. All120 pinned DBA/P2 source files retain their SHA256 hashes. That snapshot is marked dirty development evidence; the committed CI run supplies reproducible SQL evidence.

Local combined discovery without MySQL: **99 tests, 121 assertions, 58 skipped**; no SQL pass is claimed from this run. Combined read-only Pint finds three formatting rules in P2's unchanged NotificationController.php (unary_operator_spaces, statement_indentation, not_operator_with_successor_space). This is an explicit P2 owner request and the combined gate remains blocking; P1 has not edited that file or suppressed the check.

The new combined job preserves both root and DBA suites on disposable MySQL8.4, adds actual DBA-model negative/positive-conditional session tests, stages the backend frontend, executes live loopback HTTP probes through the actual P2 factories, and verifies every owner source hash. Missing auth_version/cast blocks the positive lifecycle and five revocation cases; no test migration or fake production authentication is substituted. Workers, scheduled delivery, full P2 Store/domain races and live external services remain unverified/disabled.

The November2 table below is historical evidence, not the current slice's completion claim.

Environment: Windows, PHP8.5.12, Composer2.11.1, Node22.14.0. Base main `3014ad6`. DBA draft PR48 was inspected for contract compatibility but not imported; no production host assumed.

| Check | Observed result / limit |
| --- | --- |
| Existing frontend suite | Original405 checks pass: core354, facility4, SOS5, Alert Detail6, verification7, profile12, recovery9, recovery dialog8. |
| New transport/session lifecycle | Same-origin/CSRF, safe status mapping, malformed response and network failures, no write replay, hydration, logout failure, polling revocation/teardown tests pass. |
| Pages artifact | Allowlist and stale-output/destination safety tests pass; root/backend/secrets/docs/tests/uploads/vendor excluded. |
| Backend artifact/module graph | Runtime switches only in generated copy; seed excluded; actual staged module imports hydrate `/me` before guards, read no browser storage, and use server time. |
| Sign-out interaction | Real helper waits for invalidation; failed invalidation retains the page with safe error copy. |
| Laravel tests | 18 pass /75 assertions, including the DBA account-status/relational-appointment projection and isolated encryption key. One actual-MySQL engine test explicitly skipped locally because no MySQL server is available. Test-only user provider covers guard behavior; it is not real MySQL persistence. |
| Composer | Strict validation/platform checks pass; locked audit reports no security advisories at time of run. |
| Pint / diff | Formatting and whitespace checks pass. |
| Live local HTTP on temporary loopback port8011 | Session/CSRF cookies issued; missing-token POST419; configured-disabled login503; forged demo header cannot authenticate `/me` (401); frontend HTML/runtime served. |
| Private-path HTTP probes | `/.env`, `/backend/.env`, `/vendor/autoload.php`, `/storage/private.pdf`, `/frontend/assets/js/data/seed.js` return404 through Laravel's public root. |

CI adds actual MySQL8.4 engine/InnoDB verification. That engine check must pass in CI; this table does not claim a CI result before the PR runs. MySQL domain persistence/races, DBA model integration, real sign-in browser walkthroughs, upload authorization/cleanup, queued mail/SMS/Make delivery, production hosting and integrated-main acceptance remain pending their reviewed slices.

Named failing checks during development: transport tests initially could not import the absent adapter; PHP session tests exposed the test-provider mismatch on logout; the private-storage test caught Laravel merging its public disk default; the profile regression suite caught the newly imported sign-out helper missing from its module harness; the fresh DBA contract check exposed an account-status mismatch before publication. Each was corrected and targeted checks rerun. No framework guard was disabled to make the tests pass.
