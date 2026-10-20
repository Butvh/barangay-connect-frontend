# Decisions

Entries start with [P1] or [P2].

- [P2] Public login and registration do not call requireRole; protected resident pages call it before rendering and then read Auth.current(). The frozen contract does not specify a requireRole return value.
- [P2] Person 1 core, official pages and Profile were absent at bootstrap. A TODO(contract) adapter under assets/js/pages/resident-contract-stub.js uses its own bc-p2-demo-v1 key, with tab-local sessions. resident-runtime.js prefers P1 modules when installed together. This adapter does not prove F-X1–F-X5 integration.
- [P2] Requested Api.users.get(id) include the signed-in resident's joined household so P2 can consume its address and map coordinates without reading the P1 store directly.
- [P2] Registration submits both validated document names in the frozen file_name string, separated by a semicolon; only metadata is retained. No document bytes are uploaded or persisted.
- [P2] Notification dismissal is tab-local presentation state; only clearRead mutates the shared notification list because the frozen API has no dismiss method.
- [P2] Dalisay and Pag-asa map variants are deferred; the Sampaguita illustration is used only as demo geography. No route or real geolocation is implied.
- [P2] Existing seed A-1042 is Pending, so Maria initially sees an active SOS. A second active SOS is blocked. The no-active dashboard appears when all own alerts are resolved.

