CONTRACT (async unless marked sync; errors throw ApiError {code: AUTH|FORBIDDEN|INVALID_STATE|VALIDATION|NOT_FOUND|CONFLICT, message, fields?}; all calls resolve after 150 to 350 ms)

Alerts alignment and private incident access (October 24, 2026): O-02
261:17340 / 4077:96487 and operational variants 4129:96809 / 4130:97486
share the approved row geometry, local icon exports and responsive layouts.
No priority or seed records are added. Secretary sees all same-barangay
incidents; effective Responder/Rescuer roles can list and get only records
whose assigned_responder_id/assigned_rescuer_id equals the signed-in ID,
within that barangay. Resident private reads remain own-only; nearby:true
retains its resident-only redacted DTO. Filters cannot broaden this scope.
The future Laravel list query AND show policy must enforce the same rule
before returning joined records; browser-side checks are demo-adapter
authorization, not a substitute for server authorization.

Operational Alerts omit reporter facts and show the current user's real
assignment. Responder assignment time is acknowledged_at; Rescuer time is
the earliest valid responded_at, matching the existing logResponse assignment
transaction and dashboard contract. Missing assignment times are not inferred
from created_at. Resolved records retain their actual assignees. Existing
status transitions and assignment rules are unchanged. Mobile previews
re-read the authorized record before opening, so stale cached assignments
cannot open a summary after access is revoked.

Alerts-only select enhancement retains each native select's original
options/value/change events. Its nonmodal top-layer list is field-width,
anchored below the trigger, scrollable, and closes on selection, outside
interaction, toggle, Escape/Tab or viewport movement. Arrow/Home/End and
type-ahead navigate options without committing until Enter/Space.
Search, status/type, sort and Clear filters compose with pagination and
live alert/user refreshes. Other pages and shared UI selects are unchanged.

Rescuer Dashboard reference alignment (October 22, 2026): frame 2538:58815,
visible content 4040:95589–4040:96040, is the approved desktop source. Its
metric, quick-action, assignment-detail, activity and facility instances use
the same component family as the Responder reference. Both roles therefore
compose one P1 operational renderer and the established official.css rules;
Rescuer-only variants retain four actions and longer labels. Secretary keeps
its existing renderer. tokens.css remains the canonical source for Inter,
color, spacing, radius, shadow and mobile type values. Existing local Lucide,
location/maximize artwork and BCMap are reused without changing their owners.

The Rescuer projection filters by assigned_rescuer_id and barangay_id, preserves
API order for the first non-Resolved assignment and recent alerts, and only
counts the current rescuer's rescue records. Assigned today uses the first valid
responded_at: logResponse assigns the rescuer in that same transaction. It
does not use acknowledgement time. Missing response time stays unrecorded.
Today is Asia/Manila.
The assignment breakdown counts Resolved or own Completed rescue records as
finished. Completed rescues counts actual Completed rescue records today; the
metric dialog shows precisely those same records. Activity uses real report,
assignment and rescue timestamps in descending order, excluding invalid dates.

There are no transport check-in, pickup, drop-off, priority, travel-stage,
distance/ETA, GPS or routing fields. Check-ins shows an em dash and an
unavailable explanation; priority stays unavailable/Unrated. Pickup and
drop-off actions are disabled and explained in visible help. Update rescue
status reuses the canonical Log rescue dialog and is enabled only for the
assigned rescuer while the alert is Responding. A saved record still advances
the alert to Rescue in progress; it does not add repeat logging or let a
rescuer resolve the alert. Only a recorded Completed rescue marks the final
progress step; the three travel steps remain unrecorded. No transport is
inferred from In progress. Facilities use capacity/contact, not invented
travel estimates or a Command center type. Facility rows select the actual
marker on Map Monitoring, as requested by the written brief; recent records
open their actual authorized details instead of static sample overlays.

Canonical UI ownership for this flow: shell/navigation and role guards are
shell-official/Auth; buttons/badges/dialogs are UI; rescue form, facility
chooser, validation, discard guard, busy state and feedback are logAlert;
map geometry and controls are BCMap; date formatting is Fmt. Select/Listbox
ownership: native, through logAlert's existing labeled select; browser-owned
popup appearance and keyboard behavior are accepted. No replacement control,
permission, schema, seed record, P2 file or Figma node is introduced.

Responder Dashboard reference redesign (October 21, 2026): Figma nodes
3720:88228 / 3720:88291 / 3720:88345 define desktop/tablet/mobile layout;
3716:88141 contains the metric, quick-action, activity, facility and alert
components and connected dialog states. The user explicitly chose to keep
the existing contract rather than add priorities, check-ins, travel tracking,
backup requests or routing. These capabilities are visibly unavailable; no
synthetic count, travel estimate, GPS position or successful backup request
is displayed or persisted. Only existing hospitals/evacuation centers appear.

The Responder-only projection scopes records to the current assigned user
and barangay. Current assignment preserves API order, excluding Resolved.
Assigned today uses acknowledged_at (the existing automatic assignment
instant), counted by Asia/Manila date. Its breakdown counts completed own
responses or Resolved assignments. Completed responses counts the current
responder's Completed records for that Manila date. Activity is derived from
real report/assignment/response timestamps and refreshes on alert events.
The Completed metric opens those same today's records; View all opens all
recorded activity. Update status reuses Log response with its existing guard;
unavailable actions explain the reason without a write or success toast.

The original Figma more-control goes directly to details, not a menu. The
implementation preserves that behavior with the existing ellipsis icon.
Existing pencil, clipboard-check and map icons provide the quick-action,
metric and expansion controls; the shared icon library remains P2-owned.
Its white map-pin is placed on a blue tile for contrast without editing the
shared sprite. Dialog closes restore focus to the current dashboard action,
including after a background refresh has replaced the original trigger.
Facility links select their actual marker via official-map.html?facility=id.
The map reuses BCMap, controls, markers, privacy and approximate coordinates.
No Secretary/Rescuer UI, tokens, permissions, seed or P2-owned file is changed.

Auth (sync): Auth.current(), Auth.login(email, password) (async), Auth.logout(), Auth.requireRole(roles[]) where roles are 'secretary'|'responder'|'rescuer'|'resident', Auth.roleOf(user) (staff role wins over resident), Auth.homeFor(user) returns the dashboard URL.
Api.barangays.list() · Api.facilities.list({type, barangay_id}) / get(id) · Api.users.register({...}) / get(id) / update(id, patch) · Api.verification.submit(user_id, {document_type, file_name}) / list({status}) / get(id) / review(id, {decision:'Approved'|'Rejected', reason}) / expireOverdue() · Api.alerts.list({status, alert_type, q, resident_id}) / get(id) (joined: resident, household, assigned_responder, assigned_rescuer, responses[], rescues[] with facility, timeline[{status, at, current}]) / create({alert_type, description, location_label, map_x, map_y, victim_count, photo_name}) / addDetails(id, patch) / acknowledge(id) / logResponse(id, {response_type, response_status, notes}) / logRescue(id, {facility_id, rescue_status, notes}) / resolve(id) · Api.announcements.list() / get(id) / create({title, content, expires_at?}) / update(id, patch) / archive(id) / retract(id, {reason}) / expireOverdue() · Api.feedback.list({type, status, resident_id}) / get(id) / create(type, payload) / assignTanod(id, tanod_id) / resolve(id) · Api.notifications.list() / get(id) / markRead(id) / markUnread(id) / dismiss(id) / markAllRead() / clearRead({recipient_id?, expected_role?}?) · Api.dashboard.officialStats() · Api.subscribe(entity, handler) returns an unsubscribe function (entity is 'alerts'|'verification'|'announcements'|'feedback'|'notifications'|'users'; fires on same-tab and cross-tab changes).
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

The original list/read/publish workflow is extended by the October 21 Secretary
announcement alignment: see the lifecycle contract below. The API supplies barangay
scope, author and automatic timestamp, validates the 200-character title and
5,000-character content limits, and notifies residents in the same barangay. List
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

Each Feedback tab shows the same three-card summary layout, using all scoped
records rather than the current search/filter/page. Complaint summaries show
current Pending/Assigned/Resolved totals. Suggestions show Pending submissions
in the current Monday-start Manila calendar week through Store.now() as New,
Assigned as Under review, and Resolved as Implemented (summary labels only;
the existing workflow and table labels are unchanged). General Feedback shows
the mean of valid numeric integer ratings 1–5, submissions in the current
Manila calendar month through Store.now(), and the rounded percentage of valid
ratings that are 4–5. Mean is displayed to one decimal. An empty rated dataset
shows em dashes for mean/percentage and real zero submission counts. Invalid or
future dates do not count toward a calendar period. Live subscriptions refresh
statistics after record updates; visible-tab and Manila midnight refreshes
also update the period counts. No seed or stored record fields change.

The frozen
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

## Final P1 review and partner handoff — October 21, 2026

All P1 routes are implemented and deployed, including the three official role
dashboards, alert workflow/dialogs, map, verification, announcements, feedback,
facilities, login and Resident Profile. The data model and migration guide now
describe the implemented adapter and all resident/official route equivalents;
the repository remains a static HTML/CSS/vanilla-JavaScript demo.

The final geometry/asset review covered 95 route/role/width combinations:
63 P1 checks and 32 P2 checks. P1 coverage comprises nine Secretary routes at
1920/1440/1366/768/390, Profile at those five widths, Login at five widths and
Responder/Rescuer Dashboard/Alert Detail at 1920/390. No P1 document overflow,
missing rendered images or undersized audited controls were found. Browser
consoles were clear. P2 routes were cross-tested read-only at desktop/mobile;
registration's initial state was included, without creating another account.

Actual two-tab handoff evidence is recorded per feature, rather than claiming
a single simultaneous review with the partner: F-X1/F-X2 in the Sync B alert
walkthrough, F-X3 in Announcements, F-X4 in verification and F-X5 in Feedback.
The current 120-test suite also exercises the frozen integration contract.
Each feature's checks preserved/restored fictional data and signed out demo
sessions. A real device/virtual keyboard, full 200% zoom matrix and forced
service outage were not exercised; no automated accessibility scanner result
is claimed. Earlier keyboard/focus/confirmation checks are described above.

Partner-owned remaining findings were added to the existing GitHub issues:

- Issue #2: Earthquake must map to triangle-alert; the shared helper still
  returns activity. Resident Dashboard links/history, My feedback View details,
  General Feedback Clear and resident login demo buttons need at least 44 px
  mobile hit heights. Resident Map layer switches measure 44×24 inside the
  mobile dialog and need a 44×44 hit area around the visible switch.
- Issue #5: resident Dashboard/Map nearby reads still use list({}); change those
  nearby reads only to list({nearby:true}). Preserve the private own-alert read
  and get(id) policy. The public adapter was already merged in PR #9.

P1 did not edit P2-owned source, icons, styles or Map Kit to bypass ownership.
These findings prevent calling the combined product fully reviewed or tagging
a final v1 release. P1's own implementation and review are complete; partner
fixes and a shared final sign-off remain. The historical remote sync-b tag is
also still pending the user's normal Git credential environment.

## Authorized P2 follow-up — October 21, 2026

The user explicitly authorized only the Earthquake icon, two nearby-alert
reads and reported resident mobile hit areas. This exception permits the
changes below in P2-owned source; it does not transfer general P2 ownership.
The remaining-findings list above records the pre-fix review.

- The shared Earthquake mapping is triangle-alert; the other disaster mappings
  and the existing Lucide SVG assets are unchanged. An exact six-type mapping
  regression test covers this rule.
- Resident Dashboard and Map nearby reads use alerts.list({nearby:true}). The
  Dashboard's resident_id own-history query and private get(id) policy remain
  unchanged. Maria can see public A-1038, and Jose can see public A-1042. Their
  nearby sheets contain barangay-level location and generated summaries,
  without another resident's identity, exact address, victim count or notes.
- Dashboard history/inline links, feedback details, rating Clear, resident
  demo-login buttons and Map layer switches have at least 44 by 44 hit areas.
  Map switches retain their visible 24 px track and 48 px row height. Resident
  login styling is scoped; official Login was checked as a sibling screen.

Verification: 121 Node and browser tests pass, as do the 221-file offline
checker, changed-module syntax and whitespace checks. Thirty responsive cases
cover Login, Dashboard, Map, My feedback, General Feedback and the open Map
layers dialog at 1920/1440/1366/768/390. No document overflow or undersized
audited targets were found. Screenshots and measurements are retained in
p2-authorized-fixes-browser-qa.json and p2-fixes-*.png in the local evidence
folder. The nearby navigation, announcement link, feedback dialog, rating
Clear, Map switch toggles and Escape/focus return were exercised. Browser
console warnings/errors were absent. Demo sessions were signed out; no stored
records were submitted, changed or reset.

A fresh localhost origin was used because the prior 127.0.0.1 browser origin
retained older page modules despite matching current source served by the
preview server. The strict static audit retains the same 11 action-detection
heuristic findings in unchanged P1 files, with zero unresolved ownership
findings. Those controls use event listeners and were exercised in the prior
feature reviews; the strict audit itself does not pass. No new design system
or runtime dependencies were introduced. Real-device touch/virtual keyboard,
the full 200% zoom matrix, forced outage and a new two-tab write walkthrough
were not run in this patch. Earlier feature integration evidence remains.

The tracked code findings are resolved by this patch; partner final review and
release-tag publication remain separate steps. No final v1 sign-off is implied.


## Authorized SOS reliability patch — contract Issue #16, October 21, 2026

The user authorized this focused P2 follow-up, including the limited P1-owned
API and regression-suite changes. Other audit findings remain separate.

- `alerts.create(payload)` validates the resident, approval and payload, then
  reuses the latest own active alert in the same barangay inside the existing
  transaction. Active means any status other than Resolved. A retry returns
  the joined alert without applying its payload, changing revision, emitting
  an event or adding notifications. A new alert is permitted after resolution.
  Method signatures, DTOs and the status workflow are unchanged. Legacy
  duplicate records are not deleted. Cross-tab serialization still depends
  on Web Locks as described above; the fallback is only per tab.
- Resident report links require one positive safe-integer ID and authorize it
  through `alerts.get` before showing confirmation or details. Only Pending
  shows the sent confirmation; progressed and resolved alerts show their real
  state. Missing, malformed, unknown and foreign IDs use the existing error UI.
- Details reopen with the saved coordinates, including zero values. Editing
  descriptive fields retains the pin; selecting My household explicitly moves
  it home. Shared map zoom controls are non-submit buttons inside forms.

Verification: 128 Node/browser tests pass, the 222-file offline checker passes,
46 JavaScript modules pass syntax checks and whitespace checks pass. Browser
walkthroughs covered invalid/foreign/resolved links, pin save/reopen/edit/home,
zoom controls, the full cross-tab official status workflow and two stale
resident submission tabs returning the same newly created alert. Twelve report
state/width checks at 1920, 768 and 390 pixels found no document overflow; map
zoom controls remain at least 44 by 44. Console warnings/errors were absent.
A fresh localhost test origin avoided stale modules on the older preview
origin. All live writes used isolated fictional demo data. No public-site SOS
was submitted. Real devices, virtual keyboards, forced outages and the full
200% zoom matrix were not exercised. No final v1 sign-off is implied.

## Authorized access and feedback safety patch — contract Issue #18, October 21, 2026

The user authorized H3/H4 and this limited P1-owned implementation follow-up.
`users.get(id)` retains its existing user/household authorization and DTO shape.
Its `verification` field is now null for operational roles, including staff
with a resident flag. Only the resident owner and authorized same-barangay
Secretary receive the latest verification. Dedicated verification endpoints,
Profile owner reads and Secretary review remain unchanged.

Secretary Feedback now resolves an explicit selection against the full sorted
category before choosing its page. Initial valid links switch to the record's
actual category; incompatible search/status filters clear with a visible
notice. Sorting and live refresh retain that record and recalculate its page.
If a selected record disappears or no longer matches filters, details/actions
clear and the page explains unavailability. Invalid, duplicate, unknown and
inaccessible linked IDs never silently select an actionable substitute. Invalid
selection also persists across reloads. A new
explicit row/filter/page choice retains the existing browsing behavior.
Assignment/resolution still use the selected record and existing confirmations.
No new API signature, schema, endpoint or visual redesign is introduced.

Verification: 137 Node and browser tests pass, the 222-file offline checker
passes, all 46 modules pass syntax checks and whitespace checks pass. New
regressions cover role/owner/barangay projection policy, dual-role staff,
strict linked IDs, older feedback, filter reveal, sort/live page movement and
missing selections. Browser checks used 13 complaints in an isolated localhost
origin: a linked older case opened on page 2, incompatible filters reset with
a notice, a cross-tab submission retained selection, and assignment/resolve
updated that case. After resolution excluded it from the active status filter,
no replacement actions appeared. Suggestion/General Feedback links select the
correct category; General Feedback remains read-only. Four invalid-link cases
had zero selected rows/actions. Twelve category/unavailable-state checks at
1920/768/390 found no horizontal overflow. Console warnings/errors were absent.
Fresh code review found no actionable issues. Fictional test data was restored;
no public-site records were changed. Real devices, virtual keyboards, forced
outages and the full 200% zoom matrix were not exercised. Other audit findings
and final release sign-off remain outside this patch.

## P1 integration follow-up after PR #19 — October 21, 2026

The operational Alert Detail page treated a null verification projection as
Pending after the access-safety patch. It now fetches the joined resident
verification only for Secretary and renders a badge only when an actual
verification record is available. Responder/Rescuer incident actions and all
other layout/content stay unchanged; no API or P2-owned source was changed.

Verification on base main 031350a plus this patch: 137 Node/browser tests, the
222-file offline checker, all 46 module syntax checks and whitespace checks
pass. A real two-tab tablet walkthrough reached Acknowledged, Responding,
Rescue in progress and Resolved, with the resident updating at every hop and
showing Sampaguita Elementary School. Response Cancel and Resolve Cancel kept
the alert unchanged. Nine role/width checks at 1920/768/390 found no document
overflow or enabled targets below 44 px on tablet/mobile. Secretary retains
Approved; Responder and Rescuer have no verification row. A linked General
Feedback record selected its actual category; an unavailable ID selected no
substitute and exposed no detail actions. Official console clear; an initial
resident navigation before asynchronous sign-in completed produced the
expected AUTH guard error. The signed-in walkthrough had no unexpected errors.
Local fictional records were restored; no public records changed.

Evidence is post-sync-browser-qa.json and post-sync-*.png in the local evidence
folder. A temporary local script query avoided stale browser module caching;
official-alert.html was restored before committing. The strict audit retains
the same 11 documented action-detection findings (zero unresolved ownership
findings); it does not pass. Real-device/virtual-keyboard, full 200% zoom and
forced-outage verification remain unperformed. No final release sign-off is
implied.

### Announcement lifecycle extension — October 21, 2026

- `Api.announcements.create({title, content, expires_at?})` publishes immediately. Expiry defaults to null; explicit values require a future ISO timestamp with a timezone. The form labels Manila time (UTC+8).
- `update(id, {title?, content?, expires_at?, expected_revision?})` edits Active records only. Author, barangay, created_at and published_at cannot be changed. `archive(id, {expected_revision?}?)` archives Active records; `retract(id, {reason, expected_revision?})` withdraws Active or Archived records. There is no restore/delete method.
- All writes revalidate Secretary role, barangay and current state inside the transaction. A stale supplied revision produces CONFLICT without changing data. Title/content retain the 200/5,000 limits; reason is trimmed and required, at most 500 characters.
- Records retain an append-only `history[]` of publication/edit/archive/expiry/retraction snapshots with actor, timestamp, title/content/expiry and applicable reason. Edits preserve original publication order/time. Legacy created_at-only records are projected as Active with no expiry and receive history lazily on mutation; existing storage/schema version is preserved.
- `list()` returns all own-barangay statuses to the Secretary and only Active records to other signed-in roles. `get(id)` rejects inactive public reads with NOT_FOUND. Public DTOs omit management history/retraction metadata; author DTOs exclude credentials.
- Expiry at or before the shared Store.now clock is immediately projected Archived for all reads, even before maintenance. Secretary `expireOverdue()` persists scoped expiry history once; repeated calls are no-ops. Home and the resident announcement list refresh at deadlines and on visible-tab return. No browser must visit the Secretary screen to hide expired public content.
- The Secretary route retains ten-record pagination and URL page/status/search/deep-link state. Search matches title/content and combines with All/Active/Archived/Retracted. Each row has one anchored, keyboard-accessible action menu; no redundant Read button. Composer reuse supports publish/edit, optional expiry, validation, draft-discard confirmation and API error retention. Retraction is a centered reason/confirmation dialog with a 500-character counter. Existing shell/navigation is unchanged.
- This remains a fictional browser-store adapter. A Laravel implementation must enforce the same authorization, transactional transitions, revision checks, history preservation and active-only public visibility on the server, and run scheduled expiry maintenance; browser checks are not a production security boundary.

### Secretary Dashboard Figma alignment — October 22, 2026

- The shared official-dashboard route delegates only Secretary to the redesigned dashboard (Figma frame 3743:90916). Responder and Rescuer retain their existing dashboards and actions. The Secretary layout has four linked metrics, Priority overview, existing BCMap preview, Quick actions, source activity, pending verification links, and recent announcement reads. Post announcement reuses the existing composer and its validation/confirmation flow.
- Counts use the current scoped API records and Store.now. Active alerts are Pending/Acknowledged/Responding/Rescue in progress; Priority uses the existing newest-received ordering with ID tie break, since no severity field exists. Open feedback includes Pending/Assigned complaints and suggestions only. Pending verification counts/links use each resident's latest actionable submission and deadline.
- Announcements today counts valid publication events on the Manila calendar day, including subsequently archived/retracted publications. Recent announcements shows up to three Active records by publication time, excluding expired/future/unpublished records. Optional stored categories are displayed; the current API has no category field, so uncategorized records use neutral Update badges rather than title-derived categories.
- Activity is a read-only projection of actual alert receipts, verification submissions/available review timestamps, announcement publications, and feedback submissions. It does not fabricate feedback-review history or create a new audit-log schema. View all opens an existing dialog with exact record links. Existing authorization applies at every destination.
- The map preserves existing artwork and marker coordinates at its native 1.8 aspect ratio. Counts describe valid active markers and mapped facilities; proximity/distance is not available. Missing/invalid coordinates never become fabricated zero-coordinate markers. An unsupported barangay retains the existing coverage empty state. Publication expiry, verification deadlines, Manila midnight, visible-tab return and entity updates refresh the data; no API/schema/seed changes were introduced.

Verification after integrating main PR #25: 181 tests pass (11 new Secretary dashboard model/API regressions), the 241-file offline validator passes, 53 JavaScript modules pass syntax checks, and diff whitespace checks pass. The project is static HTML/CSS/ES modules and has no production bundle/type-check step. Browser checks covered Secretary login/sidebar return/refresh, four summary destinations, exact Priority incident, selected map marker/full map, existing composer open/cancel, full activity dialog and linked General Feedback selection, Jose's verification details, and fresh announcement details. The newly merged Responder Dashboard and unchanged Rescuer heading/route isolation remain intact. Six viewport checks at 1920/1440/1366/768/390/320 found no horizontal overflow and retained the native map ratio; tablet/mobile main targets meet 44px. Console warnings/errors were absent. Empty/invalid/foreign records, deadline/publication boundaries, data transitions, and other-role permissions were covered in isolated in-memory tests; no browser demo records were modified. Fresh read-only review found no remaining actionable issues after correcting white-on-white section arrows. Real devices, virtual keyboards, forced outages, and the full 200% zoom matrix were not exercised. No final release sign-off is implied.

### Shared notification system — October 23, 2026

- The staff shell uses one shared notification center matching Figma panel
  2084:40090 (500 px desktop, 24 px padding) and mobile 2090:41386. Resident
  Notifications keeps its existing full-page route with the same cards, badges,
  filters and anchored action menu. All roles use confirmation 3639:87698.
  Notification-only CSS and local SVGs do not alter other page components.
- All/Unread/Read filters apply immediately. Opening marks a record read, then
  rechecks the active account and source authorization before previewing its
  details. Staff alert previews and existing destination navigation are retained.
  Read cards offer Mark as unread; every card offers Dismiss notification. Menu
  placement is anchored, viewport-clamped and keyboard accessible. Lists scroll
  independently of staff controls/footer; notifications remain full-page scrollable
  for Residents. Cancel, close and Escape preserve records.
- `get`, `markRead`, `markUnread`, `dismiss`, `markAllRead`, and `clearRead` enforce
  recipient ID, effective role, canonical source route, source existence, barangay
  and source ownership/assignment in the API adapter. Invalid or legacy misrouted
  notifications are excluded from list/counts and denied on direct ID access.
  Responder/Rescuer incident notifications require that exact current assignee.
  Resident verification/SOS/feedback notices require their own account or record;
  community announcements require their barangay and current Active visibility.
- Administrative submissions/new SOS/publication notices target effective
  Secretaries only. Incident transitions target that barangay's Secretaries,
  exact assigned operators, and the affected Resident. New assignments retain
  their assignment/assistance titles. Rescue updates include the actual recorded
  destination. Publication notices go to Secretaries and effective Residents in
  the same barangay, excluding operational staff. Existing writers are reused;
  there is no invented facility-management or coordination-request workflow.
- Notification DTOs add title, description, icon and source_expires_at; new
  incident notices store event_status and presentation snapshots. Canonical legacy
  records are projected without rewriting or resetting demo data. Legacy read_at
  is recognized; Mark as unread removes it. Dismiss and Clear read persist
  dismissed_at on only authorized recipient rows; they do not delete shared rows
  or affect other users. Clear read optionally checks captured recipient_id and
  expected_role inside the transaction to reject a stale confirmation. Existing
  calls without arguments remain supported.
- Entity subscriptions, request revision guards, visible-tab refresh, and source
  expiry timers keep lists and bell counts current. Resident bell counts update
  on every Resident page, including after announcement withdrawal/expiry.
- This is still the fictional browser-store adapter, with no Laravel backend in
  this repository. These data-access checks are not a production security
  boundary; P1 must enforce equivalent recipient/source/role authorization and
  state isolation in authenticated server endpoints when replacing the adapter.

Verification: 205 Node tests pass (15 notification regressions), the 260-file
static/offline validator passes, all 58 JavaScript modules pass syntax checks,
and diff whitespace checks pass. No production bundle or separate type checker
is configured for this plain HTML/CSS/ES-module project. Independent read-only
review found no remaining actionable issues. Browser walkthroughs used a separate
localhost origin and fictional demo accounts: Secretary acknowledgement delivered
only to Carlo, response logging delivered only to Ramon, rescue logging included
the chosen school, and Maria saw only her own incident progress. Tests covered
All/Unread/Read, opening/read state, Mark as unread, anchored menus, Escape,
Cancel/close confirmation, focus return, role-specific previews and destination
links. Clear/dismiss mutations, direct-ID denial, cross-client persistence,
source reassignment, dual roles, malformed sources, announcement withdrawal and
exact expiry were verified in isolated in-memory tests. Desktop 1920, tablet 768,
mobile 390 and 320 checks found no horizontal overflow; notification controls at
320 meet 44 px targets and long staff lists retain visible controls/footer.
Resident uses the same confirmation. Browser console warnings/errors were absent.
Browser test records remain isolated to the temporary localhost origin; no public
site records were modified. Real devices, virtual keyboards, forced outages and
the full 200% zoom matrix were not exercised. No final release sign-off is implied.

### Resident Notifications Figma restoration — October 23, 2026

Resident Notifications follows the approved R-13 desktop frame 250:18436 and
mobile frame 2017:33343 again: heading/subtitle at left, filter controls at right,
and separate SOS updates / Barangay and account updates white panels. An
optional presentation adapter supplies only Resident markup; the existing shared
controller still owns filtering, persistent state, live updates, source checks,
menus, previews and clear-read confirmation. The staff fallback markup and shared
notification stylesheet are unchanged. The confirmation block is byte-identical.

The Resident stylesheet is loaded only on that page. It restores the original
Inter scale, icon tiles, read/unread dots, timestamps, light-blue unread cards,
white read cards and read-card X dismissal. Existing overflow actions remain
available on hover/focus and always on touch; closed records keep a visible
ellipsis. The new X control uses the same persistent API dismissal and retains
focus on live refresh. Both named sections remain present for filtered/empty
results; alert_new and alert_status belong only to SOS, all other authorized
notifications belong to account/community updates. Records are not replaced by
Figma sample data. The shared access fixes and all role/account isolation remain.

Verification: 208 tests pass, including three new grouping/live-API regressions;
the 274-file offline validator, 59-module syntax checks and diff checks pass.
Browser checks covered All/Unread/Read, live cross-tab publication, opening a
community update, Mark as unread, original preview destinations, unchanged
confirmation Cancel/close, and dismiss focus across a cross-tab read update.
Clear/dismiss mutations and recipient isolation are covered in isolated API tests.
Seven widths (1920/1440/768/390/375/360/320) retained correct columns/stacking,
no horizontal overflow or metadata clipping, 32/24 px glyphs and 44 px targets.
Secretary still renders the existing staff panel with no Resident markup or
stylesheet. Responder/Rescuer use that same unchanged default presentation;
APIs, permissions, shared shells and shared CSS were not modified. Fresh review
found no remaining findings. No console warnings/errors were observed. Local
fictional records were used; no public-site records were changed. Real devices,
virtual keyboards and the full zoom/outage matrix were not exercised.
