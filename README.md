# Barangay Connect frontend

Fictional barangay disaster-response demo using HTML5, plain CSS and vanilla JavaScript ES modules. Assets work offline, with no runtime packages, CDN or build step.

## Run locally

Clone into `C:\xampp\htdocs\barangay-connect`, start Apache, and open [Resident sign in](http://localhost/barangay-connect/resident-login.html) or [Official sign in](http://localhost/barangay-connect/login.html). Use HTTP rather than `file://`. Flat pages and relative paths also support GitHub Pages.

[Public repository](https://github.com/Butvh/barangay-connect-frontend). The Checks and Pages workflow validates the frontend and deploys successful main-branch builds. GitHub Pages serves this browser demo; it does not provide a production backend.

## Demo accounts

All passwords are **demo1234**. Every identity and address is fictional.

| Name | Email | Role / seed state |
|---|---|---|
| Roberto Aquino | roberto.aquino@example.com | Captain; full Captain workspace |
| Ana Reyes | ana.reyes@example.com | Secretary |
| Carlo Mendoza | carlo.mendoza@example.com | Responder |
| Ramon Bautista | ramon.bautista@example.com | Rescuer |
| Maria Santos | maria.santos@example.com | Approved Resident, 14 Riverside Street |
| Jose Dela Cruz | jose.dela.cruz@example.com | Pending Resident, 8 Mabini Street |

Luis Garcia is the existing Tanod record. An unassigned Tanod has no application workspace; a Captain appointment grants the assigned effective role. Inactive or removed personnel lose that role's access. Captain takes precedence over other active role flags.

Sessions use sessionStorage per tab. Shared localStorage and storage events synchronize domain changes across tabs. The October 2026 demo clock advances from one persisted reference epoch. Browser storage, role flags and demo passwords are not production security.

## Official and Captain workspaces

| Page | Behavior |
|---|---|
| official-dashboard.html | Distinct Captain oversight dashboard, Secretary dashboard, or assigned operational dashboard according to the signed-in role |
| official-alerts.html / official-alert.html?id=1042 | Scoped incident list, details, assignments and forward-only SOS actions |
| official-map.html | Existing BCMap with authorized incidents and facilities |
| official-verifications.html / official-verification.html?id=… | Latest residency queue, review and deadline handling |
| official-announcements.html | Publication, editing, optional expiry, archive and retraction |
| official-feedback.html | Type-specific feedback, Tanod assignment and resolution |
| official-facilities.html | Shared hospital / scoped evacuation-center directory |
| captain-personnel.html | Captain-only staffing, capacities, Tanod appointments, details and retained role history |
| captain-reports.html | Captain-only reports, incident analytics, activity, operations and role-specific personnel performance |

Captain and Secretary share the same Alerts, Map Monitoring, Verifications, Announcements, Feedback and Facilities implementations with same-barangay administrative authority. Facilities supports role-scoped management, availability and map pinning; see [the facilities API contract](docs/FACILITIES-API.md). Assigned Responder/Rescuer permissions remain operational. A Captain can acknowledge and resolve incidents, but cannot log another person's response or rescue.

Acknowledgement requires an active same-barangay Responder; logging a response requires an active same-barangay Rescuer for the next handoff. If one is unavailable, the transaction fails before changing the incident, logs, audit or notifications. Existing incident history is preserved.

Personnel uses `Api.personnel.list/get/addExternal/appoint/reassign/remove`. Limits are **3 Secretaries, 6 Responders and 6 Rescuers**, including Inactive assigned positions. The Captain can add external personnel directly or appoint existing Tanods. This page cannot create or delete Tanod pool members. Removing an assignment preserves the user and history; a Tanod returns to the unassigned pool. Role changes are blocked while the person is assigned to an unresolved incident in the old operational role. Forms check capacity, dates, duplicate email and record revisions.

Requirements selections retain only file names, MIME types and sizes: PDF/JPG/PNG, up to 5 MB each and 10 files. No file contents are uploaded or stored. The picker is a real accessible file input; it does not advertise drag and drop.

The Captain dashboard and Reports use actual scoped records through `Api.reports.snapshot()`. Monthly boundaries use Asia/Manila. Missing timestamps, victim counts, ratings or hours remain unknown. Average response time uses recorded first response logs; known assisted counts exclude unknown victim counts. Activity combines source history with prospective audit records without counting the same event twice. Automatic expiry records its effective deadline separately from the processor's `recorded_at` time.

Existing browser data works without a reset: `personnel_records`, `activity_logs` and personnel metadata are optional additions. Legacy staff retain existing data; unknown appointment/source history is not fabricated.

## Resident pages

| Page | Behavior |
|---|---|
| resident-login.html / register.html | Sign-in and validated resident registration |
| resident-verification.html | Countdown, approval, rejection/resubmission and expiry |
| resident-dashboard.html | Residency gate, own active/resolved SOS, history and contacts |
| resident-report.html | SOS confirmation, optional details, map pin, photo metadata and victim count |
| resident-alert.html?id=1042 | Live five-step timeline, assignments, destination and safety information |
| resident-map.html | Sanitized nearby incidents, own household, facilities and map controls |
| resident-announcements.html | Active announcements and linked details |
| resident-feedback-new.html | Complaint, suggestion and general feedback forms |
| resident-feedback.html | Own feedback and synchronized status; ratings show Submitted |
| resident-notifications.html | Filters, authorized deep links, read/unread, dismissal and clear-read |
| resident-profile.html | Own permitted profile and household changes |
| resident-my-feedback.html | Compatibility redirect to My feedback |

Maria starts with A-1042 Pending. Follow or resolve it before creating another SOS through the resident UI. Jose's SOS remains locked until approval.

## Shared UI, map and demonstration

[components.html](components.html) demonstrates the shared controls. [CONTRACT.md](docs/CONTRACT.md) documents API, Auth, UI, Icons, Fmt, BCMap and shell interfaces. Local Inter and Lucide assets include their licenses. BCMap retains the existing Sampaguita artwork, percentage coordinates, accessible marker buttons, pan and zoom. Dalisay/Pag-asa show unavailable-artwork states. No GPS, routing or ETA is implied.

Use two tabs with separate demo accounts to exercise resident SOS intake, administrative acknowledgement, assigned response/rescue, resolution, verification, announcements and feedback. Changes appear through the same shared services used by [tests.html](tests.html). Captain personnel changes also refresh other authorized views and revoke obsolete role access.

**Reset fictional demo data** in the diagnostic harness is an explicit testing/recovery action on that origin. It removes demo changes and signs out the diagnostic tab. It is not required to install the Captain workspace or migrate existing data.

## Validation

Run:

```sh
node scripts/check.mjs
node scripts/run-tests.mjs
```

The launcher supports installed Node 20–24 and newer without the removed Node 24 experimental module flag. The suite covers authorization, tenant isolation, SOS transitions, notifications, personnel history/capacity/duplicates/dates/files, competing clients, stale revisions and source-backed report metrics. The static checker validates offline references and repository constraints. There is no production bundle or TypeScript compilation step.

## Structure and production boundary

```text
*.html                     Flat pages, suitable for later Blade views
assets/css/                Tokens, shared components and role layouts
assets/js/core/            Auth, API/store adapter, domains, map and shells
assets/js/pages/           Page modules and pure presentation models
assets/js/data/seed.js      Fictional seed data
assets/img/, assets/fonts/  Offline artwork, sprite and licensed fonts
tests/, scripts/, .github/  Checks, diagnostics and deployment
docs/                      Contracts, model, migration guidance and decisions
```

The current frontend has no PHP application, SQL database, protected document storage, real uploads or individual victim records. Audit history begins with newly recorded changes; legacy events are not reconstructed without evidence. Reports display unavailable metrics when their source data is missing.

For Laravel/MySQL, retain the page/UI contracts and replace the browser transport with authenticated server endpoints. Enforce same-barangay policies, role revocation, unique email, capacity locks, revision conflicts, active operational handoffs, immutable appointment/audit history and protected uploads on the server. Remove demo passwords, quick sign-in and reset from production. See [DATA-MODEL.md](docs/DATA-MODEL.md) and [LARAVEL-MIGRATION.md](docs/LARAVEL-MIGRATION.md).
