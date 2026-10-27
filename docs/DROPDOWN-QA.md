# Shared dropdown verification

The existing Alerts single-select design now lives in `assets/js/core/select.js` and `assets/css/components.css`. `core/ui.js` installs it once for initial and dynamically inserted fields. The original Alerts export remains a compatibility alias. Native selects retain options, values, names, form submission and validity; each page retains its field sizing.

## Coverage inventory

All current single-select markup is produced by these modules, which import the shared UI directly or through their shared page module:

| Module | Controls covered |
| --- | --- |
| official-alerts | Status, disaster type, sort for Secretary/Captain; status and sort for Responder/Rescuer |
| official-verifications | Status and sort |
| official-feedback | Status and sort on operational tabs; general-feedback sort; Tanod assignment dialog |
| official-map | Desktop filters, filter sheet, facility list dialog |
| official-alert-actions | Response type/status and rescue status inside log dialogs |
| captain-personnel | Role, status, source filters |
| captain-personnel-dialogs | External personnel role/status, appointment/reassignment role, directory status |
| captain-reports | Report type/status/sort, activity and date/user filters |
| resident-feedback-new | Required complaint category |
| resident-map | Facility-type dialog |
| resident-components | Implicitly labelled sample select |

Date pickers, tabs, filter chips, three-dot/action menus, and separate rich selection dialogs retain their existing workflows. No role or permission logic changed. Multiple/listbox selects and browsers without the Popover API retain native controls.

## Automated checks

- `node scripts/run-tests.mjs`: 269 passed, 0 failed.
- `node scripts/check.mjs`: offline references, asset ownership and size validation passed.
- All 71 production modules passed syntax checking; `git diff --check` passed.
- This static ES-module project has no separate compiler, type checker or bundle build.

Serve the repository, open `tests/select-browser.html`, and click **Run dropdown checks**. The 21 isolated DOM checks do not access demo data. They cover native FormData and submit, required validity/error focus, event counts, disabled controls/options/optgroups, dynamic options/controls, reset, programmatic value/index changes, ARIA labels/help/errors, modal ownership, pointer focus retention, viewport flipping, long lists, keyboard/type-ahead, closing, single-open behavior, idempotence, cleanup and focus restoration after replacement.

Observed RED/GREEN: the previous Alerts adapter failed 13 of the initial 15 checks; the shared adapter passed all 15. A real modal pointer test then exposed focus moving to the dialog before selection. Its regression failed before the pointer-focus fix and passed afterward. Final 21-check runs passed at 1366×900, 768×1024 and 320×740.

## Browser integration checks

- Secretary: combined Alerts status/type/sort and clear; Verification status/sort; Feedback status, empty-results clear, assignment dialog; map desktop filters and tablet filter sheet. Selecting Hospitals in the real modal updates both native value and visible label.
- Responder and Rescuer: role-specific Alerts status/sort selections and resulting records/empty states. Existing operational logs and access restrictions retained; no emergency status or personnel assignment was changed for this UI check.
- Resident: complaint category menu; required-category error focuses the visible control; successful local-only fictional feedback submission with selected category; mobile facility-type menu opens inside its dialog.
- Captain: personnel role/source menus, programmatic capacity-card updates, dynamically loaded role-capacity options and status menu inside Add external personnel (cancelled without saving); combined Report type/status/sort yields the correct record.
- Desktop inspection at 1920×1080: a Captain form menu has the same 351.2 px width as its field and opens 4 px underneath it, within its owning modal. Tablet map modal selection and mobile-size regression runs passed.

Independent code review found no blocking implementation defects. Its test-harness arrow URL finding was corrected by resolving the SVG relative to the module, preserving root and subdirectory hosting.
