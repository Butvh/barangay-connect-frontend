# Facilities Management Implementation Plan

> For agentic workers: execute inline using superpowers:executing-plans, with one fresh whole-branch reviewer before merging.

**Goal:** Match the supplied Facilities directory/form design and implement complete, synchronized demo facility management across all five roles.

**Architecture:** Extend the existing Api.facilities interface and browser store with a small facility domain module. Preserve IDs, rescue relationships and legacy records. Reuse BCMap for the nested location picker and shared selects for facility type. Consumers refresh from the same facilities subscription. No Laravel server or MySQL implementation is included.

**Tech Stack:** Existing package-free HTML/CSS/vanilla ES modules, browser storage/Web Locks, native dialogs, BCMap.

**Spec:** User attachment 6ea5db9e-9b9f-462d-a7de-6742aca66d01/Pasted text.txt plus the explicit follow-up approving frontend/demo workflows and a future Laravel/MySQL contract only. Figma GaTDGoek1jzWbcOh9dz4f2 nodes 261:23680 and 3469:77790.

## Global constraints and visual design

- Preserve the shell, map illustration, coordinates in 0–100 percent, data and unrelated workflows. No new dependencies, routing/geocoding, backend server or schema reset.
- Use existing Inter, navy #172033, secondary #475467, blue #1e5aa8, app #f4f6f9, white, green #e4f3ea and red status tokens. Directory heading 32/40, card heading 18/24, body 14/20, form heading 24/32.
- Directory: 480 px maximum cards, 20 px padding, 24 px column gaps, 12 px radius, Active/Inactive badges, 44 px plus/menu targets. Forms share one implementation: 560 px wide, 832 px maximum desktop height, 32 px padding, 44 px fields/actions, 300-character notes, capacity/contact side by side, status radio tiles. Scroll inside smaller dialogs; stack on narrow screens.
- New records are scoped to the signed-in manager's barangay. Shared referral records remain readable; management ownership is separate. Seeded shared hospital ID 2 is managed by Sampaguita (barangay 1), including legacy storage. Other unowned shared rows are read-only until ownership is explicitly recorded.
- Missing legacy status means Active. Do not invent map positions: paired null coordinates remain unpinned and absent from markers. Pinning is optional; coordinates, when supplied, must both be finite in 0–100. Address text remains independent.
- Residents receive active public facility information only. Operators may read inactive facilities but cannot mutate them. Manager writes re-resolve the current user from stored records and enforce role/scope inside the demo API. This is demo enforcement, not a security boundary against modified browser storage; Laravel must authorize all production requests.

## Review focus

- Deactivation racing with rescue save must reject the new destination atomically without advancing the alert or altering historical records.
- Editing or deactivating a legacy destination must preserve its original rescue snapshot and identifier; current availability remains separately visible.
- Nested modal cancel/confirm/resize/zoom/drag must retain form values and correct percent coordinates, without accidental form submission or inferred addresses.
- Stale forms must fail with a revision conflict instead of overwriting another user's edit; cross-tab updates must refresh consumers without resetting open forms or map zoom.
- Null/empty/out-of-range coordinates, unsupported barangays, shared referral ownership, spoofed roles and inactive-only directories must not produce fabricated pins, available destinations or unauthorized mutations.

## Task 1: Facility service, persistence and API contract

**Files:** create core/facilities.js, tests/facilities.js; modify core/api.js, core/store.js, seed.js, tests/suite.js; document docs/FACILITIES-API.md, DATA-MODEL.md, LARAVEL-MIGRATION.md.

**Interfaces:** Api.facilities.list({type?, active_only?}), get(id), create(input), update(id,{...patch,expected_revision}), setStatus(id,{status,expected_revision}); shared facilityStatus(row), facilityActive(row), facilityLocated(row), facilityProjection(row,user), management scope and validation helpers. Fields retain contact and map_x/map_y; add status, notes, managed_by_barangay_id, revision, actor/time metadata and history. No delete API.

- [ ] Write and run failing tests for CRUD, field/type/coordinate validation, all-role/scope denial, canonical user lookup, legacy defaults/ownership, stale revision conflict and persistence/subscriptions.
- [ ] Implement minimal domain/API changes. Add facilities to subscriptions; preserve schema version and legacy fields. Capture missing legacy rescue snapshots before facility mutations and capture snapshots on new rescue logs. Reject inactive rescue destinations inside the transaction.
- [ ] Run full suite; verify failure atomicity, snapshot stability and new rescue guards. Commit the tested service and contract.

## Task 2: Shared availability rules across consumers

**Files:** resident shared/map/dashboard/announcements/alert; official map/model/dashboard/actions/alert/operational views; captain dashboard/reports as needed; integration tests.

**Consumes:** projected facilities, status helpers and facilities subscription from Task 1.

- [ ] Add failing integration/model tests for resident active-only selection, no fallback claims of nearest, inactive staff map markers, active destination lists, snapshot/current-destination warnings and updates after reactivation.
- [ ] Update consumers and live subscriptions, retaining existing selection/filter/zoom state. Staff maps show labeled muted inactive markers; resident/public recommendations omit them. Rescue destination picker refreshes and disables unavailable facilities, preserving its current choice with a warning until the operator changes it; API revalidates on save.
- [ ] Run full suite and commit.

## Task 3: Directory, forms and map pinning

**Files:** official-facilities.js, new facility form/location dialog modules and official-facilities.css; extend map.js through a focused geometry helper; tests for geometry and browser fixtures; official-facilities.html stylesheet.

**Consumes:** Task 1 API and helpers. BCMap gains an optional draggable marker and centerOn point method; existing marker selection, zoom and pan contracts remain intact.

- [ ] Write failing geometry/browser checks for inverse coordinates after pan/zoom, clamping, optional unpinned location, marker drag/keyboard moves and nested modal cancel/confirm.
- [ ] Build the single Add/Edit form, reference-aligned cards/action menu, confirmation/status feedback and details. Only managers of the record receive edit/status controls. Retain drafts on errors and show revision conflicts. Same-tab/cross-tab refreshes update cards/details.
- [ ] Reuse the existing map image and marker system in the nested location dialog. No arbitrary initial coordinates. Click, drag or keyboard selects a point; confirm stages it in the parent form, cancel preserves its previous point; save commits it with facility data.
- [ ] Compare at desktop/tablet/mobile and test both management roles, both operator roles and resident availability. Run full suite/static/syntax checks and commit.

## Task 4: Review and integration

- [ ] Fresh review of the whole branch; resolve blocking findings with regression tests.
- [ ] Final automated/browser/visual checks, record reproducible QA and documented demo limitations.
- [ ] Push PR, wait for green CI, merge into main as explicitly requested, sync clean XAMPP checkout, verify Pages and clean temporary previews.

Baseline: 0a845d8, 269 tests passed, clean reused checkout on codex/facilities-management.
