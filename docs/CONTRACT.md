CONTRACT (async unless marked sync; errors throw ApiError {code: AUTH|FORBIDDEN|INVALID_STATE|VALIDATION|NOT_FOUND, message, fields?}; all calls resolve after 150 to 350 ms)
Auth (sync): Auth.current(), Auth.login(email, password) (async), Auth.logout(), Auth.requireRole(roles[]) where roles are 'secretary'|'responder'|'rescuer'|'resident', Auth.roleOf(user) (staff role wins over resident), Auth.homeFor(user) returns the dashboard URL.
Api.barangays.list() · Api.facilities.list({type, barangay_id}) / get(id) · Api.users.register({...}) / get(id) / update(id, patch) · Api.verification.submit(user_id, {document_type, file_name}) / list({status}) / get(id) / review(id, {decision:'Approved'|'Rejected', reason}) / expireOverdue() · Api.alerts.list({status, alert_type, q, resident_id}) / get(id) (joined: resident, household, assigned_responder, assigned_rescuer, responses[], rescues[] with facility, timeline[{status, at, current}]) / create({alert_type, description, location_label, map_x, map_y, victim_count, photo_name}) / addDetails(id, patch) / acknowledge(id) / logResponse(id, {response_type, response_status, notes}) / logRescue(id, {facility_id, rescue_status, notes}) / resolve(id) · Api.announcements.list() / get(id) / create({title, content}) · Api.feedback.list({type, status, resident_id}) / get(id) / create(type, payload) / assignTanod(id, tanod_id) / resolve(id) · Api.notifications.list() / markRead(id) / markAllRead() / clearRead() · Api.dashboard.officialStats() · Api.subscribe(entity, handler) returns an unsubscribe function (entity is 'alerts'|'verification'|'announcements'|'feedback'|'notifications'|'users'; fires on same-tab and cross-tab changes).
Server-side rules inside Api (via alertMachine and permissions): every write checks the signed-in user's role and the current status, and creates the notifications for F-X1 to F-X5.
UI (Person 2): UI.escape(s), UI.openDialog(el), UI.closeDialog(el), UI.toast(msg, type), UI.tabs(root), UI.menu(trigger, panel), UI.skeleton(n), UI.empty({icon, title, text, action}), UI.badge(status) returns HTML (icon plus label), UI.confirm({title, text, confirmLabel, danger}) returns a Promise<boolean>. Icons.svg(name, {size}) returns an SVG string. Fmt.dateTime(iso) "Oct 4, 2026 · 2:10 PM", Fmt.date(iso) "Oct 4, 2026", Fmt.short(iso) "Oct 4 · 2:10 PM", Fmt.alertId(n), Fmt.countdown(deadline_iso).
Shells: Shell.official({role, active}) and Shell.resident({active}) render the navigation and return the <main> element to fill.
Map (Person 2): BCMap.mount(container, {barangay_id, markers:[{id, kind:'household'|'own_household'|'hall'|'evacuation'|'hospital'|'alert'|'complaint', status, x, y, label, selected}], controls: true, interactive: true, onSelect(marker)}) returns {setMarkers(list), select(id), zoomIn(), zoomOut(), destroy()}. x and y are percentages 0 to 100. The map is a vanilla-JS pan and zoom (pointer drag, wheel, + and − buttons, arrow keys) over the illustrated map image exported from Figma. Markers are real <button> elements counter-scaled to a fixed size. No tiles, no routing.

## Sync A0 implementation notes — P1, October 20, 2026

The signatures above are unchanged. Named and default exports are available:
`{ Auth }`, `{ Api, ApiError }`, `{ Store }`, `{ Config, DEMO_MODE }`.
Pure domain exports are `{ AlertMachine, transition, canTransition }` and
`{ Permissions, roleOf }`. `createStore`, `createAuth`, and `createApi` are
dependency-injected factories for the shared browser/Node tests.

- `Auth.current()` returns a user object or `null`, never a password.
  `Auth.login()` is asynchronous; the other Auth methods are synchronous.
  Public login/register/diagnostic entry points may use `Auth.requireRole([])`.
- The data store key is `barangay-connect:data:v1`. **Auth is per tab** in
  `sessionStorage` under `barangay-connect:session:v1`; logging in as an official
  in a second tab does not replace the resident's session.
- `Api.subscribe(entity, handler)` fires after committed same-tab writes and
  cross-tab `storage` events; its callback receives `{ entity, revision }`.
  Reread the API in the handler and unsubscribe when destroying a view.
- Web Locks serialize writers across tabs on localhost/HTTPS. The fallback
  serializes writers within a tab. The app remains a fictional browser demo,
  not a production authentication/authorization boundary.
- Methods return arrays or complete objects; pagination is a client-side view
  operation. An empty list is `[]`. Public user objects exclude `password`.
- Registration payload: `{ full_name, email, password, contact_…559 tokens truncated…y application pages.

## Integration clarification — contract Issue #2

- `verification.list({status})` returns only the resident's own latest record
  when signed in as a resident. The Secretary receives the latest scoped queue.
  Responder/Rescuer access remains forbidden. The method signature is unchanged.
- Store writes that change no data do not increment revision or emit events.
  This makes `expireOverdue()` safe inside a subscribed verification refresh.
- Feedback notifications use P2's `resident-feedback.html?id=…` route. Their
  canonical content fields remain `text`, `link` and `is_read`; renderers should
  not depend on the isolated P2 stub's `title`, `message` or `entity_id` fields.
- Map metadata uses P2's `assets/img/maps/sampaguita.png`. The other two
  barangays have `map_image: null` until their artwork exists.

## P1 navigation and login implementation

Canonical visual ownership remains P2's tokens.css, base.css, components.css,
UI, Icons, Fmt and BCMap, with the provided Figma frames as the visual reference.
P1's official.css contains official layout and the P1-owned Profile layout;
it does not introduce a second color/font token system. The shared auth layout
is reused from resident.css. No separate DESIGN/UX document is created outside
P1's allowed files; this contract and the supplied implementation brief are the
maintained behavior/design-context equivalents for this hand-off.

- Login has app-owned validation, field errors, password visibility, busy state,
  and the four demo accounts. It routes through Auth.homeFor. Index redirects
  to the current role's home or the official login. Sign out remains per tab.
- The official shell has the 280 px sidebar, 72 px rail, mobile modal drawer,
  aligned header controls, and live recipient-scoped notifications. It uses
  UI.openDialog/closeDialog/confirm for focus, Escape and confirmation behavior.
- Incremental release: only implemented official destinations are enabled in
  official-shared.js. Remaining destinations have disabled controls with a
  reason until their route is built. They must be enabled with that route.
- Role dashboards derive all counts/statuses/names from Api. The Rescuer map
  contains facility/incident markers only, as the brief forbids routing. No
  priority labels, age breakdown, distances or extra response states are added
  from later Figma illustration details that have no agreed data model.
- Profile consumes Shell.resident and users.get/update. Email/barangay are
  read-only. Save preserves validation context; unsaved navigation asks before
  discarding. Saved state, household map and resident sign out are implemented.
- Global feedback uses UI.toast; field problems stay inline. Document titles
  identify the page. Shell controls remain available when page data fails.

P2's UI foundation is merged in PR #6; PR #8 supplies the additional shell
icons, corrected circle-check, disaster helper and 44 px header-brand target.
P1 now consumes these shared assets directly. Icons.disaster(type) returns a
sprite name, rendered by Icons.svg. Issue #2 tracks the remaining Earthquake
mapping correction from activity to triangle-alert required by the brief.

The test launcher supports Node 20–24: it omits the removed experimental
default-module flag on Node 24 and newer. Application pages never need Node.

## Public map read — contract Issue #5

`Api.alerts.list({ nearby: true, status?, alert_type?, q? })` is an explicit
resident-only read of public incidents within the resident's barangay. Do not
combine nearby with resident_id. Default list() and list({resident_id}) keep
their existing private own-alert behavior, and get(id) still checks ownership.

The public DTO contains only id, barangay_id, alert_type, status, created_at,
location_label, map_x, map_y and description. The label is the barangay name;
coordinates are rounded to the nearest 10 percentage points on the illustrated
map. Description is generated from the disaster type and barangay, never the
resident's free text. Identity, household, exact address, victims, photos,
assignments and logs are excluded. Search runs only against the public DTO,
so a private name/address cannot be inferred from search results.

P2 should use this explicit option for nearby maps/previews, keep its existing
own-alert list for status/history, and subscribe to alerts for live changes.
The API and its privacy tests are P1-owned; resident view changes remain P2's.

## Official alerts implementation

The list uses Figma's current incident rows, adapted to cards below 1024 px,
with shared filters, search, newest/oldest sorting and centered pagination.
Tablet/mobile View opens Alert summary before the full detail page.
All actions use the frozen forward-only machine and assigned staff checks.
Log response/rescue forms preserve notes on errors and confirmed close, use
automatic timestamps, and select facilities through the shared dialog helper.
Resolved alerts remain read-only. Rescuer quick actions open Log rescue only
for an assigned Responding incident; repeated transitions are not invented.

Sync B verification (October 21, 2026): A-1042 completed all five statuses
through the actual official pages with a separate resident tab. The resident
timeline, staff assignments, destination and all four status notifications
updated live. A new resident SOS (A-1043) appeared in the official list without
reload. School/hospital choices, missing-destination validation, Cancel,
resolution confirmation and notification-to-summary links were checked.

Alerts, resolved Detail, Log response and Log rescue passed 20 distinct
view/width checks at 1920, 1440, 1366, 768 and 390 px, plus checks after the
final spacing corrections. No horizontal overflow or undersized tablet/mobile
controls were found. Timeline dates share one column and status/back controls
share a vertical center. The browser console remained clear. Both core tests
(104 passed) and the offline asset check pass.

The premium static audit reports four actionless-button heuristic findings
in login, alert actions, alert detail and dashboard templates. Those controls
use the required addEventListener wiring and were exercised in the browser;
inline event-handler attributes were not added to satisfy that heuristic.

## Map monitoring and facility directory

P1's Map monitoring consumes P2's BCMap and its existing local Sampaguita
illustration. Filter/status/type/facility controls and layer chips use the
canonical controls and tokens. Filters and selected records are reflected in
the URL. Refreshes update markers without remounting the map or resetting zoom.
The marker status adapter and disaster icons are scoped to the official map;
P2's map implementation, tokens and resident styles are unchanged.

Desktop uses filters/map/selection columns; smaller screens use filter,
facility and legend dialogs, with a selected-alert sheet on mobile. A collapsed
Map records list provides a non-drag alternative and access to overlapping
pins. Buttons/markers have at least 44 px targets on tablet/mobile. Acknowledge
and Resolve use the same API permission checks and confirmation as Alert Detail;
Assign remains disabled because assignments are automatic in this prototype.

The frozen API has no whole-barangay household enumeration or complaint
coordinates. The household layer therefore uses households joined to the
available alerts and, for the Secretary, complaint residents returned through
Api.users.get. A complaint is pinned only when its location matches one of those
household addresses; unmatched complaints are counted in a visible note, and no
location is fabricated. Responder/Rescuer views never request complaint data and
disable that layer. The static barangay-hall landmark follows the Figma map.

Facility markers and the selector open official-facilities.html?id=..., whose
read-only directory supports All/Evacuation centers/Hospitals, Facility details,
and View on map. This destination was built with the map to complete that route.
Creation, editing, active/inactive status and menus were not added: the agreed
facility model only contains type, name, address, capacity/contact and location.
Native selects retain operating-system-owned popup behavior, as on Alerts.

Verification: 108 tests passed, including four map projection/privacy/location
tests. Both pages passed 1920/1440/1366/768/390 resize checks without horizontal
overflow or undersized tablet/mobile targets. Browser checks covered filtering,
no results, zoom preservation, keyboard pan, marker alternatives, mobile sheets,
Escape/focus restoration, facility navigation and all three official roles.
The actual two-tab workflow passed with Acknowledge and Resolve from the map;
a new resident SOS appeared as a marker without reloading. Both consoles were
clear. Fictional demo data was restored after testing. Forced API-failure UI
was reviewed in code; a forced service outage was not exercised in the browser.

The premium audit adds two button-action heuristic findings on the facility
template. Those filter/View buttons are wired through addEventListener and were
exercised above. The audit's four existing findings are unchanged; no inline
event-handler attributes were introduced to satisfy its heuristic.

## Residency verification queue and review

The Secretary-only queue and detail routes use the current O-07/O-08 layout
(Figma 261:21268 and 261:21407), the existing shell, UI.badge, UI.confirm, shared
inputs/buttons and the centered pagination helper. No P2 file or token changes.
The queue shows only the latest verification for each resident, from the frozen
API. Search/status/sort/page state is kept in the URL and survives a detail/back
round trip. Counts are derived from records; date boundaries use Asia/Manila.
Tablet/mobile replace the table with labelled cards without losing fields.

The supported decisions remain Approved and Rejected. Rejection needs a reason
and the app-owned confirmation; Approve returns directly to the queue. Completed
and Expired records cannot be reviewed again. The newer Figma request-resubmission
action/checklist and extra sample resident are not additional data/workflow scope.
Document preview stays an explicitly labelled gray placeholder with actual demo
file names, since document contents are not persisted in this front-end model.

Both routes run expireOverdue before reading and refresh each minute. API no-op
expiry does not emit changes, so subscriptions do not create a refresh loop.
Detail reviewability agrees with the API's exact deadline boundary. The API
rechecks permission and status at commit time; competing decisions commit only
once. A failed save keeps the typed reason and reloads current status. Stale or
unavailable records disable actions. Unsaved reasons are protected for in-app
navigation/sign-out and browser unload. Save returns to the preserved queue
filters with an accessible saved message. Native selects keep the same
operating-system-owned popup behavior as the other official pages.

Validation: 114 tests passed, including queue filtering/page clamping, Manila
date summaries, deadline boundaries, review permissions and competing decisions.
Both pages passed five responsive widths (10 view/width combinations), without
horizontal overflow or undersized enabled tablet/mobile targets. Browser checks
covered search/clear, empty results, status/sort, filter restoration, missing ID,
read-only review states, reason validation, Cancel, draft protection and role
redirects. A real two-tab test passed Jose's Reject → document resubmission →
Approve workflow and SOS unlock. A separate new fictional registration appeared
in the open queue without a reload. Consoles were clear and demo data restored.
API expiry and race rejection are tested in isolation; a forced service outage
and seven-day time advance were not exercised through the browser UI.

The premium audit has one additional button-action heuristic finding in the
queue template (seven total, six pre-existing). The search-clear/dismiss controls
use addEventListener and were exercised in the browser. No inline event-handler
attributes were added to work around that heuristic.

## Official announcements

The Secretary-only list and New announcement dialog follow O-09 (Figma
261:21525 and 261:21623), with canonical shell, buttons, fields, typography,
colors and centered pagination. Rows stack on mobile. The composer becomes a
bottom sheet, and published content uses one shared detail dialog from both
the announcements list and the dashboard. No P2 files or shared tokens changed.

The frozen workflow is list, read and publish only. The API supplies barangay
scope, author and automatic timestamp, validates the 200-character title and
5,000-character content limits, and notifies residents in the same barangay.
No edit/delete, scheduling, category or extra status was introduced. List
page/deep-link state is reflected in the URL; an unavailable announcement has
a persistent, dismissible explanation. Background updates refresh the list
without replacing a draft. Loading, empty, retry and stale-data states are
implemented. Dynamic content is escaped and line breaks are retained.

Publish validates labelled fields, focuses the first error, prevents repeat
submission while saving and preserves input after an API error. Cancel, Close,
Escape and backdrop dismissal share the unsaved-draft confirmation; browser
unload is also protected. Closing restores focus, and publishing focuses the
new announcement heading and announces success. API permission is checked
again at write time, in addition to the page's Secretary guard.

Validation: 116 tests passed in Node and the browser, including blank/length
validation, unchanged data on rejection, role restrictions and public author
projection. The offline asset check passed. List, composer and detail passed
15 view/width combinations at 1920/1440/1366/768/390 px without horizontal
overflow; enabled tablet/mobile controls were at least 44 px. Browser checks
covered blank errors, Cancel/Escape keep/discard, focus restoration, valid and
missing deep links, dashboard detail reuse, Publish and role redirects.

F-X3 passed through actual pages: one Secretary publication appeared in an
already-open resident announcements list without reload; the resident
notification's View update opened the matching content, and the resident
dashboard displayed it after navigation. Consoles were clear, sample data
restored, sessions signed out and temporary tabs closed. The dashboard and
notification were opened after publication, so only the resident list was
verified live without reload in this block. Forced service outage, no-record
and multiple-page list states were not forced in the browser; their paths
were reviewed in code.

The premium static audit reports eight actionless-button heuristic findings
(seven pre-existing). The new list Read button is wired with addEventListener
and was exercised above. Inline event handlers were not introduced to satisfy
that heuristic; the static audit therefore still exits with those findings.

## Official feedback

The Secretary-only O-10 route follows Figma 261:23271, 261:23411, 261:23551
and 2534:50010. Canonical owners remain Shell.official, UI.tabs, UI.badge,
UI.confirm, the official dialog/pagination helpers and P2's field/button/icon
and typography tokens. Native Select/Listbox ownership is intentional: the
operating system owns the opened popup, as on the other official pages.
scripts/premium-ui.json records that decision for the static audit; this does
not change the rendered controls or waive keyboard/focus verification.

Complaints and Suggestions expose Pending/Assigned/Resolved, category,
location, Tanod assignment and Mark resolved. General Feedback exposes rating
and comment with no workflow status or action. Search/sort/status/page/selected
record are kept in the URL; a valid notification ID selects its type and row.
Tabs keep separate in-page filters. Native tables become labelled card lists
at tablet/mobile widths, and the detail panel stacks below the list when the
desktop two-column layout would compress values. Selection is a native button;
table rows are not nonsemantic click targets. Published dates use Fmt.

Complaint summaries show current Pending/Assigned/Resolved totals. The frozen
model has no assignment/resolution timestamps, so the later Figma's "today"
counts are not fabricated. The seeded Tanod Luis Garcia (user 6) is read via
Api.users.get for the assignment selector; there is no staff-list contract or
role-management feature. Assignment and resolution use the unchanged API,
which rechecks role/barangay/status at commit time. Busy actions prevent repeat
submission. Resolution requires confirmation; completed records are read-only.
Load/stale/action errors are persistent with retry or recovery. No P2 files,
shared tokens or frozen record fields were changed.

Validation: 120 tests pass in Node and browser, including filter/page
immutability, General Feedback isolation and competing assignment/resolution
commits. The offline checker passes. All three tabs and the assignment dialog
passed 20 view/width combinations at 1920/1440/1366/768/390 px. Visual review
identified compressed tablet cells; the final pass confirms no horizontal
overflow, overflowing badges or enabled controls below 44 px after using cards.
Search/clear/no-results, status/sort, URL reload restoration, keyboard tabs,
Cancel/focus, unavailable links and all three forbidden-role redirects passed.

Actual F-X5 passed in two tabs: a resident complaint appeared live in the
official list and bell; the notification selected that record. Assignment and
resolution of Maria's suggestion updated the open resident list without reload
and created both resident notifications. Resolved records have no actions.
Consoles were clear, fictional records restored and sessions signed out.
Forced API outage and a multiple-page browser dataset were not simulated.

The configured strict premium audit has 11 button-action heuristic findings
(eight pre-existing, three in the new feedback templates). These controls use
addEventListener and were exercised. No unresolved ownership findings remain;
the static audit exits with the documented action-detection findings.

