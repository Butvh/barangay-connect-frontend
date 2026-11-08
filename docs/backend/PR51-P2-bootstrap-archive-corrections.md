# PR51 P2 bootstrap and civic-query corrections

Base: `c7026ab3b678ae44036a9ad82a0da768d5f92960`, P1's diagnostic candidate, explicitly not an acceptance freeze. Role: `codex/p2-pr51-bootstrap-archive-fix-20261108`. Prior P2 handoff8d68c97 and integrated owner ancestry are preserved. Review requests: PR51 comments6722149931,6722240816 and6722448192; root-cause update6722644112.

Status: narrow owned corrections prepared for P1 review/integration. **The complete corrected civic runner and replacement-candidate acceptance remain pending P1 admission and revalidation.** No production service, controller, UI, shared transport, registration, schema, admission or owner baseline was changed.

## Ordinary test bootstrap

`P2GeneralFeedbackTest::createApplication()` previously enabled isolated bindings before provider registration regardless of profile. In the ordinary backend job the unchanged provider correctly refused these bindings before `CombinedMysql` could mark the combined-only cases skipped.

The pre-route callback now registers only when both `P1_COMBINED_TESTS=1` and `DB_TEST_DISPOSABLE=1`. All six real lifecycle/HTTP/race methods and their assertions remain. The existing provider still verifies actual database/environment/delivery boundaries; no normal-profile opt-in was added.

- Actual RED on unchanged c702 test:6 errors/0 assertions, provider refusal before skip.
- GREEN ordinary focused run:6 intended skips,0 errors,exit0. Missing either opt-in separately also yields6 skips.
- GREEN full ordinary suite:262 tests/256 assertions,0 failures/errors,191 skips,exit0. This is71 executed tests;190 are combined-only skips and one existing Windows symlink fixture skip. Linux remains responsible for the symlink case.
- GREEN genuine MySQL combined focused run:7 tests/185 assertions,0 skips/errors/failures. Includes all6 P2 lifecycle/independent-process cases and P1's actual staff-reassignment/history integration case.

Commands: `php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.xml --filter P2GeneralFeedbackTest`; full ordinary command without filter plus `--display-warnings --fail-on-warning --log-junit=<private-junit>`; combined `-c backend/phpunit.combined.xml --filter 'P2GeneralFeedbackTest|Pr51GeneralFeedbackIntegrationTest'`. Each uses the appropriate isolated local profile, with ordinary opt-ins disabled and combined tests on a different newly created schema.

## Civic browser failure

The unchanged original runner on the clean admitted c702 export reproduced11 passing checks followed by the reported archive check. Private assertion-frame instrumentation, preserving all assertion results and logging no values/body/key/cookie, pinpointed line259: the resident archive-selector denial.

The helper called shared `Http.request('feedback?archive=all', ...)`. That API deliberately accepts a strict path and a separate `query` option. It rejected the old call locally with `VALIDATION/status0`, so the intended server403 assertion never reached Laravel. Existing real SQL already proves resident archive selectors are forbidden.

The owned helper now accepts/passes `query`, and the same denial assertion calls `http(resident, 'feedback', {query:{archive:'all'}})`. Its expected403 and all other assertions are retained. Shared path validation is unchanged.

A separate real-session integration diagnostic evaluated the exact old/new owned helper source against the unchanged admitted c702 application on another fresh civic-only database:

- Old helper call:VALIDATION/status0, zero feedback requests.
- Corrected helper call:actual GET with archive=all,403/FORBIDDEN from Laravel.
- Resident default history GET200; official archive=all GET200.
- Full domain-state hashes unchanged across probes; no real delivery.

This diagnostic used original shared staging, HTTP, cookie sessions and actual MySQL. It did not copy/replace the original runner, modify the export/manifest, or claim that the complete corrected runner passed. The original c702 source verifier remains a separate check.

## Other verification and preserved attempts

- Existing complete frontend test command passed outside sandbox; P2 adapter/form/new General Feedback Node51 passed.
- Scoped Pint passed; browser runner syntax and diff whitespace checked.
- Initial local PHP attempts could not open the generated autoloader; existing locked Composer install regenerated autoload files, and the outside-sandbox invocation reached the real six-error regression. No dependency declaration/lock was changed.
- The first frontend invocation hit sandbox realpath EPERM in the original registration test. The identical command passed outside sandbox without assertion/source changes.
- Private runtime copying was slow; it completed without deletion. A uniqueness guard refused to stop an unidentified process, and no process was stopped by that attempt.
- The original failed civic export, database and diagnostic evidence are retained. No retained/shared target was migrated or reset.

## P1 integration dependency

P1 alone integrates this reviewed role handoff and updates the existing explicit patch declaration for `backend/tests/P2/browser-civic.mjs`, preserving its original upstream `before` hash. Its new normalized SHA256 is `227c420b5e10d50688235ca9d7a3d6c2f32943b7a32fb4fcdc178223c6b27b94`. The owned PHP test normalized SHA256 is `d35b5239f512812f263b3dfa9edfccb5911deac1084ce1db4504c55cbe391f56`.

Then publish a new clean export/head/manifest and run the full corrected original civic runner, including the archive continuation and responsive check, plus required ordinary/combined gates. Do not patch c702's frozen fingerprints or copy a new runner over its manifest. P2 will rehearse the replacement; DBA independent acceptance and actual recording backup/restore remain separate pending gates. PR51 stays draft/unmerged; no main merge or external activation.
