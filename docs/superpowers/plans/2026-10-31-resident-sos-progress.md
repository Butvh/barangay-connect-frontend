# Resident SOS progress and confirmation implementation plan

**Goal:** Match the supplied five timeline states and Alert sent confirmation while opening an existing SOS directly in status tracking.

**Architecture:** Keep the existing browser API, ownership checks, verification gate and manual assignments. A small resident timeline model derives recorded/completed/current/upcoming states; the existing page modules render it using shared tokens, badges, icons and BCMap.

**Spec:** User request and eight supplied screenshots; Figma APP-DEV-Final frames 250:12467, 250:12909, 250:13305, 250:13700, 250:14093, 250:14487. Inspected prototype connections for Send SOS, Add details, status and dashboard navigation.

**Design:** Existing Inter type, #172033 text, #F4F6F9 background, #E4F3EA confirmation, #EEF4FB next card. Current stages use amber/blue/teal/teal/green; earlier recorded stages use green checks, later stages gray. At desktop the confirmation columns are 736/432 with 32px gap, 32px/24px card padding. Status rows use 40px circles, 20px icons, 16px gap and 88px minimum height. Keep all text and actions usable when wrapped.

## Tasks

- [x] Add regression tests first for all five timeline states, actual/missing/skipped timestamps, direct Report navigation, new-only confirmation, details and verification/resolved restrictions. Run and observe the expected failures.
- [x] Implement the pure timeline projection and status styling in resident-report-model.js, resident-alert.js and resident.css. Preserve current assigned people and recorded destination.
- [x] Update resident-report-model.js and resident-report.js: an existing ID or own active alert opens resident-alert with replace navigation; only the successful send flow displays confirmation. Keep details editable only while active and retain the verification gate. Render confirmation with actual ID, barangay, household and BCMap pin.
- [x] Run the full test suite, static/syntax checks; compare desktop/tablet/mobile with Figma. Exercise a disposable demo SOS from creation through manual assignment, response, rescue and resolution; check no-rescue and verification cases in isolated automated fixtures.
- [ ] Independent whole-diff review, fix material issues, commit, PR, passing CI, merge main and sync XAMPP checkout.

## Review focus

Missing/invalid timestamps never become green completion evidence. Rescue assignment alone is not a started rescue. Refresh never replays confirmation for an existing SOS. A resolved ID never reopens details. Cross-tab updates preserve the correct owner/ID and manual assignment workflow.

## Verification record

Baseline: 328 unit/integration + 4 facility page checks passed. Regression-first run: 12 expected failures for missing projection and old sent routing. Implemented: 339 + 4 + 4 passed. Independent review identified a two-tab reuse issue; new real-API and real-page regressions reproduced it, then passed after the response-only was_created flag. Final scope preserves manual assignment and all API lifecycle rules.

Browser: isolated origin 8805, all five stages verified with real role UI actions and cross-tab updates; refresh retained rescue progress. Completed transport on seeded A-1038 to free its existing assignment slot, then manually assigned Ramon to A-1042. Resolved A-1042 through existing confirmation. New A-1043 confirmation matches 736/432 desktop columns and the saved pin at 67%/53%; Add details saved, mobile SOS redirects to this active ID. Tablet768 and mobile390 have no horizontal overflow. No existing demo origins were changed.

Implementation choice: reuse the existing resident-report-model.js for SOS presentation/routing instead of another model file. No rendering framework or dependencies added. No-rescue and invalid/missing timestamp behavior covered by isolated tests. Figma assets reused via the existing icon system and BCMap, preserving dynamic pin placement.
