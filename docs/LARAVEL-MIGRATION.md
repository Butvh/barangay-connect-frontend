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

## Deployment checks

Retain the pure alert/permission tests as frontend tests and duplicate the
security/state assertions in backend feature tests. Exercise F-X1–F-X5 with two
sessions and test role/tenant isolation. GitHub Pages hosts the frontend demo
only; it cannot host Laravel. Deploy Laravel to PHP/MySQL hosting separately.
