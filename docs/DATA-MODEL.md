# Browser demo data and authorization

The shared browser adapter implements the interfaces in CONTRACT.md.
All identities are fictional; `demo1234` is a demo credential only.

The versioned store has `version`, `revision`, `updated_at`, and arrays named
`barangays`, `users`, `households`, `verify_residency`, `facilities`,
`emergency_alerts`, `alert_responses`, `rescues`, `announcements`,
`community_feedback`, `notifications`. Records use integer IDs, snake_case
fields and ISO dates with the `+08:00` offset. Data changes are committed as one
transaction before subscriptions fire. Read results are deep copies.

`personnel_records` and `activity_logs` are optional, backward-compatible
collections. Missing collections are read as empty and created only when a
corresponding new change is saved. Existing version-1 data needs no reset or
replacement seed. Optional `users.personnel_status` is described below.
Appointment effective days use `YYYY-MM-DD`; event timestamps remain ISO dates.

## Seed identities

| User ID | Identity | Role / household |
|---|---|---|
| 1 | Ana Reyes | Secretary |
| 2 | Carlo Mendoza | Responder |
| 3 | Ramon Bautista | Rescuer |
| 4 | Maria Santos | Approved Resident, household 1, 14 Riverside Street |
| 5 | Jose Dela Cruz | Pending Resident, household 2, 8 Mabini Street |
| 6 | Luis Garcia | Existing unassigned Tanod; effective role access follows Captain appointment |
| 7 | Roberto Aquino | Captain; signs in at login.html and opens the Captain workspace |

Barangays 1/2/3 are Sampaguita/Dalisay/Pag-asa. Facility 1 is Sampaguita
Elementary School (EvacuationCenter, capacity 250); facility 2 is Dalisay
District Hospital (Hospital, contact (02) 8000-0000). Hospitals are selectable
across barangays; evacuation centers are scoped to the user's barangay.
Alert IDs 1042/1038/1031 retain the exact shared seed cases and October dates.
Reporterless seed cases have nullable resident/household fields.

## State and access rules

The alert machine permits Captain/Secretary acknowledgement, assigned Responder
response, assigned Rescuer rescue with a destination, and Captain/Secretary
resolution, in that order. Each write rechecks the current stored role and state
inside the transaction. Acknowledge requires an active same-barangay Responder;
logResponse requires an active same-barangay Rescuer for the next handoff. The
demo chooses the first eligible active operator. Absence of one aborts the
whole transaction before changing the incident, logs, audit or notifications.
Resident reads are limited to their own records; official reads/writes are
barangay scoped. Unapproved residents cannot create SOS alerts.

Captain and Secretary share verification review, announcement management,
feedback assignment/resolution, incident oversight, map and facility pages.
Personnel and Reports APIs/pages are Captain-only. Assigned operational actions
remain Responder/Rescuer-only. Only a resident can create feedback. General
Feedback has a rating/comment and no status or assignment/resolution action.
Notifications are private to their recipient. No public registration or profile
endpoint permits role escalation.

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
| users | full_name, email, contact_number, password, barangay_id, household_id, is_resident, is_secretary, is_tanod, is_captain, is_responder, is_rescuer, created_at, personnel_status? | Email is case-insensitively unique. household_id is nullable for staff. Captain precedence applies to active roles. Inactive/Unassigned personnel have no effective staff role; an independent resident flag may retain resident access. Absent legacy personnel_status preserves existing role behavior. Public registration/profile cannot change role flags or personnel_status. Demo password is excluded from public projections. |
| households | barangay_id, address, map_x, map_y | Coordinates are 0–100 percentages of the illustrated map, not GPS. Linked by users.household_id and alerts.household_id. |
| verify_residency | user_id, document_type, file_name, review_status, submitted_at, deadline_at, reviewed_by, reviewed_at, rejection_reason | Many historical submissions per resident; list/get-user selects the latest. reviewed_by/at are nullable. Pending resubmission updates the pending record; resubmission after rejection/expiry creates a new record. Approved residents cannot resubmit. |
| facilities | type, name, address, capacity, contact, barangay_id, map_x, map_y | type is Hospital or EvacuationCenter (display: Evacuation Center). Evacuation centers belong to a barangay; hospitals have null scope and are shared. capacity is nullable; never interpret unknown as zero. |
| emergency_alerts | barangay_id, resident_id, household_id, acknowledged_by, assigned_responder_id, assigned_rescuer_id, alert_type, description, location_label, map_x, map_y, victim_count, photo_name, status, created_at, acknowledged_at, resolved_at | resident_id/household_id may be null for the legacy seed cases. Assignments and lifecycle timestamps start null. Reporting barangay is derived from the resident, not accepted as a user override. victim_count null displays Not confirmed on official views. |
| alert_responses | alert_id, responder_id, response_type, response_status, notes, responded_at | Child of an alert and the assigned Responder. A response advances Acknowledged to Responding even when the response log's status is Completed. |
| rescues | alert_id, rescuer_id, facility_id, rescue_status, notes, rescued_at | Child of an alert, assigned Rescuer and chosen facility. A rescue log advances Responding to Rescue in progress; its Completed status does not resolve the alert. |
| announcements | barangay_id, posted_by, title, content, created_at, published_at, status, expires_at, updated_at, revision, archived_at/by, retracted_at/by, retraction_reason, history[] | Captain/Secretary-managed within the barangay. Active/Archived/Retracted; optional expiry automatically archives. Edits retain original author/publication and append content snapshots. Retraction requires a reason of 1–500 trimmed characters. No delete, restore, scheduling or category API. Legacy rows remain valid and publish at created_at without expiry; no schema reset. |
| community_feedback | resident_id, barangay_id, type, created_at, category, description, location, status, assigned_tanod_id, rating, comment | Complaint/Suggestion use status; General has status null, rating/comment and no workflow actions. No title, assigned_at or resolved_at is persisted. Current totals cannot imply assignment/resolution happened today. |
| notifications | user_id, kind, text, link, is_read, created_at | Recipient-private. link is a relative allowlisted destination, not an external URL. kinds: alert_new, alert_status, verification, announcement, feedback_update. |
| personnel_records (optional) | user_id, barangay_id, full_name, email, contact_number, address, emergency_contact, role, source, status, appointed_at, requirements[], notes, history[], revision, created_at, added_externally_at, legacy | id/user_id is the existing users.id. One current assigned role per person; limits Secretary 3, Responder 6, Rescuer 6 count Active and Inactive assigned positions. source is immutable external/tanod. Requirements retain only name/type/size. Removal sets role null/status Unassigned and preserves the user/history. |
| activity_logs (optional) | barangay_id, actor_id, actor_name, actor_role, action, entity, record_id, at, recorded_at, summary, href | Prospective audit evidence appended within committed domain transactions. entity is alert/verification/announcement/feedback/personnel. System expiry has actor_id/role null and actor_name System. at is effective event time; recorded_at is processor time. No fabricated backfill of legacy events. |

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
| Personnel role/source/status | role secretary/responder/rescuer or null; source external/tanod; status Active/Inactive/Unassigned. |

Acknowledgement selects the first active barangay Responder in the demo. A
logged response selects the first active barangay Rescuer. These handoffs fail
atomically if no eligible operator exists. Captain/Secretary resolve only after
Rescue in progress. Operational actions require the stored assigned ID.
An unassigned Tanod has no workspace; appointment grants the selected role while
retaining is_tanod. Feedback assignment alone still grants no application role.

## Read projections, tenancy and live changes

- API reads return copies. Joined records include public user data without a
  password. Resident get/list stays limited to ownership unless an explicit
  public projection is requested. All official incident access is scoped.
- The verification field in users.get is available only to the resident owner
  and authorized same-barangay Secretary/Captain. Operational-role reads return null;
  the UI must not interpret an unavailable projection as Pending verification.
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

## Personnel, reports and audit evidence

`Api.personnel.list()` returns `{records, tanods, capacities, activity}`;
`get(id)` returns the corresponding safe personnel projection. Legacy assigned
staff and existing Tanods are projected from users without writing new records
or inventing personal data. Unknown appointment dates remain null. Legacy
non-Tanod staff have `legacy:true` and display Existing personnel; an external
category does not prove an original recruitment source or recent addition.

Add External creates a fresh user and assignment directly, with no applicant
process. It requires name, role, unique normalized email, contact number,
address, appointment day and emergency contact. Optional notes have a combined
500-character limit. Requirements are up to 10 PDF/JPG/PNG metadata entries,
each 1 byte–5 MB with matching extension/MIME; no bytes are retained.

Appoint accepts only an existing unassigned Tanod. Reassign requires an assigned
person and a different role. Remove preserves all user and history records,
returns a Tanod to its existing pool, and leaves external personnel Unassigned.
No operation adds/deletes Tanod pool members or grants two effective roles.
Role flags and personnel_status are synchronized in the same transaction.
Inactive assigned positions count toward capacity but grant no staff access.

Existing-record forms pass `expected_revision`; stale supplied revisions fail
with CONFLICT. Capacity, current assignment and unresolved old-role incident
assignments are rechecked inside the transaction. A busy Responder/Rescuer cannot
be reassigned or removed until the referenced incidents are Resolved; incident
assignees and logs are never erased. Dates must be valid today/past Manila days,
and changes cannot predate the current appointment or last Tanod removal.
History entries retain action, by/by_name, recorded at, effective_date,
from_role/to_role, status and notes. Recorded actor names survive account renames.

`Api.reports.snapshot()` is a Captain-only joined read of scoped alerts, all
historical verifications, feedback, managed announcements, public users,
personnel projections and activity_logs, plus public barangay/shared-facility
lookups and the reference clock. It adds no stored metric counters. The
Captain dashboard and report views derive counts from this available evidence.

Reporting months use Asia/Manila. Average response time runs from incident
creation to its earliest valid recorded response; missing, invalid, future or
negative intervals are excluded and sample coverage is exposed. Assisted counts
sum known victim counts once per completed-rescue incident; unknown counts are
shown separately and are not zero or proof of distinct individual people.
Completed verifications use actual Approved/Rejected review times. Resolved
feedback has a current total; complete monthly resolution totals remain unknown
when legacy resolution dates lack source/audit evidence. Role performance uses
role-specific reviews/publications, completed responses or completed rescues,
with historical attribution retained where recorded. Hours/ratings and other
unsupported measures are unavailable, never invented.

Audit is prospective. Source history and equivalent audit events are paired by
entity, normalized action, record and event instant, retaining authoritative
audit actors/roles once. Distinct edits and response/rescue logs remain distinct.
Automatic expiry uses its effective deadline in `at` and actual processing time
in `recorded_at`, so a late maintenance visit does not rewrite event timing.
Production requires server-enforced tenant/role policies, transaction locks,
revision checks, protected uploads, retention rules and append-only audit;
browser data and checks provide only the fictional demo implementation.

## Integration status

P2's shared UI and resident screens and all P1 official routes are merged.
The actual map is assets/img/maps/sampaguita.png; Dalisay/Pag-asa have explicit
unavailable-artwork states. Photos/documents persist file-name metadata only.
No individual victim records, routing or messaging were added. Captain now has
its own oversight dashboard, Personnel, Reports and shared administrative pages.

The P1 adapter and its tests are complete. With the user's specific ownership
exception, the resident Dashboard/Map nearby callers now use the explicit
public option above; private own-alert history and get(id) remain unchanged.
Earthquake now uses triangle-alert, and the reported resident touch areas are
at least 44 by 44 pixels. Those resident fixes addressed Issues #2 and #5
without changing their record schema. Captain adds the optional collections and
metadata documented above without resetting existing data. See CONTRACT.md for
the dated QA evidence and current validation commands.

## Facility management extension

See [FACILITIES-API.md](FACILITIES-API.md) for facility status, management ownership, optimistic revision/history metadata, optional map coordinates, rescue snapshots and future Laravel/MySQL validation/policies. Legacy missing status means Active; IDs, shared referral visibility and rescue links are retained. No schema reset or backend implementation is included.

