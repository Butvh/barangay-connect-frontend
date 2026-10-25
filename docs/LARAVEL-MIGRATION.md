# Laravel migration plan

Documentation only: this frontend contains no PHP, SQL or backend server.

## Boundary

Keep browser page modules calling the same Api/Auth interfaces. Replace the
localStorage implementation in api.js with same-origin fetch calls to Laravel
routes, JSON responses and normalized ApiError messages. Laravel owns every
authorization decision, transaction, timestamp, ID, deadline and notification.
Client-side role checks remain presentation helpers only.

Use Laravel session authentication and CSRF protection rather than persistent
browser credentials. Remove demo passwords, quick sign-in and reset from the
production build. The mock sessionStorage tab isolation is a demo convenience;
agree on real multi-account/session behavior explicitly for production.

## Page / route / controller mapping

| Flat frontend page | Blade view | Controller responsibility |
|---|---|---|
| login.html / resident-login.html | auth/login | Authentication, role redirect |
| official-dashboard.html | official/dashboard | Distinct Captain oversight, Secretary and assigned operational dashboards |
| official-alerts.html | official/alerts/index | Search/filter/paginate authorized alerts |
| official-alert.html?id=… | official/alerts/show | Detail, acknowledge, response, rescue, resolve |
| official-map.html | official/map | Authorized markers/facilities |
| official-verifications.html | official/verifications/index | Deadline-aware queue |
| official-verification.html?id=… | official/verifications/show | Approve/reject with reason |
| official-announcements.html | official/announcements | List/store announcements |
| official-feedback.html | official/feedback | Type-specific lists, assignment, resolution |
| official-facilities.html | official/facilities | Public facility metadata scoped as required |
| captain-personnel.html | captain/personnel | Captain-only staffing, fixed Tanod roster, capacity/revision checks and retained appointment history |
| captain-reports.html | captain/reports | Captain-only overview, incident analytics, activity, operations, performance, all reports and record details |
| resident-profile.html | resident/profile | Own profile and household update |

The remaining P2 routes use the same interfaces and data model:

| Flat frontend page | Proposed HTTP route / Blade view | Controller responsibility |
|---|---|---|
| index.html | GET / | Redirect authenticated users through role home; otherwise sign-in. |
| register.html | GET /register, POST /register / auth/register | Create a Resident, household and pending verification atomically. |
| resident-dashboard.html | GET /resident / resident/dashboard | Own SOS, approval gate, sanitized nearby summary and announcements. |
| resident-report.html | GET /resident/report / resident/report | SOS steps, optional details and saved/result state. |
| resident-alert.html?id=… | GET /resident/alerts/{alert} / resident/alerts/show | Owner-scoped joined status/timeline/log destination. |
| resident-map.html | GET /resident/map / resident/map | Public sanitized incidents, own household and available facilities. |
| resident-verification.html | GET /resident/verification / resident/verification | Latest own verification, submission/resubmission and deadline. |
| resident-announcements.html | GET /resident/announcements / resident/announcements/index | Scoped published list. |
| resident-announcements.html?id=… | GET /resident/announcements/{announcement} / resident/announcements/show | Scoped published content. |
| resident-feedback-new.html | GET /resident/feedback/create / resident/feedback/create | Type selection and type-specific forms. |
| resident-feedback.html | GET /resident/feedback / resident/feedback/index | Own feedback, read-only status/rating and details. |
| resident-my-feedback.html | GET /resident/my-feedback | Compatibility redirect to the canonical feedback list. |
| resident-notifications.html | GET /resident/notifications / resident/notifications/index | Recipient-scoped notification list/read/dismiss controls. |

These routes and controller names are a proposed migration map, not routes
implemented by this repository. Preserve the completed Captain workspace and
the shared administrative implementations. Captain and Secretary have the same
same-barangay management authority on Alerts, Map Monitoring, Verifications,
Announcements, Feedback and Facilities; Personnel and Reports remain Captain-only.
An unassigned Tanod has no workspace, while an appointment grants the selected
effective staff role. The official bell and resident notification detail become
shared partials/dialog components. Login remains one service with two views.

The reports page uses `view=overview|incidents|activity|operations|performance|all`
and actual record links; map these to query state or equivalent named routes.
Personnel and report popups remain centered dialogs. Reuse the existing
announcement composer and shared management controllers instead of duplicating
them for Captain.

The HTML shell becomes a Blade layout with header, navigation, bell and dialog
partials. Shared CSS/fonts/icon sprite remain local static assets. Relative
links become Laravel route helpers; query IDs become validated route bindings.

## Data

Turn seed.js into migrations, model factories and a development-only seeder.
Apply the ERD additions in DATA-MODEL.md through reviewed migrations. Use foreign
keys, enum/check validation where supported, and transactions/row locks for
state changes so concurrent acknowledgement cannot advance an alert twice.
Generate timestamps on the server in UTC, serialize ISO timestamps and format
in Asia/Manila on the client. Remove the fixed demo reference clock.

Create barangays/users/households and shared facilities before their dependent
records. Handle the users/households references in a deliberate migration order.
Then create verification, alerts, response/rescue logs, announcements, feedback
and notifications. Index tenant/recipient keys, creation dates and common
status/filter combinations. Keep nullable legacy reporters and shared hospitals
explicit; do not fabricate owners or apply cascading deletion to incident logs
without an agreed retention policy. Backend deletion/retention is a future
product decision: the demo has no general record deletion workflow.

Add personnel records/history and prospective audit tables through additive
migrations. The browser's optional `personnel_records` and `activity_logs`
collections, plus `users.personnel_status`, already tolerate missing legacy
metadata without a schema-version reset. Preserve existing users, Tanod pool
membership, incident assignments and logs. Do not infer old appointment dates,
recruitment sources or audit actors when migrating legacy staff.

Create relationships for alert resident/household/Secretary/assigned staff,
responses with Responder, rescues with Rescuer/facility, verification with
resident/reviewer, feedback with resident/Tanod and announcement with author.
Return API resources with the same joined DTOs while keeping passwords and
private nearby-alert fields excluded. Map coordinates remain percentages on
the illustration. No mapping service, GPS conversion or routing is implied.

## Form Requests and policies

- Registration: valid unique email, password length, full name, valid barangay,
  household address; prohibit every staff role flag in public input.
- Profile: own record only; whitelist editable fields and validate coordinates.
- SOS/details: approved resident, own alert, allowed disaster enum, nullable
  nonnegative integer victim count, bounded text, valid map coordinates.
- Response: assigned Responder, Acknowledged state, allowed response type/status.
- Rescue: assigned Rescuer, Responding state, selectable facility, rescue enum.
- Resolve/acknowledge: Captain/Secretary, same barangay, exact preceding state.
  Acknowledge must find an active local Responder; logResponse must find an
  active local Rescuer before committing its next handoff. If none exists,
  reject the whole transaction, including logs, audit and notifications.
- Verification: Captain/Secretary, current pending submission before deadline, allowed
  decision, rejection reason required; scheduled job for overdue submissions.
  Joined user resources must expose verification only to the resident owner or
  authorized Captain/Secretary; operational views omit it rather than invent a status.
- Feedback: own create/read for residents; Captain/Secretary assignment/resolution for
  the same barangay; General Feedback never has workflow actions.
- Announcements: Captain/Secretary, same barangay, title/content validation.
- Personnel: Captain-only and same barangay for every read/write; enforce
  one effective staff role, occupied-position limits, immutable source,
  optimistic revisions and retained history. Never add/delete Tanod pool
  members through this controller or delete staff to remove an appointment.
- Reports: Captain-only, same-barangay source records and public user DTOs;
  explicit shared hospitals/public barangay lookups do not widen personal data.
- Notifications: recipient only for list/read/clear operations.

Store real uploads using Laravel's filesystem/storage validation and private
access policies. Current filenames are mock metadata, not uploaded documents.
Use database-backed notifications and an agreed polling/broadcast adapter in
place of storage events. Preserve same-tab refresh and subscription cleanup.

### Validation and authorization parity

The limits below come from the current api.js. Enforce them again in Form
Requests and policies; browser checks remain UX helpers, never authorization.
Normalize only the fields the adapter normalizes, and reject unknown sensitive
fields instead of mass-assigning the entire request.

| Request | Required validation / policy |
|---|---|
| RegisterResident | full_name trimmed 1–100; normalized email 1–254, valid and unique; password at least 8; valid barangay; address 1–200; optional contact ≤30; coordinates 0–100. Reject staff role flags. Initialize role, IDs, timestamps and Pending verification on server. |
| UpdateProfile | Owner only. Allow full_name, contact_number, address/household_address and map_x/map_y only; apply the same limits. Email, barangay, roles and verification cannot be changed here. |
| SubmitVerification | Own non-approved residency; document_type 1–100 and file_name 1–200 in the demo. A real file upload needs separately agreed MIME, size, scanning and private-access rules. Seven-day deadline is server-generated. |
| ReviewVerification | Captain/Secretary, same barangay, pending and not past deadline; decision Approved or Rejected; rejection reason trimmed 1–1,000 when rejected. Recheck inside the transaction; do not overwrite another review. |
| CreateSOS / AddAlertDetails | Approved Resident for create; owner/non-resolved for details. Exact disaster enum; description optional ≤2,000; location label ≤200 with household fallback; victim_count null or integer 0–9,999; photo_name optional ≤200; coordinates 0–100. Detail patch whitelist excludes status, roles and assignments. |
| AcknowledgeAlert | Captain/Secretary, same barangay, Pending. Require and assign an active eligible barangay Responder before any write; reject atomically if unavailable. |
| LogResponse | Assigned active barangay Responder, Acknowledged; response_type First aid/Assessment/Evacuation assistance/Other; response_status Responding/Completed; optional notes ≤2,000. Require and assign an active local Rescuer before any write. |
| LogRescue | Assigned barangay Rescuer, Responding; existing shared Hospital or same-barangay EvacuationCenter; rescue_status In progress/Completed; optional notes ≤2,000. |
| ResolveAlert | Captain/Secretary, same barangay, Rescue in progress. Set resolved_at on server; preserve logs. |
| PublishAnnouncement | Captain/Secretary; title 1–200 and content 1–5,000; derive author, barangay and timestamp. |
| CreateFeedback | Resident; exact complaint/suggestion/general enum. Complaint/Suggestion category 1–100, description 1–2,000, optional location ≤200; General rating integer 1–5 and comment 1–2,000, status null. |
| AssignTanod / ResolveFeedback | Captain/Secretary, same barangay; no General actions. Assignment requires Pending and same-barangay Tanod. Resolve accepts Pending/Assigned and rejects already Resolved. |
| NotificationRead / ClearRead | Recipient only. Clearing affects read notifications for that recipient only; never delete another user's records. |
| AddExternalPersonnel | Captain; name 1–100, unique normalized email ≤254, valid contact ≤30 with at least seven digits, address 1–300, emergency contact 1–200, secretary/responder/rescuer, Active/Inactive, valid today/past Manila effective day. Optional notes ≤500; up to 10 PDF/JPG/PNG files, 1 byte–5 MB each. Derive source external, tenant, identity and timestamps on server; never use the demo password in production. |
| AppointPersonnel | Captain; existing same-barangay unassigned Tanod only, available role, valid effective day not before the last removal, notes ≤500, expected_revision. Preserve is_tanod/source/history. |
| ReassignPersonnel / RemovePersonnel | Captain; same-barangay assigned person, expected_revision, valid effective day not before current appointment, notes ≤500. Reassign requires a different available role. Reject unresolved incident assignments in the old operational role. Remove sets role null/status Unassigned and retains the user, Tanod membership and all history. |
| PersonnelList / PersonnelGet / ReportsSnapshot | Captain-only scope checked on every request. Return public DTOs, preserve unavailable values and sanitize all report links/exports. No browser-supplied tenant or role may widen the result. |

The frontend's status enum and a log's status are distinct. Completed response
or rescue entries do not jump to Resolved. Preserve exact forward transitions,
automatic timestamps and notification behavior, and reject concurrent repeats.
Use transactions with row locks for lifecycle decisions. Queue/broadcast work
must run after commit so readers never receive an update for rolled-back data.

### Adapter and error mapping

Keep page modules consuming Api while replacing its storage internals. Reads
become authorized JSON endpoints; writes use POST/PATCH/DELETE as appropriate
with same-origin credentials and Laravel's CSRF protection. Define resource
routes for alerts, verification, announcements, feedback and notifications,
plus explicit lifecycle action endpoints instead of accepting an arbitrary
status patch. A future server API can paginate without changing UI outcomes,
but its envelope must be adapted deliberately because the current API returns
arrays and the pages paginate locally.

Normalize backend failures to the existing ApiError shape: AUTH (401),
FORBIDDEN (403), NOT_FOUND (404), VALIDATION (422 with field messages) and
INVALID_STATE, CONFLICT, CAPACITY and BUSY (409). These HTTP mappings are proposed for the backend; current
mock methods throw JavaScript errors without an HTTP response. Preserve draft
input and inline errors; a session timeout must not silently discard work.

Expose `Auth.current` from server-supplied public session data and keep its
synchronous presentation contract. Login calls the server; logout invalidates
the server session. Revalidate authority on every API request. For real
multi-role testing use isolated browser profiles, since a normal server cookie
session is shared across tabs and does not copy the demo's per-tab sessions.

Replace Api.subscribe with an adapter over authorized private channels or
bounded polling. Keep the six entity names and unsubscribe semantics. Filter
notification channels by recipient and incident channels by tenant/policy;
public nearby updates must use the sanitized DTO, never the private alert.

Official guidance checked for this migration document: Laravel
[Form Requests](https://laravel.com/framework/docs/validation),
[authorization policies](https://laravel.com/framework/docs/13.x/authorization),
[CSRF protection](https://laravel.com/framework/docs/csrf),
[broadcasting](https://laravel.com/framework/docs/broadcasting),
[migrations](https://laravel.com/framework/docs/12.x/migrations) and
[database notifications](https://laravel.com/framework/docs/12.x/notifications).
Select and pin the backend's Laravel version before implementation; this
document adds no Laravel dependency or executable PHP/SQL.

## Deployment checks

Retain the pure alert/permission tests as frontend tests and duplicate the
security/state assertions in backend feature tests. Exercise F-X1–F-X5 with two
sessions and test role/tenant isolation. GitHub Pages hosts the frontend demo
only; it cannot host Laravel. Deploy Laravel to PHP/MySQL hosting separately.

Exercise Captain shared-page parity and Captain-only endpoints with negative
Secretary/operational/resident/foreign-tenant cases. Add concurrent tests for the
last capacity position, duplicate email, stale appointment revisions and a role
change racing with SOS assignment. Verify auth revocation in existing sessions,
no partial incident handoffs, fixed Tanod membership and preserved history.

## Migration acceptance sequence

1. Keep the static frontend demo as a review reference; introduce Blade layouts,
   local assets and named-route equivalents without changing the screens.
2. Migrate auth, tenant policies, models, seeders and API read resources. Remove
   demo passwords, browser data stores and Reset from production.
3. Migrate transactional writes and exact validation/lifecycle rules, including
   private uploads. Test forged roles/tenant IDs, hidden fields and concurrent
   decisions before enabling operational writes.
4. Implement notifications/subscriptions and exercise F-X1–F-X5 with separate
   resident/official sessions: live intake, each alert hop/facility, announcement,
   rejection/resubmission/approval/SOS gate and feedback assignment/resolution.
5. Recheck every breakpoint, keyboard/focus/44 px targets, empty/error/retry and
   dirty-form recovery. Retain explicit missing-artwork/document-preview states
   until actual protected assets exist.
6. Deploy the PHP application separately, with TLS, environment configuration,
   database backups, scheduled verification expiry and queue workers as needed.
   Check the chosen framework version's deployment guidance. Only release after
   P2's tracked nearby-read, icon and mobile-target findings are resolved too.

## Announcement lifecycle endpoints

Map the extended adapter to authenticated Captain/Secretary update/archive/retract routes and a scoped/scheduled expiry task. Enforce optimistic revision checks and append history in the same database transaction. Resident list/detail queries must exclude archived, retracted, unpublished and expired records at read time; an expiry job alone is insufficient for public visibility. Preserve original publication time/author on edit and retain legacy records. Expiry is optional; incoming timestamps require a timezone. Retraction reasons are required (trimmed, 1–500 characters). No restore/delete/scheduled-publication endpoint is introduced by this frontend feature.

## Captain service and production persistence

Preserve `Api.personnel.list/get/addExternal/appoint/reassign/remove` and
`Api.reports.snapshot()` at the transport boundary. Suggested routes are
GET `/captain/personnel`, GET `/captain/personnel/{user}`, POST
`/captain/personnel/external`, POST `/captain/personnel/{user}/appoint`,
POST `/captain/personnel/{user}/reassign`, POST `/captain/personnel/{user}/remove`
and GET `/captain/reports/snapshot`. These are proposed Laravel routes, not
currently deployed endpoints; role removal is an assignment change, not DELETE.

Lock the person, relevant tenant/role capacity records and operational assignment
state consistently inside one database transaction. Recheck Captain authority,
tenant, current revision, target capacity and active incident assignments there.
Secretary/Responder/Rescuer limits are 3/6/6 occupied positions, including Inactive
appointments. Change assignment history, role flags/effective role, personnel
status, revision and audit atomically. Removing a role must revoke it for existing
sessions without deleting the account or any incident records. Tanod membership
and source remain immutable through these APIs. Do not permit public mass
assignment of any staff flag, personnel status, tenant or source field.

Require revisions for server-side personnel mutations and map stale conflicts
back to preserved drafts. Enforce global case-insensitive email uniqueness with
a database constraint as well as request validation. Validate appointment days
against the server's Asia/Manila calendar; future scheduling is outside this
feature. Provision real external accounts through an agreed protected invitation
or credential flow rather than `demo1234`.

Current file entries are metadata only. A production upload endpoint must validate
actual contents/MIME, extension, count and size, use protected storage and
authorized retrieval, and apply the agreed scanning/retention policy. The browser
file name/type/size fields are not proof that a file exists or is safe.

Reports should retain the same scoped snapshot or an explicitly adapted query
contract. Monthly boundaries are Asia/Manila. First recorded response intervals,
completed rescue incidents, known assisted counts, review dates and role-specific
work use their real source dates. Missing legacy completion times, victim counts,
hours or ratings remain null/unavailable; do not substitute zero or creation time.
Current resolved feedback totals are distinct from complete monthly resolution
totals. Preserve sample coverage and partial-history explanations in server DTOs.

Create prospective append-only audit rows in the same transaction as domain
changes, with tenant, affected record, action, actor identity/role, effective
event `at` and processing `recorded_at`. A late expiry processor records the
deadline as event time and its actual run time separately, with System actor;
it must not attribute expiry to the visiting user. Preserve actor snapshots and
do not fabricate legacy events. Reports pair equivalent source/audit evidence
once while keeping distinct edits and response/rescue logs. Apply the same
deduplication and role-at-event attribution if analytics move to the server.

Keep audit and appointment history under authorized read/retention policies.
Broadcast only committed changes through permitted tenant/recipient channels;
the current six browser subscription names stay compatible, with staffing
changes delivered through users. Do not expose credentials in any DTO or export.
