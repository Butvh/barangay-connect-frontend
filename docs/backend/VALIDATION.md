# Initial foundation validation — November 2, 2026

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
