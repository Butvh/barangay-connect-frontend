# Integrated system audit — 8 November 2026

Status: required Linux CI, the complete local backend suite and all local browser gates passed for the reviewed runtime. This branch is a review candidate, not a release or permission to merge main. The retained recording database has not been migrated, reset or used as an audit fixture.

## Source and dependency review

| Owner / PR | Reviewed head | Responsibilities and dependencies |
|---|---|---|
| DBA #48 | `bf2c5e800bbd9bb996e3070554bbcfdcc4d4169e` | Relational models, constraints, ordered capacity guards, migrations, audit/outbox contracts, encrypted backup/restore and SMS/Make delivery controls. Needs P1 identity/source authorization and P2 actual producers/handler for full acceptance. |
| P1 #49 | `7369fe93f81a09e4ba490b684d8fa35f0bfd8a1a` | Laravel foundation, cookie sessions/CSRF, security generations, references, accounts/recovery, administration, private uploads, shared frontend HTTP/factory readers and CI. Depends on DBA schema and P2 operational adapters. |
| P2 #50 | `429490a8da8a0b25d6ee95f018833a1646c1def9` | SOS, manual assignments, assessment/response/rescue, explicit resolution, civic workflows, report projections, notifications, typed audit/outbox adapters and original form integration. Depends on P1 effective identity and DBA schema/guards/contracts. |

`main` at review: `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. All three PRs were open/draft. Historical green CI is evidence about the earlier composed candidate only.

Integration order is contract/schema plus P1 foundation, then P2 adapters and operational commands, then original forms and cross-owner acceptance. Numerical PR order is not an implementation plan. The existing composition tool already reconciled ten explicit common-base frontend/test files. Its clean baseline contains 855 fingerprints and 279 DBA/P2-owned files; a generated combined PHPUnit configuration was copied with them. No upstream migration/model/transport was replaced by a competing implementation.

The baseline is retained in `owner-source-baseline.json`. `integration-audit-patches.json` declares every changed baseline file with original/candidate fingerprints and a reason. The integrated snapshot path validates these against the pinned Git blobs, rejects missing owner sources or undeclared modifications, and records separate current-candidate hashes. It does not call patched owner bytes “unchanged upstream.” Original branch-only composition remains available when this audit baseline is absent.

## Findings and corrections

| Severity | Finding / root cause | Candidate correction / responsible review |
|---|---|---|
| High | Laravel accepted valid credentials from either login portal; the browser's redirect was not an authorization boundary. | Require explicit `portal=resident|official`, compare the server's current effective role after credential verification, and invalidate the wrong-portal session with a generic 401. Missing/forged portal is 422. Shared transport and legitimate test callers carry intent. P1 review required. |
| High functional | Operational writes persist an outbox event, but this isolated build deliberately disables the full external dispatcher. Existing browser tests delivered events manually; ordinary simulation had no running in-app worker. | New bounded `notifications:deliver-demo` command invokes the existing dispatcher directly without its SMS/Make queue scan. Requires a confirmed disposable testing build and external channels disabled. Preserves asynchronous commit boundary, existing receipts, current recipient/source eligibility and replay protection. DBA/P2 review required; production scheduling remains gated. |
| Medium | Sampaguita in the retained recording setup has NULL `map_scope`. The facility form offers a picker based on demo barangay ID, then Laravel correctly refuses the unsupported pin. The retained facility also has NULL coordinates, so it has no truthful marker. | Give fresh, explicitly fictional Sampaguita browser fixtures their declared coverage and known illustrative school coordinates. Never invent coordinates for existing data or silently modify retained records. P1/DBA must approve real dataset coverage before operators pin it. |
| Medium | Map validation threw no field key, while both API and HTTP error boundaries collapsed field explanations to “Check this field.” | Attach map errors to `map_x`; derive fixed required/integer messages from failed validator rules; preserve a small allowlist of safe explanations through HTTP. The form names fields in its error summary and retains the user's draft. Arbitrary server strings remain generic. P1 review required. |
| Medium | The separate map aggregate exposed inactive facilities to residents and used database-style type/availability names rather than directory-style names. | Apply the resident active-only boundary and normalize public map type/status/contact while retaining official inactive history references. P1/P2 review required. |
| Medium | The map counted unlocated alerts as “shown”; the Captain complaints layer was disabled even though API authorization and projection permit it. | Count actual pins, explain unlocated records without manufacturing locations, and enable the existing layer for Secretary/Captain. P2/P1 review required. |
| Low | Authored UTF-8 strings were repeatedly decoded before being committed, producing visible mojibake in registration, facility pin labels and personnel dialogs. | Repair the three authored source files and run a fatal UTF-8/mojibake regression guard. No runtime decoding of resident content, database conversion or global content rewrite. |

The screenshot's optional contact value `dsa` is not the actual map rejection. The current owner contract accepts an optional string up to 50 characters; there is no ratified phone-format rule here. Blank optional contact is accepted. Do not quietly change that contract or remove map/capacity validation to make a save succeed.

## Additional review findings

- **Medium, integration tooling, fixed:** the original rehearsal admission code hashed raw Windows CRLF while the integrated manifest hashes canonical UTF-8/LF. This refused equivalent admitted source. Integrated admission now uses the same normalization; legacy owner manifests keep their existing raw-byte contract. The actual CLI regression failed before the correction and passes afterward.
- **Low, diagnostics, fixed:** after-validation-hook errors exist in the validator error bag without a failed-rule entry. Iterating only failed rules omitted their field hints. Iterate error keys and derive only fixed safe messages. The regression observed a missing `fields.input` before the fix and the expected generic field hint afterward; authentication remains denied in both cases.
- **Low, local worker bound, fixed:** watch duration was checked only between batches. It is now checked between dispatches too. An already running dispatch may finish after the cooperative deadline; this is not a hard process timeout.
- **Medium, missing implementation, remains gated:** general feedback submission/read/rating exists, but its review/archive commands are not supplied by the current backend. Complaint/suggestion assignment/resolution must not be reused as a substitute. P2 owns a future reviewed service/API contract and P1 owns shared registration; keep unavailable actions disabled until then.
- **Release dependency, unresolved:** the actual retained recording archive and independent different-target restore remain pending DBA/custodian handoff. Isolated database backup tests do not certify this dataset.

## Security and data-source review scope

| Boundary | Reviewed implementation and acceptance coverage | Practical limit |
|---|---|---|
| Authentication / account changes | Current identity middleware, effective role/scope and security generations; generic portal failures; login/recovery/password rate limits; session/CSRF feature and browser tests. | This is the isolated testing profile, not production deployment acceptance. |
| Private records / uploads | Scope/ownership and current assignment checks; staged private photo normalization/download; revoked role, unrelated resident, transfer/cancellation and historical-gallery regressions. | Verification document demo previews still follow their existing documented storage contract. Never publish private runtime objects. |
| Injection / mass assignment | Parameter-bound relational queries, explicit request/service field allowlists, escaped UI rendering, and hostile/extra-field tests in the retained suites. | Test coverage is evidence for exercised boundaries, not a guarantee that no vulnerability exists. |
| Transactions / concurrency | Shared MySQL connection, original revision/idempotency and rollback assertions, real independent-process assignment races, unchanged DBA late-user-lock probe. | No whole-barangay or notification-audience locking workaround. |
| Secrets / public root | Frontend/backend artifact checks exclude `.env`, vendor, storage, private documents and demo seed from backend artifacts; Composer audit uses the locked dependency set. | The local root test account is limited to loopback disposable testing. A production least-privilege database account still needs operator configuration. |
| Notifications / external providers | Existing typed outbox, receipts, recipient/source revalidation, consent/purpose and fake transport/replay tests. The local command processes only in-app events. | Real SMS/mail/Make delivery and production scheduling remain disabled and unverified. |

The public GitHub Pages build deliberately uses `Runtime.mode=demo`, browser persistence and fictional seed data. Backend staging writes a separate same-origin artifact with `mode=backend`, removes the seed module, and enables only explicitly reviewed test factories. Laravel/MySQL supply those original pages' accounts, operational records, directory, civic data and reports. No API failure is treated as permission to load demo records. Private staged forms are the integration target; the Pages URL cannot run Laravel.

## Team action order and completion criteria

| Order / owner | Priority and prerequisite | Deliverable and completion criterion |
|---|---|---|
| 1 — P1 | High; frozen candidate and audit patch declaration available. Can run alongside DBA/P2 review. | Review explicit portal request compatibility, error allowlist, fixture-only map coverage and integrated staging. Reproduce original identity/administrative/recovery/photo browser gates against the exact candidate. Approve or report a concrete failing case without bypassing gates. |
| 1 — P2 | High; same candidate and fresh disposable schemas. Can run alongside P1/DBA. | Reproduce both SOS branches, manual dispatch, current assessment, rescuer capacity1/responder capacity2, release/retry/stale revision, privacy and explicit resolution. Confirm notification receipts and original recipient page. Record exact source and results. |
| 1 — DBA | High; same candidate and local isolated MySQL. Can run alongside P1/P2. | Independently accept the existing migrations/constraints, new capacity-race evidence, lock protocol and bounded in-app worker. Review real map coverage as data stewardship; do not add fabricated coordinates or reset retained data. |
| 2 — DBA + recording custodian | High; authorized private source/key/config/object handoff and coordinated capture. | Consistent encrypted actual recording backup, separately held restoration material, matching hashes, restore to a different verified empty target, FK/object/gallery/privacy verification. No restored outbox delivery. |
| 3 — P1/shared registrar + P2 | Medium; agreed general-feedback review/archive contract and DBA schema decision if required. Separate follow-up. | Implement missing commands through existing transport/intents with explicit authorization, revisions, audit and tests; enable UI only after acceptance. Do not claim current completion. |
| 4 — team | Release gate; current combined checks plus independent owner approvals and backup acceptance. | Review the dedicated integration PR and its exact commit, then decide merge order. Keep main and owner PRs unchanged until those gates are met. |

Provider credentials, real SMS/Make activation and production deployment require their own later acceptance; they are not prerequisites to exercising the fake-delivery local backend.

## Boundaries preserved

- MySQL transactions retain actor/security-generation checks, ordered person/incident/facility eligibility locks, optimistic revisions, one immutable submission key/body and atomic audit/outbox writes.
- No whole-barangay or notification-audience lock was introduced. Existing actual-service independent-process races and the DBA's late-user-lock probe remain required.
- Responder capacity remains 2 active assignments and Rescuer capacity 1; no auto-assignment or override was enabled. Finishing response/rescue releases the operational responsibility; only an authorized official resolves the incident.
- Private document/photo authorization and scoped readers remain enforced on Laravel. Neither GitHub Pages nor browser local storage is a backend.
- `Config.DEMO_MODE` intentionally remains the public fictional Pages experience. Private staged backend frontend selects the shared HTTP transport and gated domain/administrative factories. A backend error must not fall back to demo data.
- No real SMS/mail/Make request, credential publication, shared migration, recording reset, production enablement or main merge is authorized by a passing isolated test.

## Reproducible isolated setup

Use PHP/Composer from the locked backend requirements, MySQL 8.4, Node and the locked browser package. Each teammate uses their own checkout and private environment. Machine-specific paths are local evidence, not architecture requirements.

1. Check out this integration candidate; fetch all pinned owner commits. Run `node scripts/prepare-integration.mjs` with `RUNNER_TEMP` outside the checkout. Verify its manifest and use the resulting private snapshot.
2. Install `backend/composer.lock` in that snapshot. Use a new, unique disposable `bc_dba_p1_*` schema on a loopback MySQL instance. Set both `DB_DATABASE` and `DB_TEST_DATABASE` to that exact name and `DB_TEST_DISPOSABLE=1`; never point tests at a retained schema.
3. Use `APP_ENV=testing`, a private APP_KEY, `P1_COMBINED_TESTS=1`, `SMS_ENABLED=false`, `MAKE_ENABLED=false`, `OUTBOX_DISPATCH_ENABLED=false`. Run the unchanged migrations only on the new schema. Optional runtime bindings require `P2_TEST_BINDINGS=true`; use `P1_ADMIN_TEST_BINDINGS=true` for administrative forms. Production feature gates remain closed.
4. For a fictional operational rehearsal use the existing guarded `backend/tests/Support/browser-operational-fixture.php`. It creates randomized fictional credentials; keep its output private. It now declares Sampaguita map coverage explicitly. Other unsupported barangays remain unsupported.
5. Stage with the existing `stageBackendFrontend({operationalTest:true, administrationTest:true})` and serve `backend/public` using the existing loopback test router. Run the new command in a second terminal under the same private environment: `php backend/artisan notifications:deliver-demo --watch --seconds=3600`. Stop it after rehearsal. It refuses non-disposable profiles or enabled external channels. It prints counts, never recipients or message contents.
6. Use original Resident/Official login pages, simulate both incident branches, and inspect the same MySQL schema using a local read-only or appropriately limited phpMyAdmin account. A persisted event is not proof of delivery: inspect the in-app notification/receipt and the recipient's actual page.

## Test evidence ledger

Evidence root on this device: `C:/Users/Lanz/.codex/visualizations/2026/10/04/01a10651-3f6f-7cc0-ab32-0d0d48d30abc/backend-audit-20261108`.

Sanitized counts, exact runtime/owner revisions, CI tree equivalence, browser report hashes and raw evidence digests are retained in `2026-11-08-system-audit-evidence.json`. It includes no credentials, SQL contents, private object bytes or provider secrets. The full evidence remains private on this device.

- Original frontend baseline: passed. Original combined PHP baseline was interrupted after 189/384, so is **not** a passing result.
- Reproduced four PHP portal/field-error failures before fixes; valid pinned facility case already passed.
- New map API regression failed because a resident received an inactive facility. New in-app command regression failed because the command did not exist.
- Focused corrected session/facility/worker run: **35 tests / 285 assertions, no failures**. Map test added afterward; final complete run includes it.
- Portable P2 contracts: **52 passed**. Shared-transport/original-form P2 JavaScript: **43 passed**.
- Original frontend suite after initial fixes: passed; the new 7-case audit regression is now part of the standard runner and passes independently.
- Final reviewed runtime: `80b64ac28c3fcddb304e0e60e1d016338dc45d71`. Its clean export contains **867 fingerprints / 279 upstream owner files / 27 explicit audit patches**. Later documentation-only changes update this report, the implementation checklist and the login contract; their final provenance check is recorded separately.
- After-hook validation regression: **RED** (missing `fields.input`, 1 test / 4 assertions) on the prior implementation, then **GREEN: 26 tests / 156 assertions** for the complete audit/session boundary selection. The earlier connection-refused attempt is not the RED evidence.
- Actual MySQL P2 SQL/controller/race runner: **53 logged passes**, including the new independent-process rescuer capacity1 race, completion release and reuse without automatic resolution. The unchanged DBA actual-service probe reports **`late_user_ids=[]`, both workers committed, `lock_order_accepted=true`**.
- Final original frontend runner plus new audit7: passed. Exact CI P2 adapter list: **43 passed**, portable P2: **52 passed**, CLI orchestration: **11 passed**, artifact/source-boundary tests: **13 passed**. Original live public-root/session/CSRF checks: **3 passed**. Static check and complete Pint: passed. Strict Composer validation/platform checks passed; locked audit found no advisories.
- Actual source/fake-delivery acceptance: shared SQL/receipt contract **9 PASS lines**; granted/missing/revoked/wrong-purpose producer probes all passed, with **0 real provider calls**. No phone delivery is claimed.
- Frozen-candidate browsers: **52 scenarios / 57 screenshots**, no failed report. Original identity5, operations10, administration readiness5, account/verification/consent5, recovery/expiry2, personnel/facility/reporting7, photos3, opening/session1 and civic11; new audit3. Every phase used its own fresh schema. The civic runner used its required `bc_dba_p1_civic_*` prefix.
- Full five-suite combined PHPUnit on Windows: **392 tests / 2,194 assertions / 0 failures / 1 OS-limited symlink skip**, completed uninterrupted in22m55.678s. Linux exercises that fixture without skips. The earlier completed 391-test run failed only the new map assertion's incorrect assumption that no other suite retains shared facilities. The assertion now scopes its count to its own barangay while still rejecting any inactive resident result. Earlier interrupted runs are not passes.

Required Linux CI for runtime `80b64ac`: [run42455966616](https://github.com/Butvh/barangay-connect-frontend/actions/runs/42455966616) passed `check`, `backend` and `combined`; deployment was skipped. The complete combined suite passed **392 tests / 2,195 assertions with no skips**. The synthetic checkout `bf948a2d28917fec8ee46b5ab9d8c66cf60c4d77` and direct runtime commit have the same Git tree `8489e200621c8fcf0d116ead5e11f6dc6e183a8e`. Linux also ran the original 49 browser scenarios, actual SQL/races, fake producers, source verification, artifact/format and dependency gates. The additional audit3 browser scenarios were executed locally; they are not claimed as a separate CI step.

Representative commands (run from the clean candidate, with the private disposable profile described above):

```text
node scripts/prepare-integration.mjs
node scripts/verify-integration.mjs
node scripts/check.mjs
node scripts/run-tests.mjs
node --test backend/tests/P2/rehearsal.test.mjs
node --test tests/backend-artifact.mjs tests/frontend-artifact.mjs tests/integration-snapshot.mjs
php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.combined.xml --log-junit <private-evidence>/combined-junit.xml
php backend/tests/P2/run.php
php backend/tests/P2/sql.php
php backend/tests/Review/p2-lock-order.php
php backend/tests/Compatibility/check-shared-contracts.php
php backend/tests/Compatibility/check-produced-delivery.php --fixture-report=<private-fixture-report>
node tests/browser/integration-audit.mjs
```

The original ten-file P2 Node list and original nine browser entry points remain in `.github/workflows/pages.yml`; the additional audit browser is `tests/browser/integration-audit.mjs`. Node24 on this device omits the obsolete `--experimental-default-type=module` flag; CI retains its pinned Node22 flags. No assertions or required suites were removed to accommodate this device. Run Pint/Composer from `backend` using the locked runtime.

Setup diagnostics are retained, not hidden as product regressions: an interrupted MySQL process required loopback restart/recovery; early connection-timeout runs and a globally enabled identity environment were corrected before the focused pass. The P2 HTTP fixture now declares each fictional role's portal intent; its first run exposed that missing test-caller field. No original assertion or failure gate was removed.

A broad `p2-*.mjs` glob also invoked the standalone HTTP harness without its required server/fixture arguments; it was not a valid unit-test command. The exact original ten-file CI list subsequently passed43. A redundant Unit/Feature-only PHP run was stopped in favor of the complete five-suite run. Neither diagnostic is recorded as a passing full suite. The Windows symlink fixture explicitly requires Linux CI when the OS cannot create symlinks.

## Release and owner handoff

P1 reviews portal validation/shared frontend contracts and reproducible integrated staging. P2 reviews operational projection/privacy and all original workflow/race evidence. DBA reviews unchanged schema/guards plus the notification worker boundary, current candidate lock evidence and backup/restore acceptance. Review the exact candidate, not an earlier PR head.

Final acceptance remains dependent on current required checks and the team's independent DBA review/backup custodianship. The earlier recording-backup handoff is not certified by this audit. If those are incomplete, publish the candidate and evidence but leave all owner PRs and main unmerged. Real external message delivery remains untested and disabled; neither isolated tests nor a video rehearsal establish production readiness.

Delivery: [draft integration PR51](https://github.com/Butvh/barangay-connect-frontend/pull/51), branch `codex/backend-integration-audit-20261108`. P1/DBA/P2 owner heads were rechecked during final validation and still matched the pinned revisions. The fresh read-only code reviewer found no unresolved Critical/Important code finding after the three review corrections; this does not replace independent team acceptance. No upstream PR was merged, retargeted or force-pushed. The worktree, private evidence, historical failures and retained datasets remain available.
