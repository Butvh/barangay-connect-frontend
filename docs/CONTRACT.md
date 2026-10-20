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

