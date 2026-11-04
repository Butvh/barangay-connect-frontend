# Original operational browser integration — November 4, 2026

> **November 5 update:** [Current exact-source acceptance and remaining gates](NOV5-INTEGRATION-STATUS.md) supersedes older completion/blocker statements below. Published P2 administrative support and DBA facility history are now integrated. Earlier measurements retain their original source pins.

Current Nov4 update: P1ba06fbb (tree73b4888; local equivalent d01dd64), DBA8cd2740 and P2b477a7c execute in the source-preserving disposable build. Actual private photos, consent authority, current worker and guarded P1 administration sources exist. Positive administration writes still require P2's actual event-family extension; facility widths/full history require DBA additions. Production remains off. Older slice descriptions below do not certify the later administration work.

Scope: resident SOS/details, manual Secretary responder assignment, responder assessment, manual Captain rescuer assignment, active destination/rescue logs and explicit resolution. Design/markup stays with P2's reviewed original controllers. P1 supplies composition, minimal reference reads and real-browser evidence. Production and dispatch remain disabled.

## Original read inventory

| Original caller | Required read | P1/P2 authority |
| --- | --- | --- |
| resident-report, householdUser, verificationFor | own user + household + latest verification | P1 `references/users/{ownId}` only; no directory or other resident lookup |
| Both shells and resident-report | current barangay name/map scope | P1 `references/barangays`, a one-element current-scope list |
| Original rescue dialog | visible facilities/capacity/contact/current active state | P1 `references/facilities` and selected visible ID; P2 still validates current destination inside rescue transaction |
| Alert list/detail, assignment picker, response/rescue logs | authorized incident/history/options/participant projection | Existing P2 factories/routes; no P1 incident repository |
| Shell bell and nearby view | recipient-private notifications / sanitized nearby alerts | Existing P2 projections; no broad person/household source |
| Shell/dialog subscriptions | users, verification, facilities, barangays and P2 entity revisions | P1 hashes only authorized reference projection; P2 owns scoped readers |

The P1 routes are GET-only and use current.identity plus the captured EffectiveIdentity. Another user ID returns404, including for administrators; participant details remain inside P2's authorized incident projection. Missing data stays null. Facilities expose visible local/shared directory data, not management authority. No registration, staffing, recovery or facility mutation is implemented by this slice.

## Registration gate

Normal backend artifacts keep domain registration unavailable. `stageBackendFrontend({operationalTest:true})` requires the confirmed disposable combined database and a clean manifest pinned to reviewed P2b477a7c. Only its generated private frontend sets Runtime.operationalTest. The test-only loopback router separately validates that disposable schema and loads real production adapters via P1's configuration. Production/local ordinary serving cannot enable P2 through this profile. Administration additionally requires explicit administrationTest staging and P1_ADMIN_TEST_BINDINGS with the existing isolated integration profile; both default false.

Before original pages initialize, operationalComposition registers P1 createSubmissionIntent through P2 configureOperationalSubmissions. It uses existing createP2DomainFactories, Http/envelope/auth and cancellation-aware readers. Alerts/dashboard/map/notifications, existing P2 reports/communications and minimal P1 reads use that composition. The separate administration selection registers P1's own guarded account, verification, personnel and facility factories/readers through the same transport. It does not provide a substitute incident writer or permit production enablement.

## Evidence boundaries

`tests/browser/operations.mjs` uses original pages and native dialogs in Chromium, actual Laravel cookies/CSRF and persisted MySQL. Each independent account has its own browser context; a separate deliberate account-switch check shares cookies to verify stale-tab protection. No DOM or reference read is stubbed. A network interceptor drops a successful real reply for retry testing; the server still executes and commits. CLI fixtures are guarded fictional data setup, inspection and revocation, not production administrative endpoints.

SQL/HTTP/controller fixtures, unit transport tests and real browser evidence are reported separately in PR49. Unchanged P2 deterministic race tests and DBA manual order gate remain required. A browser workflow does not certify all cross-owner mutation races or a production host. Actual photo bytes exist; original incident form selection still waits for the reviewed P2 caller/replay handoff and joint binding.

## Current measured original-page checks

The ba06fbb tree passes all10 original operational browser scenarios and retains4 screenshots in local Chrome against genuine MySQL8.4.13. The stale shared-cookie tab check pauses that tab's heartbeat before switching accounts, settling previous requests so its original identity stays observable; the strict419/409 assertions and persisted-source check are unchanged. Installing the browser clock alone does not stop time.

The additional administration runner passes5 read/form-readiness scenarios and captures15 screenshots: original official/resident profile fields, Captain personnel/private-upload form and Secretary API denial, facility directory/create validation, own verification/authenticated-registration denial, and guest registration client validation. Five page layouts are checked at1440/768/390 for document overflow. This is not positive save/review/reset acceptance. The actual SQL lifecycle cases remain required and failing while the owner writer rejects those event families. No DOM, authority or API is stubbed; no queue worker or real message is started.

Run `P1_BROWSER_MODULE=<absolute locked playwright/index.mjs> node tests/browser/administration.mjs` in the same clean confirmed build. Local Windows may explicitly set P1_BROWSER_CHANNEL=chrome; CI keeps its locked bundled Chromium. The test server scopes10MB/file,52MB/request and12-file PHP upload limits to its own process. Its private frontend, public root and all owner sources remain separately verified.

Optional denied/unavailable revision readers do not advance their revision or starve later authorized readers. The named polling regression retains dirty/focus deferral, failed-view replay and account-switch cancellation. Source fingerprint artifacts publish every exact owner hash and each approved overlay's before/after hash.

Reproduction: use the clean pinned private snapshot, confirmed disposable MySQL8.4 and locked private browser runtime. Run existing combined suites, then `P1_BROWSER_MODULE=<absolute locked playwright/index.mjs> node tests/browser/operations.mjs`. The script stages its own private test frontend and starts/stops its owned loopback server. It never migrates shared data or starts a queue worker.

## Eventual reviewed integration sequence

No merge/retarget is performed here. After required-green review, land the P1 safe-artifact/bootstrap foundation with flags off before schema-bearing backend changes can reach a Pages release. Review planning PR47 separately, then DBA48's additive contracts/schema. P2 owns rebasing/retargeting its PR50 from planning47 onto updated main once the planning/shared foundation dependencies are present. Review the resulting diff for duplicated planning files and reconcile shared original pages explicitly; the private common-base overlay is not blanket permission to overwrite an integrated file. Rerun every suite on the actual combined main candidate without private overlays. Any production registration/hosting/migration/worker enablement is a separate reviewed release action.
