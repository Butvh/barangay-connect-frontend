# Captain workspace implementation plan

> For agentic workers: execute focused tasks with tests before implementation and a fresh whole-branch review before merge.

Goal: create editable Captain designs and connected prototype in APP-DEV-Final, then implement the complete responsive Captain workspace using existing administrative pages.

Architecture: vanilla HTML/CSS/ES modules, existing browser-store/API adapter and shared shell/UI/map. Captain is an administrative role with same-barangay Secretary management access; Personnel and Reports remain Captain-only. No runtime dependencies, schema reset, fabricated metrics, applicant process or tanod deletion.

Spec: user attachment fcd3836e-bdbc-476d-8d51-baa65fcbb6a5 and sixteen reference images. Latest user instruction explicitly requests creating Captain designs directly in APP-DEV-Final (GaTDGoek1jzWbcOh9dz4f2), since they are not yet present.

Design: reuse Inter and existing tokens: white #FFF, app #F4F6F9, text #172033, supporting #475467, blue #1E5AA8, borders #D5DBE3. Keep current shell/map and administrative pages; Captain Dashboard has four metrics, three middle panels and three lower panels. Personnel follows the second, corrected reference with direct external additions; centered dialogs. Reports has real counts/charts with explicit unavailable metrics.

## Tasks
- [x] Create Captain frames, shared-page role variants, Personnel dialogs, Reports overview/subpages and prototype connections using existing Figma components. Preserve existing screens.
- [x] Enable Captain auth, navigation, same-barangay administrative policies, relevant notifications and shared-page guards, with negative authorization and regression tests.
- [x] Implement Captain-only personnel service: list/get/addExternal/appoint/reassign/remove; capacities Secretary3/Responder6/Rescuer6; existing Tanod pool fixed; no record deletion. Store metadata/history and synchronize user role flags atomically. Reject busy operational-role changes rather than strand active incidents. Validate dates, duplicates, requirements metadata and stale writes. Existing Captain Roberto Aquino is the sign-in identity; no Figma sample identities replace real records.
- [x] Implement Personnel UI/table/search/filter/pagination, capacity links, tanod list/history, recent additions and centered accessible dialogs; preserve data after cancellation and failed validation.
- [x] Implement source-backed Reports snapshot/model/UI: overview, incident analytics, searchable activity/details, operational analytics, role-specific performance/details, report details/print/export, all reports search/filter/sort/page. Manila month boundaries; absent values remain unknown. No invented victim demographics, hours, ratings, percentages or completion dates.
- [x] Implement distinct Captain Dashboard reusing shared metrics/record styles/map and existing announcement composer; actual data and working links.
- [ ] Full automated/static/syntax/CI, browser tests for all shared pages and personnel/report flows, desktop/tablet/mobile comparisons, fresh review, merge main only green, synchronize XAMPP and verify Pages deployment.

## Interfaces and ownership
Root owns core API/auth/permissions/store/notifications/shell integration, shared page guards, dashboard and final QA.
Personnel worker owns core/personnel.js, pages/captain-personnel*.js, captain-personnel.html, css/captain-personnel.css and tests/captain-personnel.js. Pure domain exports: personnelList(db,user), personnelGet(db,user,id), addExternalPersonnel(db,user,input,at), appointPersonnel(db,user,id,input,at), reassignPersonnel(db,user,id,input,at), removePersonnel(db,user,id,input,at). Api.personnel methods list/get/addExternal/appoint/reassign/remove wrap these with existing read/write transactions. IDs are user IDs; personnel records contain user_id, barangay_id, role, source external/tanod, status Active/Inactive/Unassigned, appointed_at, contact/address/emergency_contact, requirements metadata, notes, history and revision. list returns {records,tanods,capacities,activity}; histories preserve source/actor/effective dates. Legacy staff are projected from users without fabricating personal data. New external demo accounts follow existing demo credential convention, never expose password in projections.
Reports worker owns pages/captain-reports*.js, captain-reports.html, css/captain-reports.css and tests/captain-reports.js. Api.reports.snapshot returns {alerts:joined,verifications:all historical joined,feedback:joined,announcements:managed projections,facilities,users:public,personnel:{records,tanods,capacities,activity},activity_logs,barangays,at,barangay_id}; all strictly scoped. Reports model exposes a documented function for dashboard reuse.
Figma worker owns only Captain-specific Figma sections and design scripts/manifest in .p2-workspace; no application source changes. Send created frame IDs incrementally for design-to-code reads.

## Review focus
1. Capacity races/stale dialogs and role revocation cannot grant extra access.
2. Tanod pool membership/history survives assignment/removal; active incident workflows never stranded.
3. Captain reads/writes remain barangay scoped; other roles cannot use Personnel or Reports.
4. Charts use real denominators/date boundaries, unknown timestamps are never interpreted as zero or today.
5. Every reference interaction has a destination, dialogs remain centered/scrollable and pages work at narrow widths.

Baseline: main a81a313, 215 tests passing, clean existing isolated checkout reused; branch codex/captain-workspace.
