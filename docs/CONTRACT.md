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

