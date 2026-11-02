# Facade-to-API mapping — proposed v1, pending team review

All paths below have `/api/v1` prefix. Only the four session/CSRF routes are implemented in the foundation. Every other entry is an integration contract, not a claim of a live endpoint. P1 owns shared `config.js`, `auth.js`, `api.js`, `adapters/http.js` and the factory seam; coordinate edits there through a small reviewed PR.

Use numeric IDs and current DTO/status/null semantics. List envelopes must provide full scoped records where current pages compute totals, or explicit aggregates and pagination adapted before enabling that page. Never silently return one page to a full-list caller.

## P1

| Existing facade / consumer | Proposed endpoint | Projection / compatibility requirement |
| --- | --- | --- |
| Auth login/logout/current/requireRole | POST auth/login, POST auth/logout, GET me | Session routes implemented; persistent model integration pending. Current/guard reads hydrated memory, never storage IDs. |
| CSRF transport | GET auth/csrf | Implemented; new token fetched after login/logout, no automatic replay of writes. |
| barangays.list | GET barangays | Public minimal id/name/map-availability list; not residents or full tenant metadata. |
| users.register | POST auth/register | Resident + household atomically; strict protected-field rejection, password policy; documents are a separately authorized submission. Existing registration flow signs in before upload. |
| users.get(self), householdUser, verificationFor | GET profile | Own user + household + latest verification projection with genuine nulls. GET household may be used by a dedicated editor. |
| users.get(other) in official feedback/map | No unrestricted user directory | P2 must replace the fixed Tanod ID lookup with its authorized assignee projection, and supply authorized complaint-household joins. Review any additional P1 read contract; no operational-role access to arbitrary resident profiles. These callers are explicitly pending, not omitted. |
| users.update(self,patch) | PATCH profile | Current facade returns updated user/household. Whitelist role-dependent fields; a combined resident name/contact/address update stays atomic. PATCH household is for dedicated paired pin/address updates, not a split partial-save workaround. |
| account.security | GET account/security | Actual server capability; remain false until password service is integrated. |
| account.changePassword | POST account/password | Current/password/confirmation bytes preserved; `{password_changed:true}` only after commit/revocation. |
| recovery.requestCode | POST password-recovery/requests | Neutral known/unknown/ineligible reply with opaque challenge, expires_in600, retry_after>=60. |
| recovery.verifyCode | POST password-recovery/verifications | Six digits, keyed digest, five failed attempts, supersession/expiry; one-use reset authorization. |
| recovery.resetPassword | POST password-recovery/resets | Atomic consume + update + session/other reset revocation; no autologin; no codes in logs/events. |
| verification.list(options), resident latest lookup | GET verifications | Latest per resident, own-only or Captain/Secretary barangay scope. Full queue or explicit aggregate contract. |
| verification.get(id) | GET verifications/{id} | Application + immutable submission history, exact revision/deadline/reviewer, authorized private document links. |
| verification.submit(userId,input) | POST verifications or POST verifications/{id}/submissions | Actor-derived owner; multipart actual ID/proof bytes (not filenames), idempotency/expected_revision. Same application for Pending/correction, new application for Rejected/Expired; Approved final. |
| verification.review | POST verifications/{id}/decisions | Approved, Rejected, Resubmission requested; reason/checklist/exact submission revision; stale409. |
| verification.expireOverdue | Server expiry service/scheduler; scoped synchronize route to agree | Current client calls this on refresh. Do not pretend it is complete with a no-op or let the client choose time/status. Correction-awaiting does not expire. Freeze the compatibility endpoint with DBA/P2 before enabling the adapter. |
| Document preview/download | GET documents/{id}/download | Authenticated owner/authorized reviewer; private streaming bytes; no public URL/symlink. |
| personnel.list | GET personnel | `{records,tanods,capacities,activity}` aggregate for Captain's own barangay; occupied positions include inactive roles. |
| personnel.get | GET personnel/{id} | Captain-scoped detail/history/busy IDs/revision/assignment workload. |
| personnel.addExternal | POST personnel/external | FormData: validated identity/role/date/private requirements, no demo password; shared slot locks + audit/outbox. |
| personnel.appoint | POST tanods/{id}/appointments | Fixed existing Tanod pool, preserve resident membership; expected revision. GET tanods is Captain's directory projection. |
| personnel.reassign/remove | POST personnel/{id}/reassignments or /removals | Retain account/history; shared busy-role lock with dispatch; Tanod back to pool, external to Unassigned. |
| facilities.list/get | GET facilities, GET facilities/{id} | Actual map visibility, canonical Hospital/EvacuationCenter with input alias; active-only where required; history authorization. |
| facilities.create/update | POST facilities, PATCH facilities/{id} | Managing-barangay authority distinct from shared referral visibility; expected_revision on edit. |
| facilities.setStatus | PATCH facilities/{id}/status | Active/Inactive; revision/locks; keep rescue snapshots. |
| Existing facility pin editor | PATCH facilities/{id}/location (adapter may retain facilities.update) | Paired null or 0–100 percentages including0,0. Current full-record validation and coverage rules stay authoritative. |

Registration currently passes only file names to the demo verification facade; personnel requirements also carry only metadata. P1 must update those upload boundaries to FormData/File bytes during their persistent slices. Metadata-only requests must fail validation in backend mode, never claim a private upload succeeded. No upload controller is shipped in the foundation.

## P2 — route names to agree with its owner

The frontend signatures below are inventoried so the shared facade seam is complete. P1 does not implement these endpoints, services, writers or adapters.

| Facade methods | Proposed route group / detail |
| --- | --- |
| alerts.list/get/create/addDetails | GET/POST alerts, GET/PATCH alerts/{id}; nearby=true must keep the resident redacted DTO; owner/assignee/barangay scoping server-side. |
| alerts.assignmentOptions/acknowledge | GET alerts/{id}/assignment-options, POST alerts/{id}/acknowledge; explicit responder + expected revision. |
| alerts.assign/reassign/cancelAssignment | POST alerts/{id}/assignments, /assignments/transfer, /assignments/cancel; Captain-only transfer/cancel/ratified emergency override. |
| alerts.logResponse/logRescue/resolve | POST alerts/{id}/responses, /rescues, /resolve; real logs, manual rescuer handoff, facility active check + historical snapshot. |
| announcements.list/get/create/update/archive/retract/expireOverdue | announcements collection/detail/actions plus server expiry; exact Active/Archived/Retracted semantics; no client clock authority. |
| feedback.list/get/create/assignTanod/resolve | feedback collection/detail/assignment/resolution; General Feedback remains rating/comment without workflow status. Secretary assignee lookup requires its own minimal Tanod projection, not Captain personnel access. |
| notifications.list/get/markRead/markUnread/dismiss/markAllRead/clearRead | Recipient-scoped notifications routes/actions; validate expected recipient/role; safe links and expiry/access revocation. |
| dashboard.officialStats | GET dashboard/official | Complete scoped aggregates; no totals calculated from a paginated subset. |
| reports.snapshot | GET reports/snapshot | Captain-only complete same-barangay projections and actual nullable historical audit fields. |
| Api.subscribe | Authenticated scoped revision readers | `refreshSources` returns stable revision strings/numbers; unsubscribe/teardown included by P1; P2 supplies authorized domain reads. |

DBA owns `routes/integrations.php`, delivery/provider jobs, delivery ledgers and `config/messaging.php`. P1's route loader includes that file when present, but webhook CSRF/signature placement still needs a P1-reviewed bootstrap change. No Make/Semaphore credential belongs in a browser adapter.
