# Original operational browser integration — November 4, 2026

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

Default `domains.js` remains empty for normal demo/backend artifacts. `stageBackendFrontend({operationalTest:true})` requires the confirmed disposable combined database and a clean manifest pinned to reviewed P2 acc9f56. Only its generated private frontend sets Runtime.operationalTest. The test-only loopback router separately validates that disposable schema and loads real production adapters via P1's configuration. Production/local ordinary serving cannot enable P2 through this profile.

Before original pages initialize, operationalComposition registers P1 createSubmissionIntent through P2 configureOperationalSubmissions. It uses existing createP2DomainFactories, Http/envelope/auth and cancellation-aware readers. Alerts/dashboard/map/notifications plus minimal P1 reads are registered. Unrelated administrative/civic/report form factories stay unavailable. Shell subscriptions may read their authorized P2 revisions without enabling those form mutations.

## Evidence boundaries

`tests/browser/operations.mjs` uses original pages and native dialogs in Chromium, actual Laravel cookies/CSRF and persisted MySQL. Each independent account has its own browser context; a separate deliberate account-switch check shares cookies to verify stale-tab protection. No DOM or reference read is stubbed. A network interceptor drops a successful real reply for retry testing; the server still executes and commits. CLI fixtures are guarded fictional data setup, inspection and revocation, not production administrative endpoints.

SQL/HTTP/controller fixtures, unit transport tests and real browser evidence are reported separately in PR49. Unchanged P2 deterministic race tests and DBA manual order gate remain required. A browser workflow does not certify all cross-owner mutation races or a production host. Real photos remain unavailable until the DBA additive schema and exact P2 policy are published and reviewed.

Reproduction: use the clean pinned private snapshot, confirmed disposable MySQL8.4 and locked private browser runtime. Run existing combined suites, then `P1_BROWSER_MODULE=<absolute locked playwright/index.mjs> node tests/browser/operations.mjs`. The script stages its own private test frontend and starts/stops its owned loopback server. It never migrates shared data or starts a queue worker.

## Eventual reviewed integration sequence

No merge/retarget is performed here. After required-green review, land the P1 safe-artifact/bootstrap foundation with flags off before schema-bearing backend changes can reach a Pages release. Review planning PR47 separately, then DBA48's additive contracts/schema. P2 owns rebasing/retargeting its PR50 from planning47 onto updated main once the planning/shared foundation dependencies are present. Review the resulting diff for duplicated planning files and reconcile shared original pages explicitly; the private common-base overlay is not blanket permission to overwrite an integrated file. Rerun every suite on the actual combined main candidate without private overlays. Any production registration/hosting/migration/worker enablement is a separate reviewed release action.
