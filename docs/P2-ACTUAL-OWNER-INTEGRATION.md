# P2 actual owner integration — November 4, 2026

## Current-P1 compatibility checkpoint

P1 `90208dbba11dbf7908b38e0f5bd100093c5be31d`, DBA `8cd2740d19e311c186b261c14a5c1ac69290ae98`, P2 over `272f8d6`: actual P2 administrative regression failed because current P1 facility creation requires its original command key (5 tests/33 assertions/1 error, private schema `bc_dba_p1_p2final_1793807653160`). The correction supplies a fixed original creation key in that P2 fixture only; no production validation, service or locking behavior changed.

Current actual P1 administration/verification/personnel/recovery/reference and P2 notification gate: **38 tests/280 assertions, 0 failures/errors/skips**, private schema `bc_dba_p1_p2final_1793807856784`, using the actual native Poppler PDF parser. P1's shared-facility cleanup is consumed unchanged and the earlier six unsupported-family errors do not recur in this gate. Current composed original frontend/page tests, P2 Node24 entries, shared transport18/factory8 and changed-file Pint also pass. Broader current-pin source/SQL/full-suite acceptance follows separately; the older evidence below remains explicitly tied to its original pins.

P1 must still repin current P2 and narrowly admit the three named P2 Feature tests, photo Node tests, actual-owner acceptance document and new execution plans; shared registration/readers/browser selection remains P1-owned. DBA is available; facility persistence and independent worker acceptance remain DBA-owned. No merge/retarget or external delivery is authorized by this checkpoint.

This candidate extends the retained b477a7c presentation checkpoint. It is not whole-backend or production acceptance. The earlier original-UI two-branch rehearsal remains pinned to P1bbb690e/DBA1dceb0e/P25e61893; see [presentation evidence](P2-PRESENTATION-READINESS.md). Do not use those screenshots to certify the newer photo/consent slice.

## Exact composition and ownership

- P1 `bf9d67b9d5e04697ac67fe28ef9e201c8cadb3be`.
- DBA `8cd2740d19e311c186b261c14a5c1ac69290ae98`.
- P2 source hashes: [manifest](P2-INTEGRATION-MANIFEST.json), over b477a7c checkpoint.
- Main retained `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`; PR50 remains draft/stacked47.
- No P1 services/shared registration/readers, DBA models/migrations/transports, shared/live database or external delivery was changed. P1's new explicit `+00:00` MySQL connector is consumed unchanged; older timezone-gap reports refer to the previous pin.

## Implemented P2 boundaries

Actual P1 profile/security/registration/household/verification/facility/personnel producers can use the existing P2 typed writer, dispatcher handler and current notification access. Sources and recipients are checked against persisted records; facility authority uses `managed_by_barangay_id`. Own-account events remain private; verification uses owner/admin, facility uses manager-scope admin. These families remain in-app only.

Personnel uses the actual `personnel_appointments` source, not the user ID as an appointment key. Only a same-scope current Captain and the active exact-role subject can receive/read it. Removal retains the source/history and notifies the Captain while excluding an ineligible subject who has returned to resident/Tanod identity. Queued delivery and notification reads recheck current access. Links use the subject's user ID for the Captain's existing Personnel dialog, and the subject's own official profile otherwise. No staff email, private document or contact snapshot is copied into a notification. Actual P1 appoint/reassign/remove and P2 queued-revocation regression were RED on the missing family and GREEN after this extension.

`ReferenceData::actorFor` is now explicitly a nonlocking current display projection. A real dispatcher regression reproduced its previous users lock after outbox/receipt locks. Mutations still call `locked(original observation)` under declared person guards. The accepted Store lock-order/cleanup protocol is unchanged. In-app notifications carry generic text and current source authorization remains mandatory when read.

`IncidentService` accepts optional sixth constructor argument `IncidentPhotos` and seventh `SmsEligibilityReferences`. `CivicService` accepts optional sixth `SmsEligibilityReferences`. Five-argument construction remains photo-unavailable/in-app only; P1 owns reviewed final shared selection. There is no class-presence or global-switch fallback.

### Photo command

The existing details PATCH accepts `upload_ids`, a list of at most five distinct UUIDv4 staged references, with the original `expected_revision` and stable `Idempotency-Key`. Immediate SOS never waits for uploads. The command resolves immutable metadata IDs without locks, calls actual P1 four-argument `attach(observed, uploadId, incidentId, expectedRevision)` in ascending metadata-ID order inside once-miss, then increments the source revision. Attachment-only commands produce the same explicit details audit/revision change. Metadata/source/audit/replay outcome roll back together; no filesystem or network I/O runs inside that transaction.

Matching successful replay reauthorizes the original current observation/source but neither consumes again nor reapplies obsolete revision preflight. Changed body, stale new intent and revoked original generation deny. Actual P1 attach/download policy still controls approval, owner/scope/status, latest active exact-role operator access and owner/admin resolved history.

`createOperations({request, privatePhotos:false})` keeps the original photo control disabled. Only explicit reviewed opt-in supplies `alerts.stagePhoto(file,intent)`, using the existing shared request with multipart `photo` and stable key. `createPhotoUpload` delegates to P1's actual submission helper, retains the original File/key and canonical digest/length, validates only the four-field receipt `{upload_id,mime,bytes,expires_at}`, and caches it for details retries. The digest is local intent identity, not server content authority. Account changes during byte preparation or response acceptance deny. The original details listener freezes the whole draft and selected file before awaiting staging; later edits cannot mix form versions.

P1 must select the actual private-byte binding, opt in the factory only in an accepted profile, supply authorized metadata-ID/mime/bytes read DTOs and certify original Chromium upload/download/session-generation behavior. No token, path, object key, hash or fabricated filename is exposed as a source read DTO by this candidate. The full photo UI integration remains gated until those owner steps pass.

### Consent-aware source producers

Only `incident.created.v2` and `announcement.published.v2` can carry optional SMS intent. Actual P1 `allows` runs for individual server-selected recipients before source transactions; existing committed command outcomes skip this optional preflight. Inside source SQL, the preflight IDs are intersected with the actual minimal authorized in-app audience. No audience/barangay locks or consent calls run after source locks. Original identity/key/body/revision are not refreshed.

The bridge preserves separate `in_app` and `sms` booleans; other families deny SMS. `TypedOutboxWriter(allowSmsIntent:false)` is the unchanged default behavior; explicit reviewed selection of `allowSmsIntent:true` AND the actual source consent port are both required for optional intent. The default writer still produces DBA's exact `sms_intent_unsupported_in_app_only_writer` diagnostic in its separate probe. P1 owns final shared selection; none was changed here.

This is producer intent only. DBA's existing actual worker must still validate current recipient/account/role/scope, purpose/version consent, exact source and ledger at reservation and immediately before POST. It commits before I/O. In-app delivery remains independent. Missing/unavailable consent fails closed for optional SMS while the default source flow remains in-app only. The publication worker test temporarily sets its in-process Make gate true only with `Http::fake`/stray-request prevention and a real recorded command; it does not activate a Make scenario or change environment/deployment flags. The newly published DBA gate correctly rejected the older test's disabled-gate assumption before this fixture correction.

## Guarded DBA fixture reproduction

Run only in a composed **testing** application with genuine MySQL8.4, matching `DB_TEST_DISPOSABLE=1` and `DB_TEST_DATABASE=bc_dba_p1_*` or `bc_dba_p2_*`. All owner migrations must already exist in that fresh private schema. Keep `SMS_ENABLED=false`, `MAKE_ENABLED=false`, outbox dispatch disabled and set `P2_SOURCE_FIXTURE=1`. Never use a teammate/shared/live schema.

From the repository root:

```text
php backend/tests/P2/producer-fixture.php positive
php backend/tests/P2/producer-fixture.php missing
php backend/tests/P2/producer-fixture.php revoked
php backend/tests/P2/producer-fixture.php wrong_purpose
```

The fixture calls actual CurrentSmsConsent and actual P2 SOS/publication services. It does not dispatch/send or create handcrafted writer events. It prints source-produced event UUIDs and channel counts for DBA's separate fake-transport probe. Regenerate IDs on each teammate's device. The positive case has incident in_app1/sms1 and publication in_app2/sms1. Missing/revoked have SMS0 both. Wrong-purpose grants the Captain only publication consent: incident SMS0, publication SMS1 is correct and must not be mislabeled a denial.

Measured current-pin private fixture schema `bc_dba_p1_p2final_1793804873819`: positive incident `3662ea49-958b-46cc-9524-ca8adbd3d0c7`, publication `214aac26-120a-4466-8e9d-229d301c2344`. Eight actual events across four cases were created with zero delivery invocation/real messages. Missing: `a00a3b8b-5361-4701-97a6-ce25d980295a` / `91abc3f8-00de-4d88-9296-91f57e0476a9`; revoked: `d6a78ed9-695b-4689-983c-ab328072337c` / `e3a1b8ef-2655-42eb-a396-3c3d15ebc241`; wrong purpose: `c6583770-a8b2-4219-a8f6-32c901e21894` / `028284c4-7c96-442c-bd5a-01f66cbe2578`. Each pair is incident/publication, not independently hand-built outbox rows. These local IDs are evidence references, not portable teammate fixtures.

## Verification and limits

- Current focused real-service gate: **29 tests/196 assertions**, no errors/failures, schema `bc_dba_p1_p2final_1793803414942`. Actual P1 bytes/consent/personnel, actual P2 source services/dispatcher adapter and actual DBA current worker/probe; only external HTTP is fake. Cases include concurrent opposite-token consumers, ordering, attachment-only change, rollback/replay/stale/generation/privacy; source-produced SMS delivery once; queue-time and between-gates revocation; publication's existing Make-command gate; source/outbox/audit/history/outcome rollback and defaults. No live Make scenario is contacted or activated.
- Four actual shared-helper multipart/async account tests and one original-listener delayed-staging test pass. Both review findings were reproduced RED and corrected GREEN. Original frontend405, shared transport18, factory8, original SOS/details/official form regressions and portable48 remain passing. The composed P2 Node command reports24 entries/0 failures/0 skips. Run integration-only Node tests in the owner composition with `--experimental-vm-modules`; the standalone P2 branch deliberately does not copy P1's submission helper/registration.
- Current full frozen owner composition: **327 tests/1719 assertions, 0 errors, 1 failure, 2 skips**, schema `bc_dba_p1_p2final_1793803601657`. P2's cases pass. The sole failure remains P1's `CombinedReferencesTest::test_shared_facility_visibility_is_safe_and_does_not_imply_write_authority` (expects1 shared facility, receives2). Earlier `CombinedAdministrativeTest` leaves its globally shared `Shared referral` fixture in the reused database. P2 did not change either owner test or hide the failure. Skips: `PrivatePhotoPathTest` cannot create the Windows symlink fixture; `CombinedVerificationAdministrationTest` requires P1's explicitly configured native structural PDF parser. Linux/symlink and actual PDF acceptance remain owner gates, not passing claims. The new P1 UTC connector test passes.
- Earlier full307/1561 run on04b9773/83f4fa0 had this owner isolation failure AND DBA's default-writer SMS denial regression. The latter exposed an unconditional SMS opt-in in the new P2 writer and was corrected by default-false explicit constructor selection; the actual DBA probe test is included in the passing current29-case focused gate. This historical failure is not erased or labeled current acceptance.
- Existing shared registration/read DTO/actual Chromium upload/session-generation acceptance and P1's mandatory administrative browser flows remain owner/joint gates. Personnel's actual source notifications and the published UTC connector are now consumed, superseding the previous absent-dependency ruling. ID/scope/role Node assertions do not prove same-role reauthentication/generation lifecycle. Do not enable the photo control or claim whole-backend completion from them.
- Normal artifact/staging repinning and narrow new-file allowlist review remain P1-owned. A manually composed source test directory with vendor scratch directories is not a deployable artifact and is not used as artifact-check evidence.

| Other current-pin gate | Exact result |
| --- | --- |
| Retained SQL and original HTTP branches |48 P2 SQL cases plus2 original-controller branches pass on genuine MySQL8.4.13, `p2_test_1793804634867`. Both rescue/no-rescue still require explicit official resolution; frozen retries/staleness/privacy and prior one-attempt/lower-ID/exception-cleanup assertions retained. The obsolete P2 SQL case expecting unsupported security events was updated to assert malformed snapshot rejection, atomic rollback and default SMS0. |
| DBA unchanged actual-service order probe | Same private SQL database: `late_user_ids:[]`, both response/details commit, one response row, victim_count0, observed row-lock-waits delta1. This schedule is not a universal deadlock-free claim. |
| Configured in-app adapter/receipt probe | Exit0, provider_calls0, `bc_dba_p2_finalprobe_1793804895821`; exact TypedOutboxWriter/InAppHandler, caller rollback, independent replay, current revocation/scope/malformed-contract gates pass. |
| Separate default SMS-intent probe | Expected exit2 `sms_intent_unsupported_in_app_only_writer`, `bc_dba_p2_smsdenial_1793804914979`; default writer remains in-app only. Positive source/worker acceptance is the separate actual consent producer suite above. |
| Style and dependencies | Read-only Pint285 published PHP files passes; Composer strict validation/platform requirements includingGD pass; locked audit retry reports0 advisories (first Packagist request timed out; no dependencies changed). |
| Frontend and artifact isolation | Original405 frontend checks plus existing page/recovery suites pass; composed P2 Node24 entries, shared transport18/factory8, portable48 and497-file scanner pass. Unchanged P1 frontend/backend artifact tests pass, including staged module graph/secret and demo-storage isolation. |
| Preservation |199 P1 and143 DBA files match exact Git blobs;89 P2 source fingerprints match the private composition. No P1/DBA source was edited. The sole post-full-suite source change sorts PHP imports in the new P2 personnel test; runtime behavior is unchanged and SQL/Pint/hash gates use the final source. |

Reproduction: compose the exact heads listed above with this candidate and P1's unchanged Composer lock. Use all five unchanged owner PHPUnit suites (Unit/Feature/Database/Integration/Compatibility), with explicit confirmed disposable MySQL8.4 test flags and matching database names. For command details, retain [SQL/HTTP reproduction](P2-COMPATIBILITY.md#reproduction), the new guarded fixture commands above and actual new P2 Feature tests. All independent workers inherit the same PHP/GD configuration. Private scratch helpers and evidence schemas are not shipped artifacts.

P1 handoff: consume this P2 source manifest, fix its shared-fixture isolation, configure/test the real PDF parser, run Linux symlink proof, and repin/stage the reviewed composition. The actual administrative event families no longer require a substitute writer. Keep optional photo/SMS factory selection off until original Chromium upload/download/session-generation and current registered reports/admin workflows pass. P1's shared registration must explicitly supply the actual photo port and actual consent port and, separately, select the opt-in typed writer only in the accepted profile. DBA handoff: reproduce the guarded source fixtures locally and run its existing configured positive worker probe with fake transports/current authority; the late display `actorFor` read is now nonlocking and does not change mutable command guards.

## Review rulings

One fresh read-only review of the original runtime slice found two Important frontend races; both were fixed with failing tests followed by a passing original frontend suite. No Critical or Minor finding. The subsequent actual-personnel extension and DBA gate fixture correction use additional real RED/GREEN tests; they are not represented as part of that earlier review. Shared activation and photo readers/Chromium remain deferred to P1 (cost: feature controls remain disabled). Same-role browser generation remains unverified (cost: cannot enable based on Node tests). Accepted Store/checkpoint evidence was retained (cost: current-pin SQL proof remains distinct). Owner test leakage/OS skips are reported without altering owner code (cost: combined acceptance blocked). Production migration/delivery/Make/workers/deployment/main merges remain unauthorized (cost: no production readiness claim).
