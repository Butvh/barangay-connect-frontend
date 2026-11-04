# P2 presentation rehearsal and readiness — November 4, 2026

The later gated actual photo/consent/source-event candidate is documented in [P2-ACTUAL-OWNER-INTEGRATION.md](P2-ACTUAL-OWNER-INTEGRATION.md). Its evidence and owner pins are separate from this retained core rehearsal.

Target: November5,2026 at5 PM Asia/Manila. Reviewed starting P25e61893861f04f652f4106a3ed923ab461b6a86b, P1a821d5dd4cb45ffc4cbe0d5bf9531e214eb308c6, DBA1dceb0e4234d8bbfd1d467164f257ab45e574bab. This follow-up changes tests and handoff documentation, not production logic or design.

## Current evidence boundaries

- The strengthened `sql-photo-boundary.php` assertion runs immediately after caller failure, before any intervening Store call, inside a fresh real SQL transaction with no declared incident/person. Both guard assertions must throw. A private mutation omitting the real RelationalStore incident-scope restoration fails the exact new assertion; restoring the original source passes. This resolves the prior test limitation without a runtime fix or claim of a newly reproduced production bug.
- Actual original controllers over P1 socket HTTP/session/CSRF and MySQL are exercised by the retained SQL runner. Its UI-controller reference fixtures are explicit test infrastructure; this is not original DOM/browser acceptance.
- P1's previous10 original operational/5 identity Chromium scenarios certify its older frozen composition. They do not certify this current P2/DBA pin, Captain report UI, or a production host.
- At P1a821d5d, unchanged `composeSnapshot` rejected `docs/P2-JOINT-ACCEPTANCE.md` in a clean disposable Git fixture and staging required P25f38285. P1bbb690e superseded this finding by reviewing/repinning P25e61893 and adding its presentation launcher. New documentation in this follow-up still needs P1's narrow allowlist review. No gate or manifest was bypassed.
- P1 `operational-registration.js` constructs existing P2 factories but selects only alerts/dashboard/map/notifications. Reports has a refresh reader but no selected factory. Captain report original UI rehearsal needs P1's reviewed isolated-profile registration and browser check. The P2 reports service/controller/factory already exist; this is not a request to invent another implementation.
- Actual private byte service, consent persistence/authority and current worker integration are absent on the original frozen owner heads. Later P104b9773 and DBA83f4fa0 publications now contain these implementations and require a separate P2 integration and verification slice. They are not certified by the earlier tests or rehearsal. Photo/SMS controls and external delivery remain disabled in the rehearsed baseline. Expected unsupported SMS intent is denial evidence, not completed SMS delivery.

## Measured original-UI rehearsal

An authentic clean snapshot from P1bbb690eda11b6be419ead37fe36bc93edbf59920, DBA1dceb0e and P25e61893 was assembled by P1's unchanged `prepare-integration.mjs` (735 source fingerprints). Its unchanged presentation launcher used genuine private MySQL8.4.13, schema `bc_dba_p1_presentation_p2_rehearsal_20261104_a`, loopback port8818, generated fictional credentials, and no external delivery or automatic worker. No owner implementation or manifest was patched. This is separate from the P1a821d5d combined-suite pin below.

- Original resident SOS/details/status pages created A-1 and A-2, one source per resident. Private-photo upload remained visibly disabled. Original Secretary/Captain pickers manually assigned the persisted responder.
- A-1: actual responder Assessment/No/Completed left the source Responding; Secretary Resolve plus confirmation changed it to Resolved. The timeline marked rescue skipped, not performed.
- A-2: current Assessment/Yes enabled Captain's manual rescuer picker. Rescuer selected the active Sampaguita Elementary School and recorded In progress then Completed. The source stayed Rescue in progress until Captain's separate Resolve confirmation. Resident final timeline showed the correct responder, rescuer and destination. Actual assignment history displayed the recorded actor/time.
- Existing guarded CLI fixture dispatched only these incidents' in-app events (4 and7 events). Repeating delivery retained34 receipts/34 notifications, with0 SMS deliveries/0 SMS attempts. Captain's original notification drawer opened the correct source preview/detail. The second resident saw only its6 status notifications; reading A-1 returned “This record was not found.” Resident navigation to Captain reports redirected to the resident workspace. These manual route checks do not replace the SQL API authorization cases.
- Captain Reports reproducibly displayed “Unable to load reports. This backend feature is awaiting integration.” The baseline shared registration omits the existing reports factory. Resident and Secretary dashboards also displayed the safe unavailable state; assigned responder dashboard/alerts/detail worked. These are presentation gaps to report, not full original-page acceptance. No report totals, print or CSV success is claimed on this pin.
- Setup corrections: first preparation ran before vendor copy completed and was excluded; locked Composer autoload then required ignored Laravel runtime directories, sandbox write access and explicit testing environment. The actual launcher created the dataset but staging failed because its local `env.P1_COMBINED_TESTS` did not set the parent process variable read by `stageBackendFrontend`. Supplying `P1_COMBINED_TESTS=1` only in the guarded parent rehearsal process allowed unchanged `serve` to stage/launch. Preparation was not rerun over existing data. P1 owns the launcher recipe/fix. The final sign-out wait timed out after the click; do not claim observed sign-out. The exact owned server was stopped afterward.

Screenshots are retained locally with the presentation handoff, without credentials. New-head original Chromium retry/stale/transfer/report checks remain P1's certification gate; manual walkthrough is not a substitute for the full runner.

## Rehearsal preconditions and reset handoff to P1

1. P1 publishes the source-preserving composition/allowlist/staging repin and exact isolated-profile launch command. New P2 docs need narrow review: `P2-JOINT-ACCEPTANCE.md`, existing execution ledger and this `P2-PRESENTATION-READINESS.md`. Review active DBA metadata paths too. Do not forge a clean manifest or enable arbitrary production bindings to get a demo.
2. Use the reviewed genuine MySQL8.4 disposable `bc_dba_p1_*` browser profile; DB_DATABASE must equal DB_TEST_DATABASE and DB_TEST_DISPOSABLE=1. Keep SQL/HTTP testing flags scoped to the owned loopback build, debug/private root restrictions intact, and SMS/Make/automatic dispatch off. GitHub Pages cannot run Laravel.
3. Use existing P1 `backend/tests/Support/browser-operational-fixture.php` through its guarded test launcher. It creates fictional accounts and persisted reference rows; reuse its generated IDs/logins rather than frontend demo credentials. CLI setup is not a production registration/approval/personnel/facility endpoint. No real data, fabricated consent or new owner seeder is required by P2.
4. Need two distinct approved residents, an unrelated resident, Captain, Secretary, two active responders for transfer testing, one active rescuer and active evacuation facility in the same barangay. Residents need saved household address/pin or an honest unknown pin; do not replace absent pins with made-up coordinates. Keep other-scope accounts for denial checks. Verify candidate capacity before selecting a person.
5. Reset by stopping only the owned loopback server, creating a new confirmed disposable database, applying reviewed migrations and rerunning the existing fixture. Do not truncate a shared database or change real accounts. Preserve exact pins, dataset identifier and evidence before reset. P1 owns a reproducible manual demo launch/reset recipe; the automatic browser script is not a persistent presentation server.

## Six-to-eight-minute original-page walkthrough

Use separate browser contexts/profiles per role. Switching tabs in one shared-cookie browser is not independent multi-role login.

| Step | Original page/action | Evidence and expected result |
| --- | --- | --- |
|1: sign in | Resident login -> dashboard -> Report | Actual cookie/CSRF session, no localStorage identity authority. Wrong/anonymous identity cannot access private source. Capture the fresh alert ID, not a hardcoded A1042. |
|2: SOS | Send once; then add description/type/victim count when possible | Immediate Pending source and saved household/unknown-pin state. Retry a lost committed reply with the same original intent; one SOS, not two. Own timeline uses recorded timestamps. |
|3: manual responder | Secretary Alert Detail -> Acknowledge -> select available responder | Only chosen responder is assigned. Current source/revision/capacity used. Keep a stale Captain picker open for the separate negative check; it must not silently replace the assignment. |
|4A: no rescue | Assigned responder -> Log response: Assessment / No / Completed | One response record; incident remains Responding until Secretary explicitly resolves it. Completed response is not automatic incident resolution. |
|4B: rescue | Second resident sends a different SOS; official assigns responder; assessment says Yes | Captain/Secretary manually selects an available rescuer after current assessment. Rescuer chooses a currently active facility and logs In progress then Completed. Incident remains Rescue in progress until official resolves it. |
|5: notifications/history | Resident status and notifications; official incident/history | Use the existing in-app dispatcher fixture through the approved test launcher; prove deduplicated receipt and recipient-safe projection. This is controlled fixture dispatch, not a running production worker. Show recorded assignment/response/rescue/status history; do not reconstruct unknown actors/timestamps. |
|6: Captain reports | Captain Reports -> incident list/detail and activity/performance | Requires P1 reports factory registration. Choose the month containing server-recorded fixture work. Compare before/after deltas, not invented global counts. Correct incident/destination and recorded outcome; print/CSV preserve source facts. A non-Captain receives denial, not another user's report. |
|7: close | Confirm final state, sign out and restart using the documented recipe | Saved SQL source survives page refresh. Record screenshots/walkthrough and known unavailable features. Do not claim all admin/profile/recovery pages are implemented. |

## Negative checks outside the short presentation

- Lost committed SOS/response reply: original key and body reused, one successful side effect.
- Stale details/picker: original revision remains frozen and conflict is visible; no automatic retry with a fresh revision.
- Transfer: old responder immediately loses the private source; replacement may act. Dirty original dialog remains intact until explicit refresh/conflict handling.
- Inactive account/security generation: original session revokes; no newly constructed identity bypass.
- Unrelated resident/nearby: no reporter/contact/household/private photo/token/path leakage. Resident notifications remain their own.
- Captain reports: report data matches the real recorded sources; Secretary/Responder/Rescuer/Resident and cross-scope access deny. Current-directory names must not be sold as historical actor snapshots.
- Photo/SMS unavailable: fail closed with existing clear unavailable behavior; do not accept a filename or phone/global switch as authority.

P1 should extend its original browser runner with the report/history and non-Captain denial checks using the existing real services and DOM, not stubs. P2 owns any reproduced domain/controller defect; shared registration/test-profile entrypoint remains P1-owned.

## Test/evidence publication

Keep48 SQL cases and2 original-controller branches plus unchanged owner suites, frontend/portable/transport tests, independent one-attempt/lower-ID/order races, artifacts, formatting, dependencies and source fingerprints. Run the heavy SQL suites sequentially so worker-readiness timeouts are observable. Publish fresh results and named limitations on PR50; P1 must certify the actual current-pin original browser/profile before the core demo is described as ready.

This follow-up's fresh P1a821d5d/DBA1dceb0e/P2 overlay gates:202 tests/923 assertions, zero failures/errors/warnings/skips (database `bc_dba_p1_p2final_1793780981901`);48 SQL cases +2 original-controller branches (database `p2_test_1793781808356`); isolated DBA actual-service order probe, both commands commit/no late users/1 response/victim_count0/deadlocks0->0; configured in-app probe/provider_calls0 (`bc_dba_p2_finalprobe_1793782916496`); separate expected SMS denial exit2/0 events/0 deliveries/0 attempts (`bc_dba_p2_smsdenial_1793783092256`).405 frontend,48 portable,19 P2 Node,8 factory,16 shared transport,9 P1 Node entries, Pint233, Composer strict/platform/audit, artifacts/staged graph and483-file scanner pass. These measured results do not certify later owner publications.

Owner request: [PR49 comment6626375103](https://github.com/Butvh/barangay-connect-frontend/pull/49#issuecomment-6626375103). No owner runtime, schema, shared registration, main, shared/live database, Make/provider/production worker or deployment was changed or activated by this P2 follow-up.
