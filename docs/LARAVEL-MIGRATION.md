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
| official-dashboard.html | official/dashboard | Scoped statistics and assigned work |
| official-alerts.html | official/alerts/index | Search/filter/paginate authorized alerts |
| official-alert.html?id=… | official/alerts/show | Detail, acknowledge, response, rescue, resolve |
| official-map.html | official/map | Authorized markers/facilities |
| official-verifications.html | official/verifications/index | Deadline-aware queue |
| official-verification.html?id=… | official/verifications/show | Approve/reject with reason |
| official-announcements.html | official/announcements | List/store announcements |
| official-feedback.html | official/feedback | Type-specific lists, assignment, resolution |
| official-facilities.html | official/facilities | Public facility metadata scoped as required |
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
implemented by this repository. Keep the existing role split; do not turn
Captain/Tanod seed data into new workspaces during migration. An official bell
and resident notification detail become shared partials/dialog components,
not additional pages. Login remains one authentication service with two views.

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
- Resolve/acknowledge: Secretary, same barangay, exact preceding alert state.
- Verification: Secretary, current pending submission before deadline, allowed
  decision, rejection reason required; scheduled job for overdue submissions.
- Feedback: own create/read for residents; Secretary assignment/resolution for
  the same barangay; General Feedback never has workflow actions.
- Announcements: Secretary, same barangay, title/content length validation.
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
| ReviewVerification | Secretary, same barangay, pending and not past deadline; decision Approved or Rejected; rejection reason trimmed 1–1,000 when rejected. Recheck inside the transaction; do not overwrite another review. |
| CreateSOS / AddAlertDetails | Approved Resident for create; owner/non-resolved for details. Exact disaster enum; description optional ≤2,000; location label ≤200 with household fallback; victim_count null or integer 0–9,999; photo_name optional ≤200; coordinates 0–100. Detail patch whitelist excludes status, roles and assignments. |
| AcknowledgeAlert | Secretary, same barangay, Pending. Assign eligible barangay Responder on server. |
| LogResponse | Assigned barangay Responder, Acknowledged; response_type First aid/Assessment/Evacuation assistance/Other; response_status Responding/Completed; optional notes ≤2,000. Assign eligible Rescuer on server. |
| LogRescue | Assigned barangay Rescuer, Responding; existing shared Hospital or same-barangay EvacuationCenter; rescue_status In progress/Completed; optional notes ≤2,000. |
| ResolveAlert | Secretary, same barangay, Rescue in progress. Set resolved_at on server; preserve logs. |
| PublishAnnouncement | Secretary; title 1–200 and content 1–5,000; derive author, barangay and timestamp. |
| CreateFeedback | Resident; exact complaint/suggestion/general enum. Complaint/Suggestion category 1–100, description 1–2,000, optional location ≤200; General rating integer 1–5 and comment 1–2,000, status null. |
| AssignTanod / ResolveFeedback | Secretary, same barangay; no General actions. Assignment requires Pending and same-barangay Tanod. Resolve accepts Pending/Assigned and rejects already Resolved. |
| NotificationRead / ClearRead | Recipient only. Clearing affects read notifications for that recipient only; never delete another user's records. |

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
INVALID_STATE (409). These HTTP mappings are proposed for the backend; current
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
