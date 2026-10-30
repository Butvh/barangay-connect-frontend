# Manual alert assignments — demo and Laravel contract

Current implementation: browser demo only. All identities/data are fictional. No PHP, Laravel server, migration or MySQL database is installed by this change. Replace the `Api` adapter when the authenticated backend is ready; the assignment picker does not access browser storage directly.

## Capacity and workflow

`Config.assignment_limits` is the single configuration source: Responder **2**, Rescuer **1** concurrent responsibilities. Deployment/backend configuration may change these limits; requests may not supply or override them. Employment status (Active/Inactive) is separate from assignment availability (Available/At capacity).

Counts derive from assignment records with status `active`, not a manually incremented counter. A `Responding` response or `In progress` rescue retains a slot. `Completed` closes that responsibility without automatically resolving the incident. Cancellation, transfer or official incident resolution also releases the slot and records its end. Two responder slots do not create a new queue or imply two separate operational stages.

1. Resident creates Pending SOS with both assignee pointers null.
2. Captain/Secretary reads assignment options and explicitly selects a responder. Acknowledgment and assignment commit together; neither happens if any check fails.
3. Assigned responder logs type/status/notes plus boolean `rescue_required`. No rescuer is automatically assigned. Latest explicit assessment for the current responder assignment governs new dispatch. Free-text notes are not parsed.
4. A rescue-needed assessment enables manual rescuer assignment. An active rescue takes precedence over a no-rescue shortcut; a responder cannot record false while a rescue responsibility remains active. After rescue cancellation, a newer false assessment blocks dispatch again. Replacement rescue may continue during `Rescue in progress`.
5. Captain/Secretary resolves `Rescue in progress`, or `Responding` when the response is Completed and explicitly says rescue is unnecessary. Resolution closes any remaining active responsibilities, preserving logs exactly: it never manufactures Completed response/rescue entries.

Only Captain may transfer or cancel active responsibilities, or approve a workload override. Override requires explicit confirmation and a nonempty reason (max1,000 characters), and is only accepted for personnel already at capacity. Prefer transferring work where practical. Ordinary Secretary assignments cannot exceed limits through a different route or payload.

## Endpoints and frontend adapter

All endpoints authenticate the current user and derive their barangay/role server-side. List/show policies must enforce the same scope; filters cannot widen it. IDs below are positive integers. JSON uses the field names below; map Laravel responses to the existing camelCase adapter methods.

| Method and future route | Existing frontend method | Authorization / payload |
| --- | --- | --- |
| POST `/api/alerts` | `alerts.create(input)` | Approved Resident; existing SOS validation. Never accept assignment/status/tenant fields. |
| GET `/api/alerts/{id}/assignment-options?role=responder` | `alerts.assignmentOptions(id,role)` | Captain/Secretary, same barangay; exact role responder/rescuer. Returns eligible actual active roster, including disabled at-capacity people. |
| POST `/api/alerts/{id}/acknowledge` | `alerts.acknowledge(id,input)` | Captain/Secretary; Pending; `responder_id`, `expected_revision`, optional `override`. |
| POST `/api/alerts/{id}/assignments` | `alerts.assign(id,input)` | Captain/Secretary; `role`, `personnel_id`, `expected_revision`, optional `override`; valid assessment/stage; no active duplicate. Pending must use atomic acknowledge. |
| POST `/api/alerts/{id}/assignments/reassign` | `alerts.reassign(id,input)` | Captain only; `role`, different `personnel_id`, `reason`, `expected_revision`, optional `override`; existing active responsibility required. |
| POST `/api/alerts/{id}/assignments/cancel` | `alerts.cancelAssignment(id,input)` | Captain only; `role`, `reason`, `expected_revision`; retains incident and history, clears that pointer. Not an incident cancellation endpoint. |
| POST `/api/alerts/{id}/responses` | `alerts.logResponse(id,input)` | Current active assigned Responder; allowed in Acknowledged/Responding/Rescue in progress. `response_type`, `response_status`, required boolean `rescue_required`, optional `notes`≤2,000. Server derives assignment_id/actor/time. |
| POST `/api/alerts/{id}/rescues` | `alerts.logRescue(id,input)` | Current active assigned Rescuer; Responding/Rescue in progress. `facility_id`, `rescue_status`, optional `notes`≤2,000. Existing active/local-or-shared facility policy remains. |
| POST `/api/alerts/{id}/resolve` | `alerts.resolve(id)` | Captain/Secretary, same barangay; workflow conditions above. |
| GET `/api/alerts/{id}` | `alerts.get(id)` | Admins: same barangay. Operators: exact current assignee pointer. Resident: own record only. Full assignment history/reasons are administrative; residents/operators receive status and their authorized operational data. |
| GET `/api/reports/snapshot` | `reports.snapshot()` | Captain only; includes same-barangay assignment audit events alongside existing report records. |

Current browser picker examples:

```json
{"responder_id":2,"expected_revision":0}
```

```json
{"role":"rescuer","personnel_id":3,"expected_revision":2}
```

```json
{"role":"responder","personnel_id":20,"reason":"Transfer to the available unit.","expected_revision":3,"override":{"confirmed":true,"reason":"Immediate emergency; no other available responder."}}
```

`override` is omitted for ordinary dispatch. Confirmed must be JSON boolean true, not a truthy string. Reasons are trimmed, nonempty strings≤1,000. ID must identify an active user of the exact effective role and same barangay. Role flags, workload, limit, availability, author and timestamps supplied by clients are never authoritative.

Assignment options shape:

```json
{
  "alert_id":1042,"alert_revision":2,"role":"rescuer","limit":1,
  "personnel":[{"id":3,"full_name":"Ramon Bautista","role":"rescuer","workload":1,"limit":1,"assigned":false,"at_capacity":true,"available":false}],
  "current_assignment":null,
  "can_assign_responder":false,"can_assign_rescuer":true
}
```

The browser also returns the administrative `assignments` history and workflow flags. Alert DTO adds assignment_revision, active_responder_assignment, active_rescuer_assignment, responder_assignment_status, rescuer_assignment_status, responder_assigned_at/rescuer_assigned_at, assigned official names, rescue_required, response_completed, and dispatch eligibility flags. The UI always rechecks at save time; returned flags do not authorize a write.

Errors use `ApiError {code,message,fields?}`: AUTH401; FORBIDDEN403; NOT_FOUND404; CONFLICT409 for stale revision; CAPACITY409 for workload; INVALID_STATE409 for stage/duplicate/completed responsibility; VALIDATION422 for invalid selection/boolean/reason. Laravel adapter must preserve these code distinctions and field errors. Validation rejection changes no assignment, status, revision, audit or notification.

## Proposed MySQL records

Retain existing users, emergency_alerts, alert_responses, rescues and activity_logs.

| Record | Additional fields / rules |
| --- | --- |
| emergency_alerts | assignment_revision unsigned integer default0; existing assigned_responder_id/assigned_rescuer_id nullable FKs; pointers identify the most recent assigned person and stay on completion/closure, clear on cancellation, replace on transfer. Pending starts null/null. |
| alert_assignments | id PK; alert_id, barangay_id, user_id FKs; role responder/rescuer; assigned_by FK; assigned_at timestamp; personnel_name and assigned_by_name audit snapshots; status active/completed/cancelled/reassigned/closed; ended_by nullable FK, ended_at nullable timestamp, end_reason nullable varchar1000; override_by nullable FK, override_at nullable timestamp, override_reason nullable varchar1000; legacy boolean. |
| alert_responses | assignment_id nullable FK for historical rows, mandatory for new writes; rescue_required nullable boolean for legacy, mandatory boolean for new writes. Keep existing response_type/status/notes/responded_at/responder_id. |
| rescues | assignment_id nullable FK for legacy, mandatory for new writes. Keep destination facility snapshot and original log dates/actors. |
| activity_logs | Existing actor, recorded role, event time and linked incident; new assignment_id/personnel_id/assignment_role fields for dispatch/transfer/cancellation/override. Reason belongs in the audit summary or structured metadata. Append-only authorization history. |

Index `(user_id,role,status)`, `(alert_id,role,status)` and `(barangay_id,assigned_at)`. Enforce at most one active assignment per incident/role (for MySQL, a nullable generated active-role key with a unique constraint, or equivalent transactional policy). Do not make alert_id globally unique: one incident needs historical transfers and both operational roles. Reference records should be retained; do not cascade-delete operational history when personnel leave a role.

## Authorization, locking and synchronization

Use Laravel authentication middleware plus policies/gates on every read/write. Require tenant scope from the authenticated account, exact active effective role for assignees, and current assignment ownership for logs. A Resident, Responder, Rescuer or inactive staff member cannot call dispatch endpoints. Only Captain policy can approve override/reassign/cancel. Never rely on hidden buttons or user-supplied is_captain flags.

Run each dispatch/log-completion/cancellation/resolution in a database transaction. Lock all affected personnel capacity rows in ascending ID order, then the incident; reread its revision/state and the relevant active assignments; recalculate workload; apply change/history and increment revision atomically. Transfers lock both old and new personnel rows. All write paths must use the same locking discipline so a count query cannot race another insertion. The assignment uniqueness rule complements capacity locking. Publish notifications/broadcasts only after commit; deduplicate the selected operator’s handoff notification.

The demo uses the same checks inside `Store.transact`, a fresh synchronous read-to-commit and Web Locks for cooperative same-origin tabs. Storage events refresh open pickers and affected views; selection is cleared if its incident changed or capacity is lost. Browsers/devtools/storage owners can edit client data and remove these checks. Real authorization, tamper protection, multi-device concurrency, durable audit and configurable limits require Laravel/MySQL enforcement; the demo is not that security boundary.

## Legacy and test policy

Existing persisted data is not reset. Unmigrated pointers project as legacy assignment records without invented officials/assignment times. Only that pointer person’s valid logs can establish completion. Before changing a legacy assignment, materialize its history inside the same transaction, preserving prior completion actor/time. New logs carry their current assignment_id; old logs cannot complete a new person’s transferred responsibility. Already assigned legacy rescues continue without fabricated rescue_required values.

Automated coverage lives in tests/assignments.js plus the existing cross-role, notifications, facilities, dashboards and lifecycle suites. Run `node scripts/check.mjs`, `node scripts/run-tests.mjs`, `git diff --check`. Browser verification covers the supplied radio-card design, search, selection, disabled capacity, explicit rescue choice, live updates between officials, destinations, and responsive access to footer actions.
