# Facilities management QA — 2026-10-28

Scope: browser demo and frontend only. Figma APP-DEV-Final directory 261:23680 and shared form 3469:77790; supplied directory/Edit reference images. No Laravel application or MySQL database was created. Production authorization is specified in [FACILITIES-API.md](FACILITIES-API.md).

## Automated verification

- `node scripts/run-tests.mjs`: 291 service/model/geometry tests plus 4 runtime resident-page regression tests; all pass.
- Facility regressions cover both managers; canonical active roles; cross-barangay/shared ownership; resident inactive-read denial; strict fields/enums/capacity/notes/paired coordinates; legacy defaults; stable IDs and snapshots; stale revisions; same-tab/cross-tab notifications; save-time inactive rescue rejection with no partial alert/log/notification writes.
- Map geometry checks invert viewport/pan/zoom, clamp boundaries and preserve percentage coordinates at different dimensions. Public and operational projections omit unpinned/inactive facilities; staff monitoring labels inactive markers.
- Runtime resident page tests execute actual ES modules against controlled DOM/API boundaries: Retry after refresh failure, retain map instance on successful refresh, invalidate stale mobile facility sheets, invalidate stale Emergency contacts. Removing each fix in memory reproduced its corresponding failure.
- `node scripts/check.mjs`: offline references, asset limits and source checks pass. All 75 application modules pass syntax checks. `git diff --check` passes.
- The project ships package-free static HTML/CSS/ES modules; there is no separate production compilation/type-check/lint command. CI runs the static checker and the complete test runner.

## Browser verification

Used the local-only preview at `http://127.0.0.1:8790` with fictional demo accounts in separate tabs.

| Area | Verified result |
| --- | --- |
| Secretary directory | Existing sidebar route opens redesigned cards, status badges, plus and anchored menu. Type filters retain their selection. |
| Add/Edit | Same form layout; required-field errors; optional hospital capacity; existing data and map coordinates populated. Successful create/edit persists after reload with the same ID. |
| Captain | Same manager controls; added an unpinned hospital with a contact number and no evacuation capacity. Details truthfully say no map pin selected. |
| Concurrent forms | Secretary edit while Captain draft is open; stale save rejects with conflict and retains draft. |
| Nested location picker | Uses existing map; no pin until selected; Enter places pin; arrow adjusts by 1%; zoom to 125%; pointer drag moves selected pin accurately; cancel leaves previous form point untouched; confirm stages the point; saving persists 49%,50%. Reopening focuses the saved point at 150%. Form fields/notes retained. |
| Status confirmation | Cancel preserves status. Deactivate changes badge/menu; Reactivate restores availability. No deletion. |
| Cross-tab resident map | Deactivation removes school marker while retaining 125% map zoom; reactivation restores public availability. |
| Staff map | Inactive school remains gray/dashed with explicit Inactive label. Added/edited facility appears at its saved location. |
| Operators | Both Responder and Rescuer directory DOM contain zero Add or administrative-menu controls; demo API denial also covered automatically. |
| Rescue workflow | Existing response log still works. Inactive school disabled in destination picker. Chosen hospital became inactive in manager tab: form retains hospital name, displays warning and disables Save. Reactivation restores Save; rescue log saves original destination. |
| Historical records | Existing rescue linked to deactivated school still names the original school and warns about current availability. Service tests also verify renamed destination snapshot stability. |
| Responsive | Inspected 1920×1080, 1366×900, 768×1024, 390×844 and 320×740. Cards wrap, controls remain within viewport, form body scrolls independently with footer actions accessible; nested map dialog works on mobile. |

## Review and limits

A fresh whole-branch review found two resident lifecycle defects (Retry retaining a detached map, stale open facility sheets/contacts). Both were fixed and receive runtime regression coverage. Documentation/readme and inactive marker encoding were corrected. No unresolved review blockers.

Browser storage is shared only within an origin/browser. It can be edited by a user and is not a production authorization boundary. Future Laravel middleware/policies/gates must enforce every request; optimistic revision and rescue/facility transactions must remain atomic. See the contract for MySQL fields, locks, validation, endpoints, role/scope rules and adapter errors. Map pinning uses the illustration's 0–100 percentage system, provides no geocoding or routing, and does not infer street addresses or nearest destinations.
