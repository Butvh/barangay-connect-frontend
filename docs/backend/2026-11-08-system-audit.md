# Integrated system audit — 8 November 2026

Status: validation in progress. This branch is a review candidate, not a release or permission to merge main. Exact results are recorded below as each gate finishes. The retained recording database has not been migrated, reset or used as an audit fixture.

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

- Original frontend baseline: passed. Original combined PHP baseline was interrupted after 189/384, so is **not** a passing result.
- Reproduced four PHP portal/field-error failures before fixes; valid pinned facility case already passed.
- New map API regression failed because a resident received an inactive facility. New in-app command regression failed because the command did not exist.
- Focused corrected session/facility/worker run: **35 tests / 285 assertions, no failures**. Map test added afterward; final complete run includes it.
- Portable P2 contracts: **52 passed**. Shared-transport/original-form P2 JavaScript: **43 passed**.
- Original frontend suite after initial fixes: passed; the new 7-case audit regression is now part of the standard runner and passes independently.
- Full combined PHP, all original browser workflows, SQL races, lock review, syntax/style, dependency and artifact checks: **pending final results**.

Setup diagnostics are retained, not hidden as product regressions: an interrupted MySQL process required loopback restart/recovery; early connection-timeout runs and a globally enabled identity environment were corrected before the focused pass. The P2 HTTP fixture now declares each fictional role's portal intent; its first run exposed that missing test-caller field. No original assertion or failure gate was removed.

## Release and owner handoff

P1 reviews portal validation/shared frontend contracts and reproducible integrated staging. P2 reviews operational projection/privacy and all original workflow/race evidence. DBA reviews unchanged schema/guards plus the notification worker boundary, current candidate lock evidence and backup/restore acceptance. Review the exact candidate, not an earlier PR head.

Final acceptance remains dependent on current required checks and the team's independent DBA review/backup custodianship. The earlier recording-backup handoff is not certified by this audit. If those are incomplete, publish the candidate and evidence but leave all owner PRs and main unmerged. Real external message delivery remains untested and disabled; neither isolated tests nor a video rehearsal establish production readiness.
