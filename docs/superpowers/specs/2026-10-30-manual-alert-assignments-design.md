# Manual emergency assignments

Implement the user’s supplied manual-assignment brief using the existing vanilla JS, browser store, Web Locks transaction boundary, notification service, and 2D map. No new backend, roster entries, queue, or unrelated redesign.

## Workflow and data

- New SOS remains Pending with no personnel. Acknowledge opens the reference-style personnel picker. `alerts.acknowledge(id,{responder_id,expected_revision,override?})` atomically acknowledges and assigns the selected eligible Responder.
- `alerts.assignmentOptions(id,role)` returns the current alert revision, personnel IDs/names/initials/role, workload, centrally configured limit (Responder 2, Rescuer 1), availability, and current assignment. Include at-capacity personnel as disabled rows, not hidden names. Inactive/foreign-role/foreign-barangay people are excluded.
- Response logs retain type/status/notes/time and add a required boolean `rescue_required`. This explicit choice avoids guessing from notes. A Responding log keeps the slot occupied; Completed ends that assignment. Multiple progress logs remain possible while the responsibility is active.
- Latest explicit assessment governs the rescue gate; existing rescue responsibilities take precedence over the no-rescue shortcut. New logs carry assignment_id so old completion logs cannot end a replacement responsibility. Replacement rescuers may log progress/completion while the incident remains Rescue in progress.
- A recorded rescue-needed response enables `alerts.assign(id,{role:'rescuer',personnel_id,expected_revision,override?})`; no rescuer is chosen by logging a response. A completed response explicitly saying rescue is unnecessary allows administrative resolution without a rescue log. Existing rescue-in-progress administrative resolution remains available and closes remaining responsibilities; it does not fabricate Completed rescue logs.
- Captain-only `alerts.reassign(id,{role,personnel_id,reason,expected_revision,override?})` transfers an active responsibility and retains both records. Captain-only `alerts.cancelAssignment(id,{role,reason,expected_revision})` releases a responsibility without deleting it. Unassigned nonterminal alerts can receive a replacement through the picker. No new incident cancellation status or queue is introduced.
- Every assignment has ID, alert/barangay/personnel/role, assigning official/time, status (active/completed/cancelled/reassigned/closed), end actor/time/reason, optional override authorization/reason. Assignment snapshots retain names and roles if employment later changes. Alert assignment IDs remain the canonical current/historical display/access pointers, cleared on cancellation or replaced on transfer.
- Legacy pointer assignments project into history and workload without resetting saved demo data. Completed/Resolved legacy responsibilities do not occupy capacity; missing historical actors/timestamps remain unknown. Existing assigned rescue operations continue working without inventing assessment flags. New assignments use explicit assessment records.
- Per-alert `assignment_revision` increments on assignment, progress, completion, transfer, cancellation and resolution. UI submits its observed revision. API revalidates role, tenant, active employment, incident state, selection, revision, and capacity inside the fresh serialized store transaction. Concurrent officials cannot overbook ordinary assignments.
- Override payload `{confirmed:true,reason}` is accepted only from the Captain, only for at-capacity personnel, with a nonempty reason (max1000). UI unlocks capacity rows only after selecting Captain emergency override and asks for explicit confirmation before saving. Secretary cannot bypass limits through API payloads.
- Add assignment audit events with official, personnel, incident, old/new assignment, reason and time. Notify new personnel once, officials of assessment/assignment changes, and residents of status changes. Assignment history remains on Alert Detail. Existing assigned-only access continues across list/detail/map/notifications.

## UI and integration

Reference: 676px centered white dialog, 16px radius, navy 26px heading, 16px subtitle, 46px search input, 80px radio selection rows, 50px initials avatars, green Available/red At capacity, right-aligned workload, blue selected border/background, sticky Cancel/Assign footer. Use existing Inter/tokens/icons; list scrolls on smaller viewports and no names/counts are fabricated.

One reusable picker serves acknowledgment, rescue assignment and Captain reassignment from Alert Detail and Map Monitoring. Page actions remain state-driven. Preserve response/rescue forms and destination facility handling, adding only the rescue-needed choice and completion availability checks. Dashboards/personnel busy counts use responsibility state rather than merely unresolved incident count; assignment actor/time must no longer say System for manual work. Other page visuals stay unchanged.

## Future Laravel boundary

The browser demo can validate and serialize cooperative same-origin writes, but cannot secure editable local storage. Document authenticated endpoints, JSON fields/errors, SQL assignment/history fields, role/tenant policies, request validation, and a DB transaction locking both incident and relevant personnel capacity rows in deterministic order. Laravel must authorize every endpoint and enforce capacity independently of supplied counters or client checks.

## Validation and completion

Test no auto assignment, both administrative roles, 0/1/2 workloads, Rescuer1, progress retention/completion release, explicit rescue gate/no-rescue resolution, real/inactive/foreign personnel, stale revisions and two-tab capacity races, duplicate assignment, Captain override/reason enforcement, transfer/cancellation/history/access, notifications, legacy preservation, snapshot refresh persistence, and existing full workflows. Browser-check picker, search, selection, disabled capacity, clear error/empty states, required rescue choice and destination handling, mobile sticky actions. Run static/full suite, independent review, PR checks, then merge main as authorized.
