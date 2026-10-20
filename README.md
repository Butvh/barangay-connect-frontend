# Barangay Connect frontend

Fictional barangay disaster-response demo using HTML5, plain CSS and vanilla JavaScript ES modules. Offline assets, no runtime packages, CDN or build step.

## Run on XAMPP

Clone into `C:\xampp\htdocs\barangay-connect`, start Apache, and open [Resident sign in](http://localhost/barangay-connect/resident-login.html). Use HTTP, not file://. All pages are flat and application paths are relative, including on GitHub Pages.

[Public repository](https://github.com/Butvh/barangay-connect-frontend). Miranda11251 was invited with write access. Pages uses GitHub Actions, owned by P1. During review the XAMPP checkout may be detached at the P2 PR preview commit; the source branch is `p2/resident-ui`.

## Demo accounts

All passwords are **demo1234**. All identities and addresses are fictional.

| Name | Email | Role / seed state |
|---|---|---|
| Maria Santos | maria.santos@example.com | Approved Resident, 14 Riverside Street |
| Jose Dela Cruz | jose.dela.cruz@example.com | Pending Resident, 8 Mabini Street |
| Ana Reyes | ana.reyes@example.com | Secretary |
| Carlo Mendoza | carlo.mendoza@example.com | Responder |
| Ramon Bautista | ramon.bautista@example.com | Rescuer |

Sessions use sessionStorage per tab; domain data uses shared localStorage and storage events. The demo clock starts in October 2026 and advances across tabs. Browser storage and demo passwords are not production security.

Maria starts with A-1042 Pending. Follow or resolve it before sending another SOS through the resident UI. Jose's SOS remains locked until approval.

## Resident pages

| Page | Behavior |
|---|---|
| resident-login.html | Sign-in, focus, loading/errors, demo role shortcuts |
| register.html | Barangay, account details, validated mock document selections |
| resident-verification.html | Countdown, Approved, Rejected/resubmit, Expired |
| resident-dashboard.html | Verified/unverified, active/resolved SOS, history/contacts |
| resident-report.html | Confirm → sent → optional details, pin, photo, victim count |
| resident-alert.html?id=1042 | Live five-step timeline, assignments/destination, safety |
| resident-map.html | Layers, markers/facilities, legend, pan/zoom, mobile sheets |
| resident-announcements.html | List and ?id=1 detail, evacuation access |
| resident-feedback-new.html | Chooser, ?type=complaint, suggestion or general |
| resident-feedback.html | My feedback, synchronized statuses; ratings show Submitted |
| resident-notifications.html | Filters, details/deep links, read/dismiss/clear-read |
| resident-my-feedback.html | Compatibility redirect to My feedback |

The Profile link points to P1's resident-profile.html. Initials come from the current user's name. The resident shell uses desktop tabs, condensed tablet navigation and a mobile bottom bar.

## Shared UI and map

[components.html](components.html) demonstrates the shared components. [CONTRACT.md](docs/CONTRACT.md) defines UI, Icons, Fmt, BCMap and shell exports. Local Inter and Lucide assets include their licenses.

`Icons.svg(name)` includes `menu`, `layout-dashboard`, and `clipboard-check` for the official shell. `Icons.disaster(type)` returns the canonical sprite name for Fire, Flood, Typhoon/Storm, Landslide, Earthquake, or Other; unknown values use `triangle-alert`. Render it with `Icons.svg(Icons.disaster(type))`. The resident SOS selector uses this same mapping. The shared `circle-check` inherits the surrounding text color, and the resident header brand has a 44px minimum clickable area without enlarging its logo.

BCMap uses the Figma base at assets/img/maps/sampaguita.png. Markers use percentage coordinates and real buttons. Drag, focused wheel, +/− and arrow keys control the map. In the SOS picker, position the crosshair with zoom/pan and press Enter or Space to set the point. Marker touch targets remain 44 pixels.

Only Sampaguita has artwork; other barangays show a coverage empty state. This is approximate demo geography, not routing, tiles or real geolocation.

## Two-tab demonstration

Use P1's official screens when available. [tests.html](tests.html) provides diagnostic controls using the same real Auth/Api/store; these were used for the P2 screen-level cross-tab checks.

1. Sign in as Maria on the resident page. In another tests.html tab, choose **Sign in Secretary**.
2. Open Maria's A-1042 status. Click **Acknowledge latest** in the official diagnostic tab.
3. Choose **Sign in Responder**, then **Log response latest**. Maria updates to Responding live.
4. Choose **Sign in Rescuer**, then **Log rescue latest**. Maria sees Rescue in progress and Sampaguita Elementary School as the destination.
5. Choose **Sign in Secretary**, then **Resolve latest**. Maria sees Resolved. Return to her dashboard and send a new SOS; it appears live in the official tab.
6. Add optional details. **Not sure** saves victim_count as null. Test Pin on map using pointer or keyboard.
7. Keep resident Announcements open while publishing a test announcement in the official tab.
8. Register a new fictional resident in another tab with image/PDF file selections. Approve the latest verification as Secretary; Pending changes to Approved live.
9. Submit a resident complaint, then assign/resolve it as Secretary. My feedback and notifications update live.

**Reset fictional demo data** in the diagnostic harness restores seeds on that origin after testing. It removes demo changes and signs out that diagnostic tab; sign in again in other tabs.

## Validation

Run `node scripts/check.mjs` and `node scripts/run-tests.mjs`. On installed Node 24.15 the current P1 wrapper uses a removed experimental flag; use `node tests/node-runner.js` directly until P1 updates it. The underlying suite currently reports **101 passed, 0 failed**.

P2 verified the real shared core, after removing the bootstrap adapter:
- F-X1–F-X5 through resident screens and the official diagnostic harness.
- All five alert states, staff assignments and destination.
- Registration, invalid document type, countdown and live approval.
- Three feedback forms, rating, HTML escaping and live complaint assignment/resolution.
- Login errors, unverified SOS lock, notification links/clear-read and map layer empty state.
- Keyboard pin selection and marker selection after dragging.
- Fresh review fixes for map selection, cached-page lifecycle and keyboard access.

| Initial view / state | 1920 | 768 | 390 |
|---|---|---|---|
| Sign-in / Registration barangay | Pass | Pass | Pass |
| Dashboard / Report active guard | Pass | Pass | Pass |
| Alert Pending / Map | Pass | Pass | Pass |
| Announcements list / detail | Pass | Pass | Pass |
| Feedback chooser | Pass | Pass | Pass |
| Complaint / Suggestion / General form | Pass | Pass | Pass |
| My feedback / Verification | Pass | Pass | Pass |
| Notifications / Components | Pass | Pass | Pass |

This is 48 real-core initial-view checks with no horizontal overflow or missing local images. Separate interaction checks cover later registration and SOS steps; the matrix does not claim every possible data/state combination.

## Folder structure and ownership

```text
*.html                     Flat pages, suitable for later Blade views
assets/css/                Tokens, shared components and role layouts
assets/js/core/            Data contracts, helpers, map and shells
assets/js/pages/           Page modules
assets/js/data/seed.js      Fictional seed data (P1)
assets/img/, assets/fonts/  Offline artwork, sprite and licensed fonts
tests/, scripts/, .github/  Shared checks and deployment (P1)
docs/                      Contract, model and decisions
```

P2 owns resident pages except Profile, shared UI/map helpers and visual assets. P1 owns data/auth/API, official screens, Profile, checks and workflows. P2 did not edit P1 implementation files.

## Known limitations

- P1 official/Profile screens and their full visual cross-test are separate from this P2 PR.
- Contract issue #5 tracks sanitized nearby community incidents; until P1 provides that read, the resident map receives only own alerts.
- File selection saves metadata only. No document/photo bytes are uploaded or retained.
- Notification dismissal is tab-local presentation state; clear-read uses the shared API.
- Dalisay/Pag-asa artwork is deferred.
- No final v1 release tag is claimed while P1 screen integration remains pending.

For Laravel/MySQL, retain page/UI modules and replace the shared API/store transport with authenticated server endpoints, real uploads and persistence.

