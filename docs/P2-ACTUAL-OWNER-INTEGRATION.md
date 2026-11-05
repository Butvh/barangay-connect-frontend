# P2 actual owner integration — November 5, 2026

## Opening-session correction — current experimental evidence

Current correction is tested over frozen P1 `9bc1a04b2005602de25879221042511f07a3ffa8` / DBA `f4e8df958234e0bd2b09fd1b10d749fc22c746c3`, with original P2 baseline `22365ad`. The historical checkpoint section below retains its older explicit pins; it is not current-head acceptance.

The runtime correction was published early at `ce9a6844b9049d1f3db18e5bb393f0afa6dd1177`; this follow-up adds test/evidence only. Actual unchanged P1 Chromium RED: one PATCH200, revision0 to1, description changed after same-account reauthentication while only the committed upload body was delayed (`bc_dba_p1_p2session_red_1793860026744`). Real Set-Cookie was applied once; header replay/401 is a different schedule. Meaningful helper, actual details-construction and gallery page tests were also RED before the correction. After correction, all3 original photo browser groups pass: zero PATCH, revision0 to0, description unchanged, residentGalleryPresent:true (`bc_dba_p1_p2session_green_1793860662842`). Actual staging/one receipt, committed lost-details replay, original stale409/draft preservation, unrelated404, transfer old404/new200 and resolved operator404/owner+admin200 remain passing.

P2 helpers capture opening identity plus opaque session_observation and retain that binding across discard/complete. Cached receipts, hashing, upload/detail replies and first submission validate it; async details-module loading cannot capture a replacement session. Original File/canonical draft/key/revision remain stable on ambiguous failure. A rejected late details response may already have committed; client denial does not imply server rollback. Already committed unattached staging may remain for existing expiry cleanup; no source/history deletion or cleanup bypass was added.

The resident alert reuses P1's unchanged safe incidentPhotoGallery and authorized reader. Default/demo/gated/empty/denied states add no gallery; invalid metadata/MIME/private path/token cannot manufacture an image URL. Authorized resolved owner history remains supported. No P1/DBA source, shared helper, schema, staging gate or CI was edited; optional defaults remain disabled.

This is an explicitly experimental P2 overlay on the clean839-fingerprint P1 baseline snapshot, not a new clean P1 composition or final Linux CI acceptance. The unchanged P1 composer ran from a clean detached9bc1a04 checkout. Exactly7 existing runtime/test paths are overridden and2 P2 tests are added; all9 hashes match P2. No other baseline source hash differs. The [manifest](P2-INTEGRATION-MANIFEST.json) retains baseline hashes separately from overlays and records JUnit/browser report hashes. P1 Windows working-tree bytes include CRLF; DBA/P2 baseline overlays are exact Git blobs. The P1 source guard was not weakened or relabeled as a clean final composition.

### Fresh measured checks

| Gate | Result |
| --- | --- |
| All5 original owner PHPUnit suites | **384 tests/2108 assertions,0 failures/errors,1 Windows symlink-fixture skip**, real private MySQL8.4.13/PHP8.5.12/GD/native Poppler. Includes current photo/source/consent/fake-worker/admin suites. Schema `bc_dba_p1_p2final_1793861053327`; JUnit SHA256 `0fcff84a15c9009b5727734adbb041fc445ebba052bd20988487dfaf49975631`. |
| Unchanged original non-photo browsers | **33 scenarios**: identity5, operations10, administration5, administration-workflows4, expiry-recovery2, personnel-facility7. Actual original UI/cookies/CSRF/current services and fresh private schemas. |
| Original photo browser | **3 groups pass**, including zero-PATCH opening-observation schedule above. Existing residentGalleryPresent is still a reported value; P1 must make it required in its owned gate. |
| Added P2 actual browser | **1 group passes**: same-role reauthentication BEFORE first click yields zero upload/PATCH and unchanged revision; explicit reopening saves0→1, image.decode succeeds, download200, desktop/390px mobile fit. Screenshots inspected. Schema `bc_dba_p1_p2session_reopened_1793862691758`. |
| P2 Node/page/intent | **32 entries,0 failures/skips**; first-click/import/hash/pending-upload/cached-receipt/pending-details/discard/normal-complete/reopen and retained retry cases. |
| SQL/HTTP/current order | **48 SQL cases +2 original-controller HTTP branches pass**; unchanged DBA actual-service probe accepted, late_user_ids[], both concurrent commands commit. Schema `p2_test_1793862967065`. No universal deadlock-free claim. |
| Original frontend/artifacts | Original node/page/admin/shared suites, composed scanner506, frontend artifact and backend staged-module graph pass. |
| Composer/style | Strict/platform/GD pass. **299 PHP files pass Pint** in separate LF-only style mirror. Raw Windows composition Pint FAILS on unchanged P1 CRLF; original files were not formatted. P1 retains final Linux style gate. |
| Dependency audit | **FAIL:7 advisories across4 Symfony v8.1.10 packages** in unchanged P1 lock. No P2 update/ignore/suppression. Details below. |
| Standalone P2 static | **FAIL:1 missing import**, P1-owned core/incident-photos.js. Composed scanner/staged module graph passes. Do not copy a competing helper or relax the checker. |

The earlier358-test/audit0 evidence below is historical. Never combine its counts/pins/audit status with this run. Dependency advisories were reported November4; passing services/browsers do not close that gate.

### Commands and narrow owner handoff

Run in the documented confirmed disposable testing environment with P1's locked Playwright1.64.1, PHP8.5.12/GD and native PDF parser. Keep SMS/Make/outbox dispatch and normal optional activation off. Each browser runner used a fresh private schema; external HTTP was blocked/fake. No real mail/SMS, Make scenario, production worker, shared/live migration, merge/retarget or deployment occurred.

```text
node scripts/prepare-integration.mjs
# Above creates the unchanged original baseline; P2 experimental overlay hashes stay separate.
node scripts/run-tests.mjs
node scripts/check.mjs
node --experimental-vm-modules --test tests/p2-adapters.mjs tests/p2-form-intents.mjs tests/p2-foundation-adapters.mjs tests/p2-location-forms.mjs tests/p2-official-forms.mjs tests/p2-photo-form.mjs tests/p2-photo-upload.mjs tests/p2-report-forms.mjs tests/p2-resident-photos.mjs
php backend/vendor/bin/phpunit -c backend/phpunit.combined.xml --log-junit p2-session-full.xml
php backend/tests/P2/sql.php
php backend/tests/Review/p2-lock-order.php
node tests/browser/identity.mjs
node tests/browser/operations.mjs
node tests/browser/administration.mjs
node tests/browser/administration-workflows.mjs
node tests/browser/expiry-recovery-workflows.mjs
node tests/browser/personnel-facility-workflows.mjs
node tests/browser/photo-workflows.mjs
node backend/tests/P2/browser-opening-session.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
# From backend/ through the shared Composer runtime:
composer validate --strict
composer check-platform-reqs
composer audit --locked
php vendor/bin/pint --test --format=json <private-LF-only-published-PHP-mirror>
```

P1's remaining narrow changes: explicitly reconcile/admit `assets/js/pages/resident-alert.js` at the common baseline; admit new `tests/p2-resident-photos.mjs` and `docs/superpowers/plans/2026-11-05-p2-opening-observation.md`. New `backend/tests/P2/browser-opening-session.mjs` is already under the owned/admitted directory; other edits use existing admitted P2 paths. Repin the final publication through P1's normal workflow, including any exact-head staging guard. Require resident gallery decode/download in its original browser gate, then run the clean composition/verifier and full Linux CI on final pins. Never broadly admit original pages or weaken a failing gate. Shared transport/helper/readers/registration/CI remain P1-owned.

DBA received the early correction and exact pins for independent privacy/source/fake-worker acceptance; no DBA schema/dispatcher change is requested for this frontend defect. Retain zero source command after observation denial, original retry identity and existing orphan cleanup. Current source/worker coverage passes in the384-test suite; DBA owns independent acceptance.

One fresh implementation review found no Critical/Important findings; its minor normal-complete→reauthentication test suggestion was added and passes. No production changes followed that review. Final admission, audit review/remediation and clean full Linux acceptance remain pending. Keep PR50 draft/stacked47 and optional activation disabled.

### New P1 dependency-audit handoff

Current `composer audit --locked` exit1 reports7 advisories in4 packages at v8.1.10. This is a dependency gate result, not a claim that every advisory is exploitable through this Laravel application. P1 must verify applicability and a compatible remedy under its shared dependency ownership, then rerun the required gates. Reported ranges include8.1.10 and end below8.1.11. P2 did not modify the lock or suppress advisories.

- http-foundation: [PKSA-24ph-xkrh-y79j / CVE-2026-118514](https://symfony.com/cve-2026-118514), [PKSA-pr6q-2w5s-kzzf](https://github.com/symfony/symfony/security/advisories/GHSA-3h27-hjv7-fqjx), [PKSA-nxjs-s6hn-vb6m](https://github.com/symfony/symfony/security/advisories/GHSA-xg2q-4rrq-657q), [PKSA-b2gg-vk1g-6d5q](https://github.com/symfony/symfony/security/advisories/GHSA-5mx8-mwrp-5693).
- http-kernel: [PKSA-3gxv-7xhq-mgmz](https://github.com/symfony/symfony/security/advisories/GHSA-wg5q-m2ww-f3c9).
- routing: [PKSA-y8c5-1b7f-r1gj / CVE-2026-118516](https://symfony.com/cve-2026-118516).
- yaml: [PKSA-nktx-f1n1-b4yd](https://github.com/symfony/symfony/security/advisories/GHSA-hwfg-qwvh-2wfx).

## Historical current-P1 compatibility checkpoint

P1 `90208dbba11dbf7908b38e0f5bd100093c5be31d`, DBA `8cd2740d19e311c186b261c14a5c1ac69290ae98`, P2 over `272f8d6`: actual P2 administrative regression failed because current P1 facility creation requires its original command key (5 tests/33 assertions/1 error, private schema `bc_dba_p1_p2final_1793807653160`). The correction supplies a fixed original creation key in that P2 fixture only; no production validation, service or locking behavior changed.

Current actual P1 administration/verification/personnel/recovery/reference and P2 notification gate: **38 tests/280 assertions, 0 failures/errors/skips**, private schema `bc_dba_p1_p2final_1793807856784`, using the actual native Poppler PDF parser. P1's shared-facility cleanup is consumed unchanged and the earlier six unsupported-family errors do not recur in this gate.

The final frozen current-owner run uses P1 `4c53718`, DBA `815c272` and P2 code `9fbe5d3`: **358 tests/1855 assertions, 0 errors/failures, 1 Windows symlink-fixture skip**, schema `bc_dba_p1_p2final_1793810226504`. Actual structural PDF parsing executed successfully. All five original owner suites (Unit/Feature/Database/Integration/Compatibility) remain present, including actual byte-service, P2 photo-command, persisted-consent source/current-worker, default SMS-denial, actual lock-order and DBA's new27 facility-persistence tests. Current composed original frontend/page suites, P2 Node24 entries, shared transport18/factory8, portable48, Pint289, Composer strict/platform/GD/locked audit0 and both P1 artifact/staged-graph tests also pass. This is source/service acceptance on these frozen heads, not original-photo browser or production acceptance. The full JUnit evidence has SHA256 `adb9ecb4c2644099ac834657a63c53482f5286826b51c9daab00baa21ed8a482`.

P1's `4c53718` already repins P2 `9fbe5d3` and narrowly admits the three named P2 Feature tests, photo Node tests and preceding actual-owner acceptance files; its 8 snapshot tests pass. The additional certification plan in this publication still needs narrow admission by P1. Shared registration/readers/browser selection remains P1-owned. DBA is available and its `815c272` facility persistence is consumed unchanged; the full-history source writer/projection remains P1's next task. No merge/retarget or external delivery is authorized by this checkpoint.

This candidate extends the retained b477a7c presentation checkpoint. It is not whole-backend or production acceptance. The earlier original-UI two-branch rehearsal remains pinned to P1bbb690e/DBA1dceb0e/P25e61893; see [presentation evidence](P2-PRESENTATION-READINESS.md). Do not use those screenshots to certify the newer photo/consent slice.

## Exact composition and ownership

- P1 `4c537189119c2b4d9a461a14de97221eeb0c66e4`.
- DBA `815c27293419797ebe3fbab4fe84daaf3580de0b`.
- Historical P2 source hashes: [22365ad manifest](https://github.com/Butvh/barangay-connect-frontend/blob/22365ad10f05bba4d16ba1d84a8e9c9049e2aa0a/docs/P2-INTEGRATION-MANIFEST.json), code checkpoint `9fbe5d3cb0246ab79517506ad69a09562d7e3f1b`. The [previous frozen manifest](https://github.com/Butvh/barangay-connect-frontend/blob/272f8d6ff1ca83a50119fe76f006de075d0d21a4/docs/P2-INTEGRATION-MANIFEST.json) reproduces the older bf9d67b composition; it is not current evidence.
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

Measured current-pin private fixture schema `bc_dba_p1_p2final_1793811567077`: positive incident `0c0c6f93-7d3b-4d4e-9b1c-3bd54771b137`, publication `3f0e53ea-b150-4321-8aae-d6fe81ab889e`. Eight actual events across four cases were created with zero delivery invocation/real messages. Missing: `d54ee9ee-bd45-4ecf-a45e-b29dc8218277` / `97d53640-97cb-4d86-88d7-85aa1033146b`; revoked: `4482698a-0a6c-4122-892f-48e2d9342299` / `a3942285-1b91-4215-b23c-1786822ea60c`; wrong purpose: `de2d593d-7c37-45a2-baf8-134527c77325` / `d929576a-77b5-4c7d-8b3d-57d4754dfe2b`. Each pair is incident/publication, not independently hand-built outbox rows. These local IDs are evidence references, not portable teammate fixtures.

## Verification and limits

- Current full358/1855 gate includes P2 actual photo commands6/47, consent producers6/53 and administrative notifications5/38, plus unchanged actual P1 byte/consent/admin services and DBA worker/probe tests. Cases include concurrent opposite-token consumers, ordering, attachment-only change, rollback/replay/stale/generation/privacy; source-produced SMS delivery once; queue-time and between-gates revocation; publication's existing Make-command gate; source/outbox/audit/history/outcome rollback and defaults. Only external HTTP is fake; no live Make scenario is contacted or activated. The prior29/196 focused proof belongs to the frozen272f8d6/bf9d67b record, not this run.
- Four actual shared-helper multipart/async account tests and one original-listener delayed-staging test pass. Both review findings were reproduced RED and corrected GREEN. Original frontend405, shared transport18, factory8, original SOS/details/official form regressions and portable48 remain passing. The composed P2 Node command reports24 entries/0 failures/0 skips. Run integration-only Node tests in the owner composition with `--experimental-vm-modules`; the standalone P2 branch deliberately does not copy P1's submission helper/registration.
- Current full frozen owner composition: **358 tests/1855 assertions, 0 errors/failures, 1 skip**, schema `bc_dba_p1_p2final_1793810226504`. The sole skip is `PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected`, because this Windows context cannot create the fixture; current Linux proof remains P1-owned. P1's unchanged cleanup resolves the shared-referral test leak; its actual structural PDF parser and UTC connector tests execute and pass. Previous327/1719/1failure/2skips on bf9d67b is retained in the frozen272f8d6 record, not described as a remaining current failure.
- Earlier full307/1561 run on04b9773/83f4fa0 had owner isolation failure AND DBA's default-writer SMS denial regression. The latter exposed an unconditional SMS opt-in in the new P2 writer and was corrected by default-false explicit constructor selection; the actual DBA probe test is included in the passing current full gate. This historical failure is not erased or labeled current acceptance.
- Existing shared registration/read DTO/actual Chromium upload/session-generation acceptance and P1's mandatory administrative browser flows remain owner/joint gates. Personnel's actual source notifications and the published UTC connector are now consumed, superseding the previous absent-dependency ruling. ID/scope/role Node assertions do not prove same-role reauthentication/generation lifecycle. Do not enable the photo control or claim whole-backend completion from them.
- Normal artifact/staging repinning and narrow new-file allowlist review remain P1-owned. A manually composed source test directory with vendor scratch directories is not a deployable artifact and is not used as artifact-check evidence.

| Other current-pin gate | Exact result |
| --- | --- |
| Retained SQL and original HTTP branches |48 P2 SQL cases plus2 original-controller branches pass on genuine MySQL8.4.13, `p2_test_1793811479071`. Both rescue/no-rescue still require explicit official resolution; frozen retries/staleness/privacy and prior one-attempt/lower-ID/exception-cleanup assertions retained. Malformed security snapshot rejection, atomic rollback and default SMS0 remain tested. |
| DBA unchanged actual-service order probe | Same private SQL database: `late_user_ids:[]`, both response/details commit, one response row, victim_count0, observed row-lock-waits delta1. This schedule is not a universal deadlock-free claim. |
| Configured in-app adapter/receipt probe | Exit0, provider_calls0, `bc_dba_p2_finalprobe_1793811584132`; exact TypedOutboxWriter/InAppHandler, caller rollback, independent replay, current revocation/scope/malformed-contract gates pass. Independent SQL queries confirm0 retained events/deliveries/provider attempts. |
| Separate default SMS-intent probe | Expected exit2 `sms_intent_unsupported_in_app_only_writer`, `bc_dba_p2_smsdenial_1793811599427`; default writer remains in-app only. Independent SQL queries confirm0 retained events/deliveries/provider attempts. Positive source/worker acceptance is the separate actual consent producer suite above. |
| Style and dependencies | Read-only Pint289 published PHP files passes; Composer strict validation/platform requirements includingGD pass; locked audit0 advisories; no dependency changes. Actual native Poppler26.07 inspects PDF bytes. |
| Frontend and artifact isolation | Original405 frontend checks plus current page/recovery/admin suites pass; composed P2 Node24 entries, shared transport18/factory8, portable48 and499-file scanner pass. Unchanged P1 frontend/backend artifact tests pass, including staged module graph/secret and demo-storage isolation. |
| Preservation |204 P1 and148 DBA files match exact Git blobs;89 P2 source fingerprints match the private composition. No P1/DBA source was edited. Only one P2 fixture creation key changed since272f8d6; no production PHP or JavaScript changed in this follow-up. |

Reproduction: compose the exact heads listed above with this candidate and P1's unchanged Composer lock. Use all five unchanged owner PHPUnit suites (Unit/Feature/Database/Integration/Compatibility), with explicit confirmed disposable MySQL8.4 test flags and matching database names. For command details, retain [SQL/HTTP reproduction](P2-COMPATIBILITY.md#reproduction), the new guarded fixture commands above and actual new P2 Feature tests. All independent workers inherit the same PHP/GD configuration. Private scratch helpers and evidence schemas are not shipped artifacts.

P1 handoff: retain its published fixture/UTC/PDF changes and9fbe5d3 admission, then repin/stage the final reviewed DBA815c272 plus this evidence publication. Narrowly admit `docs/superpowers/plans/2026-11-04-p2-current-owner-certification.md`; do not widen the general allowlist. Adopt DBA's published full facility snapshot/history contract in P1's existing source service and authorized projection, then verify its real administrative/browser workflow. The actual administrative event families no longer require a substitute writer. Keep optional photo/SMS factory selection off until original Chromium upload/download/session-generation and current registered reports/admin workflows pass. P1's shared registration must explicitly supply the actual photo port and actual consent port and, separately, select the opt-in typed writer only in the accepted profile. Current Linux symlink proof remains required. DBA handoff: reproduce the regenerated source fixtures locally and run its existing configured positive worker probe with fake transports/current authority; the new facility persistence is already consumed unchanged in the358-test run. No facility schema or P1 history writer was implemented by P2.

## Review rulings

One fresh read-only review of the original runtime slice found two Important frontend races; both were fixed RED/GREEN. Later actual-personnel extension/DBA gate fixture corrections have their own real tests, not a claim of that earlier review's scope. The current compatibility-only follow-up received one fresh read-only review: no Critical/Important; its historical-manifest-link minor is distinguished by the required current/frozen source documentation above. No second runtime fix pass was needed.

Shared activation/photo readers/Chromium remain P1-owned and gated (cost: full original-photo UI and same-role browser generation are not certified). Current Linux symlink and final current-owner browser/facility acceptance remain joint gates, although the earlier P1 CI exercised Linux on an older P2 pin (cost: do not call these358 tests whole-backend completion). Accepted locking and source security were preserved; no audience/barangay lock or speculative runtime fix was introduced. Production migration/delivery/Make/workers/deployment/main merges remain unauthorized (cost: no production readiness claim).
