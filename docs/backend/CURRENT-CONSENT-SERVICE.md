# Current consent authority — actual P1 service

DBA3e632f37e5090295b665c0a0907c492d34af9997 publishes the ratified tenth notification_preferences migration/private model. P25e61893 explicitly ratifies the contract. P1 now implements CurrentSmsConsent, self GET/PUT, and safe opt-in shared registration. No further consent approval is requested. No DBA worker/transport/P2 producer is replaced or enabled.

## Exact API and service

GET/PUT /api/v1/me/notification-preferences/{purpose} use current.identity, original session generation/scope and normal CSRF. PUT accepts only state(granted/revoked), original integer expected_revision, policy_version and template_version. No target user/barangay/recorder/channel/phone/message fields. Unknown purpose/version422, stale revision409, invalid session401, grant-role403, unavailable authority503. Default normal profile remains503; guests401.

Shared browser transport accepts the exact underscore purpose segments while retaining its traversal/external-URL rejection. Use its existing request/envelope API; multipart FormData preserves the browser boundary and shared CSRF/cookie/identity headers. Photo processing/conflict/validation codes are explicitly whitelisted with safe static copy; unknown server exception text is never trusted. No second fetch/auth client is needed.

Exact pairs: incident_review / sms-consent.v1 / alert-review.v1 (current Captain/Secretary), barangay_announcements / sms-consent.v1 / announcement-review.v1 (current Resident/Captain/Secretary). Consent is only one gate: P2 still intersects exact source audience, DBA still validates current destination/budgets/provider policy. Phone, role, in-app approval and global flags never create consent.

Self GET returns purpose/channel/state/revision/versions/grant and revoke UTC times; absent=not_granted/revision0 without insertion. Explicit mutation starts1 and CAS increments. Active owner may revoke after losing grant-eligible role. Old observations never silently become current; other-scope consent never transfers. Regrant requires a new explicit mutation. No demo account is seeded granted.

Preference and existing ACTUAL TypedAuditRecorder commit/rollback together on the same named MySQL connection. Resource user/own ID, action notification_preference.changed, status/revision plus bounded canonical server reason with preference_id/purpose/channel/from/to/versions. Retain revoked evidence; no phone/message/client prose, new audit vocabulary or second writer.

## P2 and DBA integration boundary

App\Services\Identity\SmsEligibilityReferences::allows(observed,purpose):bool performs a short CURRENT single-recipient guarded read **outside all existing transactions**. Current identity/account/appointment then consent. Known denial/absence/invalid identity=false; unavailable schema/binding/current capability503. P2 preflights before source locks, retains original submission intent/replay semantics and intersects its actual authorized audience. Never call from Module::event after incident locks or lock a whole audience.

SmsDeliveryEligibility::withCurrentEligibility(observed,purpose,Closure $reserve):bool uses the same current guard and only then invokes reserve(consentRevision,policyVersion,templateVersion):bool under person/account/appointment -> consent locks. DBA callback must reauthorize current source and reserve its existing ledger on the same connection; no provider/network/byte I/O inside. Return commits before external I/O. Denial skips callback; a thrown callback rolls back SQL. Repeat at every reservation/retry/final pre-send gate. A committed revoke before the gate denies; an already-started external request is not promised cancellable. DBA retains fencing/uncertain outcomes and private consent evidence on reservations.

IntegrationServiceProvider selects this ACTUAL scoped service for both interfaces only when integration.consent_test_bindings=true / P1_CONSENT_TEST_BINDINGS=true **and** existing P2_TEST_BINDINGS confirms the guarded disposable profile. Default false, production/SMS/Make/dispatch unchanged. Missing interface is never a true fallback. DBA can opt into this real service for its isolated current-worker tests; this does not authorize a production worker.

## Tests and remaining dependencies

P1 real MySQL/HTTP tests cover absence/purpose/version/self/scope/generation/role/current reads, revoke after losing grant role, actual typed audit rollback, callback locks and committed current result, old RR rejection, concurrent grants/CAS and independent-process reservation-versus-revoke serialization. The SQL-only test reservation callback is a boundary probe, not a fabricated DBA delivery or provider acceptance. No external call occurs.

DBA must now integrate its current worker with this actual authority, and P2 must supply actual-service positive/negative SMS-producing fixtures for the two agreed families. Keep unsupported-intent exit2 explicit until those gates pass; in-app-only acceptance is separate. Existing profile UI consent controls need their agreed original profile flow after endpoint acceptance; no new UI or fake granted defaults are added here. Full profile/recovery/verification/personnel/facility administration is still outside this focused presentation slice.
