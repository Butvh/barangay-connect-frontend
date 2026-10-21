# Browser demo data and authorization

Person 1 owns the mock data/auth adapter. The exact shared contract is in
CONTRACT.md. All identities are fictional; `demo1234` is a demo credential only.

The versioned store has `version`, `revision`, `updated_at`, and arrays named
`barangays`, `users`, `households`, `verify_residency`, `facilities`,
`emergency_alerts`, `alert_responses`, `rescues`, `announcements`,
`community_feedback`, `notifications`. Records use integer IDs, snake_case
fields and ISO dates with the `+08:00` offset. Data changes are committed as one
transaction before subscriptions fire. Read results are deep copies.

## Seed identities

| User ID | Identity | Role / household |
|---|---|---|
| 1 | Ana Reyes | Secretary |
| 2 | Carlo Mendoza | Responder |
| 3 | Ramon Bautista | Rescuer |
| 4 | Maria Santos | Approved Resident, household 1, 14 Riverside Street |
| 5 | Jose Dela Cruz | Pending Resident, household 2, 8 Mabini Street |
| 6 | Luis Garcia | Tanod, data only |
| 7 | Roberto Aquino | Captain, data only |

Barangays 1/2/3 are Sampaguita/Dalisay/Pag-asa. Facility 1 is Sampaguita
Elementary School (EvacuationCenter, capacity 250); facility 2 is Dalisay
District Hospital (Hospital, contact (02) 8000-0000). Hospitals are selectable
across barangays; evacuation centers are scoped to the user's barangay.
Alert IDs 1042/1038/1031 retain the exact shared seed cases and October dates.
Reporterless seed cases have nullable resident/household fields.

## State and access rules

The alert machine permits only Secretary acknowledge, assigned Responder
response, assigned Rescuer rescue with a destination, and Secretary resolve, in
that order. Each write rechecks the current stored role and state inside the
transaction. The first barangay Responder/Rescuer is assigned at the appropriate
handoff. Resident reads are limited to their own records; official reads/writes
are barangay scoped. Unapproved residents cannot create SOS alerts.

Only Secretary reviews verification, publishes announcements, assigns a Tanod,
or resolves feedback. Only a resident can create feedback. General Feedback has
a rating/comment and no status or assignment/resolution action. Notifications
are private to their recipient. No profile endpoint permits role escalation.

Residency deadline is submitted_at + seven days. Rejection requires a reason.
Only pending, unexpired submissions can be reviewed. Expiry does not invalidate
an already approved residency. Resubmission creates a fresh historical record;
the current queue takes the latest submission.

The five F-X integration paths are implemented through shared records and
notifications. Auth uses sessionStorage per tab; domain data uses localStorage
and the storage event. A same-tab subscription fires after each successful
commit. Browser storage is an offline mock and must not be mistaken for secure
production storage.

## ERD changes needed

Carry these items into the maintained shared DECISIONS document with a P1
prefix (that file belongs to the scaffold owner):

- assigned_responder_id and assigned_rescuer_id on emergency_alerts.
- location_label, map_x and map_y on emergency_alerts.
- map_x/map_y on households and facilities.
- barangay_id on alerts as an immutable reporting scope; derive from resident.
- Nullable resident_id/household_id for legacy alerts whose reporter is not
  provided; do not invent a resident for A-1038/A-1031.

Additional seeded status timestamps and log notes make already-progressed
sample records coherent; they are fictional, not individual victim records.

## Stored records and relationships

The following dictionary describes the current mock schema, not an implemented
database. All `id` values are positive integers generated inside a transaction.
Foreign keys below are logical relationships checked by the adapter; Laravel
must enforce the corresponding database constraints and policies.

| Collection | Fields beyond id | Relationships / invariants |
|---|---|---|
| barangays | name, map_image | Parent scope for households, users, alerts, feedback and announcements. Sampaguita artwork is local; the other two map_image values are null. |
| users | full_name, email, contact_number, password, barangay_id, household_id, is_resident, is_secretary, is_tanod, is_captain, is_responder, is_rescuer, created_at | Email is case-insensitively unique. household_id is nullable for staff. Role booleans cannot be changed through public registration/profile. password exists only in the demo's stored records and is excluded from publicUser responses. |
| households | barangay_id, address, map_x, map_y | Coordinates are 0–100 percentages of the illustrated map, not GPS. Linked by users.household_id and alerts.household_id. |
| verify_residency | user_id, document_type, file_name, review_status, submitted_at, deadline_at, reviewed_by, reviewed_at, rejection_reason | Many historical submissions per resident; list/get-user selects the latest. reviewed_by/at are nullable. Pending resubmission updates the pending record; resubmission after rejection/expiry creates a new record. Approved residents cannot resubmit. |
| facilities | type, name, address, capacity, contact, barangay_id, map_x, map_y | type is Hospital or EvacuationCenter (display: Evacuation Center). Evacuation centers belong to a barangay; hospitals have null scope and are shared. capacity is nullable; never interpret unknown as zero. |
| emergency_alerts | barangay_id, resident_id, household_id, acknowledged_by, assigned_responder_id, assigned_rescuer_id, alert_type, description, location_label, map_x, map_y, victim_count, photo_name, status, created_at, acknowledged_at, resolved_at | resident_id/household_id may be null for the legacy seed cases. Assignments and lifecycle timestamps start null. Reporting barangay is derived from the resident, not accepted as a user override. victim_count null displays Not confirmed on official views. |
| alert_responses | alert_id, responder_id, response_type, response_status, notes, responded_at | Child of an alert and the assigned Responder. A response advances Acknowledged to Responding even when the response log's status is Completed. |
| rescues | alert_id, rescuer_id, facility_id, rescue_status, notes, rescued_at | Child of an alert, assigned Rescuer and chosen facility. A rescue log advances Responding to Rescue in progress; its Completed status does not resolve the alert. |
| announcements | barangay_id, posted_by, title, content, created_at | Secretary author, scoped to the barangay. No edit/delete/schedule/category fields or API. |
| community_feedback | resident_id, barangay_id, type, created_at, category, description, location, status, assigned_tanod_id, rating, comment | Complaint/Suggestion use status; General has status null, rating/comment and no workflow actions. No title, assigned_at or resolved_at is persisted. Current totals cannot imply assignment/resolution happened today. |
| notifications | user_id, kind, text, link, is_read, created_at | Recipient-private. link is a relative allowlisted destination, not an external URL. kinds: alert_new, alert_status, verification, announcement, feedback_update. |

One barangay has many residents, households and incidents. One resident can have
many alerts, verification submissions and feedback records. One alert has many
response/rescue logs; timeline is a joined projection, not a separate collection.
One facility can be the destination of many rescues. One user receives many
notifications. Counts on dashboards and feedback/verification pages are derived,
not additional stored counters.

## Exact enums and transitions

| Domain | Accepted values / transitions |
|---|---|
| Disaster | Fire, Flood, Typhoon/Storm, Landslide, Earthquake, Other. A-1038 Fallen tree is Other. |
| Alert | Pending → Acknowledged → Responding → Rescue in progress → Resolved; no backward or skipped hop. |
| Response type | First aid, Assessment, Evacuation assistance, Other. |
| Response status | Responding, Completed. |
| Rescue status | In progress, Completed. |
| Verification | Pending, Approved, Rejected, Expired. Only a current pending submission within its deadline can be reviewed. |
| Feedback type/status | complaint / suggestion: Pending → Assigned → Resolved, or Pending → Resolved. general: null status. |

Acknowledgement selects the first barangay Responder in the demo. A logged
response selects the first barangay Rescuer. Secretary resolves only after
Rescue in progress. Responder/Rescuer actions require the stored assigned ID.
Captain and Tanod remain data-only identities; no sign-in workspace or role
management has been added for them. Feedback assignment validates the Tanod's
flag and barangay, rather than granting that person another application role.

## Read projections, tenancy and live changes

- API reads return copies. Joined records include public user data without a
  password. Resident get/list stays limited to ownership unless an explicit
  public projection is requested. All official incident access is scoped.
- `alerts.list({nearby:true})` is resident-only, mutually exclusive with
  resident_id. Its DTO contains id, barangay_id, alert_type, status, created_at,
  barangay-level location_label, map_x/map_y rounded to tens and a generated
  summary. It excludes resident, household, exact address, victim count,
  free-text description, photo, logs and assignments. Filtering/search happens
  after sanitization. `alerts.get` never bypasses ownership for a public pin.
- `verification.list` returns the latest submission per scoped resident;
  historical submissions remain stored. Deadline is seven days after submit.
  The mock accepts a decision at the exact deadline and expires it only after
  that boundary. Page refresh and API commit both enforce the current state.
- A Store transaction rereads, changes and persists synchronously, then emits
  entity notifications. Failed updates do not persist partial records or send
  notifications. No-op updates do not emit. Web Locks serialize writers across
  tabs on localhost/HTTPS; the fallback queue serializes only within one tab.
- Metadata includes version, revision, updated_at and demo_started_at. The demo
  clock progresses from Config.demo_time using the shared persisted epoch.
  Reset restores fictional seed records and advances revision; it is not a
  migration mechanism. Unsupported/corrupt data produces an explicit recovery
  error. Browser storage is scoped by origin; localhost and Pages demos differ.

| Flow | Atomic write and recipients | UI destinations |
|---|---|---|
| F-X1 | Resident alert + notifications to barangay officials | Official dashboard/list/map/bell; link to official alert ID. |
| F-X2 | Each valid alert transition + resident notification, plus assigned staff handoffs | Resident alert/timeline/dashboard/notifications; rescue notification includes facility. |
| F-X3 | Announcement + resident notifications in the barangay | Resident announcements, dashboard and notifications. |
| F-X4 | Registration/submission + official notifications; review/expiry + resident notification | Verification queue/detail and resident verification/SOS access. |
| F-X5 | Feedback + official notifications; assignment/resolution + resident notification | Official Feedback and resident My feedback/notifications. |

## Final dependency status

P2's shared UI and resident screens and all P1 official routes are merged.
The actual map is assets/img/maps/sampaguita.png; Dalisay/Pag-asa have explicit
unavailable-artwork states. Photos/documents persist file-name metadata only.
No individual victim records, routing, messaging or admin screens were added.

The P1 adapter and its tests are complete. P2's nearby callers still need the
explicit public option above (Issue #5); Earthquake icon mapping and resident
touch areas remain tracked in Issue #2. These UI dependencies do not change
the frozen record schema. See CONTRACT.md for the final screen/QA evidence.
