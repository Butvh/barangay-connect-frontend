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

## Current dependency status

The initial scaffold had only README/CONTRACT/DECISIONS. P2's resident-ui branch
now contains shared UI and screens, awaiting its own pull request. The actual
Sampaguita map is assets/img/maps/sampaguita.png. Dalisay and Pag-asa artwork is
not supplied, so their map_image values are null. The core can be tested without
UI. Contract Issue #2 tracks the initial screen integration differences.
