# Manual Alert Assignments Implementation Plan

> Execute inline with superpowers:executing-plans. Each task uses test-first implementation and review before merge.

**Goal:** Manual, capacity-checked Responder/Rescuer dispatch matching the supplied dialog.
**Architecture:** Shared assignment policy and history functions operate inside the existing transactional demo API. One picker uses that API from Alert Detail and Map Monitoring; existing read projections drive other views.
**Tech Stack:** Vanilla ES modules, CSS, browser local/session storage and Web Locks, package-free Node tests.
**Spec:** ../specs/2026-10-30-manual-alert-assignments-design.md

## Constraints and review focus

No automatic personnel choice; limits2/1 configured centrally; no fake names, history, backend or queue. Preserve roster/access/tenant restrictions and existing panel design. Watch stale modals, employment changes during selection, reassignment after old logs, legacy assignments lacking provenance, and same-person concurrency. Browser checks must use ordinary UI; special fixtures belong only in isolated test stores.

## 1. Assignment policy and transactional API

Files: new `assets/js/core/assignments.js`, `tests/assignments.js`; modify config/api/alertMachine/activity/personnel and suite registration.

Interfaces: `assignmentRecords(db)`, `assignmentWorkload(db,userId,role)`, `assignmentFlags(db,alert)`, `assignmentOptions(db,user,id,role)`, `assignPersonnel(db,user,alert,role,input,at)`, `endAssignment(...)`. API exposes assignmentOptions/acknowledge/assign/reassign/cancelAssignment. Expected revision is mandatory for dispatch mutations. Existing log APIs require the active responsibility; response payload adds explicit rescue_required.

- [x] Add failing tests for limits, state gates, roles, stale/concurrent writes, override, transfer/cancel/release, history and legacy behavior; run to observe failure.
- [x] Implement central policy, fresh transactional API validation, status transitions, no automatic handoffs, per-alert revision and assignment audit/notifications.
- [x] Adapt existing tests that intentionally asserted automatic handoffs to explicit dispatch; retain their original authorization/persistence/notification assertions. Verify all tests.

## 2. Reference picker and operational integration

Files: new `assets/js/pages/official-assignment.js`, `assets/css/official-assignment.css`; modify official-alert/actions/map, affected dashboards/models and personnel detail workload values; load scoped CSS in relevant HTML.

Interface: `assignAlert(alert,{role,mode,saved})` opens a dialog, queries current options, refreshes on alerts/users events, validates selection again before submit, and invokes the appropriate API. `mode` is acknowledge/assign/reassign; Captain override has required reason and explicit confirmation. Cancellation uses existing confirmation style with reason.

- [x] Add pure picker-render tests for escaping, one selection, unavailable states, real counts and role labels, plus dashboard responsibility-state regression tests.
- [x] Implement scrollable radio-card dialog and sticky footer; integrate every acknowledge/assign route and remove automatic-assignment copy.
- [x] Add response rescue-needed field; show assignment names, state and history with Captain reassign/cancel actions; preserve original alert detail layout and facility selection.
- [x] Verify desktop/tablet/mobile, search, stale selection, cross-role dispatch/notifications, progress/completion, and record navigation.

## 3. Backend contract, review and merge

Files: new `docs/ASSIGNMENTS-API.md`; update CONTRACT/LARAVEL-MIGRATION and workflow documentation as necessary.

- [x] Document request/response fields, endpoints, validation/errors, permissions, assignment table/indexes, revision/history and Laravel transaction locking. Explain browser-demo authorization limitations.
- [x] Run `node scripts/check.mjs`, `node scripts/run-tests.mjs`, `git diff --check` and independent code review. Fix material findings.
- [ ] Create PR, await GitHub checks, merge main, sync clean XAMPP checkout, rerun checks and verify deployment.
