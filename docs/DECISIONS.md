# Decisions

Entries start with [P1] or [P2].

- [P2] Public login and registration do not call requireRole; protected resident pages call it before rendering and then read Auth.current(). The frozen contract does not specify a requireRole return value.
- [P2] Person 1 core was absent at bootstrap; a temporary isolated adapter allowed UI work. It was removed when P1 core was merged. resident-runtime.js now re-exports the real shared Auth/Api/Config/Store modules. Earlier adapter data is not migrated into P1 storage.
- [P2] P1 Api.users.get(id) includes household and latest verification, so resident pages consume those joined fields. Api.verification.list is Secretary-only.
- [P2] Registration submits both validated document names in the frozen file_name string, separated by a semicolon; only metadata is retained. No document bytes are uploaded or persisted.
- [P2] Notification dismissal is tab-local presentation state; only clearRead mutates the shared notification list because the frozen API has no dismiss method.
- [P2] Dalisay and Pag-asa map variants are deferred; the Sampaguita illustration is used only as demo geography. No route or real geolocation is implied.
- [P2] Existing seed A-1042 is Pending, so Maria initially sees an active SOS. A second active SOS is blocked. The no-active dashboard appears when all own alerts are resolved.
- [P1] ERD: add assigned_responder_id and assigned_rescuer_id to emergency_alerts.
- [P1] ERD: add location_label, map_x and map_y to emergency_alerts.
- [P1] ERD: add map_x/map_y to households and facilities.
- [P1] ERD: add immutable barangay_id to alerts, derived from the reporting resident.
- [P1] ERD: resident_id and household_id may be null for legacy alerts without a reporter; do not invent residents for A-1038/A-1031.
- [P2] Notification links are allowlisted relative resident routes. The legacy resident-my-feedback route is normalized to resident-feedback; a small compatibility redirect preserves external deep links.
- [P2] Countdown formatting accepts an optional reference date. Verification passes Store.now() so its countdown follows P1's shared October demo clock instead of the machine calendar.

