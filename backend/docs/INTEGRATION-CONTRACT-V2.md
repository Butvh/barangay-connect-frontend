# DBA integration contract v2 — November 3, 2026

DBA ratifies the mappings below against P1 #49 `41b6c42fc536237b10034b3eb3fe058f9ee71fc1` (typed PHP/runtime source unchanged from `bc2764a746d742efb655a4b3c752ad205e28f180`), P2 #50 `c902d9f7239a8fcefdddf293fbc531876548c10a` and main `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. This records **DBA acceptance of the boundary**, not invented P2 adoption or joint signoff. See [current evidence](INTEGRATION-ACCEPTANCE.md) for the tested DBA revision. P1's interface-contract marker **1** and the persisted event-envelope version **2** are separate contracts; neither selects the other. All drafts remain unmerged.

## Additive schema and identity contract

Apply the original six November 2 migrations unchanged, then `2026_11_03_000100_add_user_auth_version.php`, then `2026_11_03_000200_add_versioned_delivery_contract.php`. No existing migration is rewritten. The first adds unsigned integer users.auth_version NOT NULL DEFAULT 0 with a named nonnegative check and an integer User cast. The second permits explicit outbox versions 1/2, adds diagnostic blocking, recipient audience, failed-receipt diagnostics and notification source/status/template metadata. It adds no duplicate role booleans or writable assignment pointers. FK/delete details are in the updated dictionary. Downgrade refuses to discard v2 events; shared systems use reviewed forward fixes. Security-generation rollback is destructive and tested only on disposable data.

User remains Laravel Authenticatable with standard remember_token behavior. Database default0 is read back as integer0; an absent/null attribute stays null in PHP. There is **no model default/fallback that turns a missing version into 0**. P1 must keep identity disabled until migrated. Normalized email remains case-insensitively unique and lowercase/trim checked. account_status, independent is_resident/is_captain and appointment/Tanod relationships remain authoritative. Operational roles are projections.

P1 owns incrementing auth_version in the same transaction as password/reset, role/status/security/scope revocation and session/token handling. All affected users' operations guards precede user/appointment locks. P1/P2 mutation authorization must compare the captured session generation against a **current locked** user read, not only role/scope. P2's current Actor/ReferenceData path checks role/scope and needs this integration review. No auth workflow is implemented here. Scope changes cannot cascade-rewrite retained scoped incident/history FKs; design any supported move explicitly with the DBA before changing a referenced user's barangay.

## Canonical persisted envelope and recipient DTO

One production event model: `App\Models\OutboxEvent`. One dispatcher: `OutboxDispatcher`. P2 inserts the event and relational recipients inside the authorized domain transaction, on Laravel's default MySQL connection. P1/P2 writers must not independently commit, enqueue HTTP work, duplicate the dispatcher or use a production MemoryStore.

```json
{
  "event_id":"8c3f1c74-98ef-4f27-a462-48beb6df4620",
  "version":2,
  "type":"incident.created.v2",
  "barangay_id":1,
  "resource_type":"incident",
  "resource_id":1,
  "occurred_at":"2026-11-03T00:00:00Z",
  "template_key":"incident-created.v2",
  "payload":{"status":"Pending"}
}
```

Typed recipient input is P1's `RecipientReference(userId, inApp=true, sms=false)`. **An audience constructor argument is not required.** P2 derives the intended resident/official audience from the authorized event/source and recipient, then persists outbox_recipients(outbox_event_id, recipient_id=userId, barangay_id, audience, in_app, sms). V2 requires a persisted audience even though the additive SQL column is nullable for legacy rows. A browser never supplies this authority. P2's consumer reauthorizes current access against that persisted audience; it must not silently switch audience after a role change. This supersedes the earlier request to extend RecipientReference. Composite FKs enforce same scope. At least one channel is required. At most1,000 recipient rows per event; split large authorized fanout into distinct event IDs before writing. Duplicate recipients are rejected by the unique key. New v2 IDs must be P1 canonical lowercase UUIDv4. A repeated event ID must have exactly the same semantic envelope/recipients or fail; P2 owns request/event idempotency policy.

Do **not** place recipients, a payload.version, arbitrary context containers, messages, links, phone/email, private files, exact household/location details, recovery material or credentials inside payload. It is a flat allowlisted snapshot, max256 JSON bytes in application validation (DB storage cap remains2KiB for legacy compatibility). Store UTC and serialize explicit UTC/offsets. Type, version, resource, event template and channel template must all match the definition; no dispatch-time renaming or conversion.

## Exact event allowlist

Every v2 event has its listed event template. Its in-app receipt template is that key with `.in-app.v2` replacing `.v2`. **Only the two rows explicitly allowing SMS can request it.** Being registered for in-app does not authorize SMS. P1-domain templates still require P1 authorized source projections and P2 handler registration before enabling those domain writes.

| Type | Resource | Event template | Exact payload | SMS template / route |
| --- | --- | --- | --- | --- |
| incident.created.v2 | incident | incident-created.v2 | status=Pending | alert-review.v1 / direct urgent |
| incident.assigned.v2 | incident | incident-assigned.v2 | status in five incident stages | none / in-app only |
| incident.status_changed.v2 | incident | incident-status-changed.v2 | status in five incident stages | none / in-app only |
| incident.rescue_required.v2 | incident | incident-rescue-required.v2 | status in five incident stages | none / in-app only |
| announcement.published.v2 | announcement | announcement-published.v2 | empty object | announcement-review.v1 / Make nonurgent |
| feedback.submitted.v2 | feedback | feedback-submitted.v2 | kind=complaint/suggestion + status=Pending; or kind=general + status=null | none |
| feedback.updated.v2 | feedback | feedback-updated.v2 | kind=complaint/suggestion; status=Pending/Assigned/Resolved | none |
| verification.updated.v2 | verification | verification-updated.v2 | status=Pending/Resubmission requested/Approved/Rejected/Expired | none |
| personnel.updated.v2 | personnel_appointment | personnel-updated.v2 | role=secretary/responder/rescuer + status=Active/Inactive; or role=null + status=Unassigned | none |
| facility.updated.v2 | facility | facility-updated.v2 | status=Active/Inactive | none |
| security.updated.v2 | user | security-updated.v2 | action=password_changed/password_reset/access_revoked | none |
| identity.resident_registered.v2 | user | identity-resident-registered.v2 | empty object | none |
| profile.updated.v2 | user | profile-updated.v2 | empty object | none |
| household.updated.v2 | household | household-updated.v2 | empty object | none |

Incident stages are exactly Pending, Acknowledged, Responding, Rescue in progress, Resolved. The snapshot records the stage **at the event**, while P2 rechecks current source access separately. Never substitute the later incident status for notification.event_status. Announcement notifications may use generic event copy; arbitrary title/content snapshots are not part of v2.

The two explicit v1 definitions (`alert.created.v1`, `announcement.published.v1`) remain readable with their original empty payloads/templates. They are legacy and should not be newly emitted after adoption of v2. Existing persisted v1 rows are not rewritten. P2's 32hex IDs, `event_type`, nested recipients/channels/context and unversioned `incident.*` prototype were never adopted: they fail closed. Map them in **P2's writer/service changes**, generating UUIDs and selecting canonical v2 names at the business boundary. There is no fallback alias in the consumer.

Fixtures: `tests/Fixtures/events-v2.json` supplies14 valid shapes and8 invalid mutations. The base UUID is a single-case fixture, not an ID to reuse across a batch. Unit checks and MySQL delivery tests consume these fixtures. Current P1/P2 source compatibility is checked separately by `tests/Compatibility/check-shared-contracts.php`; a failing gate must not be reported as combined readiness.

## Ratified typed boundary and precise unresolved owner requests

P1 owns `app/Contracts/Events/**`; this branch does not edit them. DBA accepts its current OutboxWriter signature:

```php
record(EventId $eventId, string $type, int $scope, int $resourceId,
       array $recipientRefs, DateTimeImmutable $occurredAt,
       EventContext $context = new EventContext): void;
```

| P1 type / boundary | DBA mapping and acceptance | Remaining owner work |
| --- | --- | --- |
| EventId.value | Lowercase UUIDv4 in outbox_events.event_id; v2 consumer rejects UUIDv7, malformed/32hex IDs and wrong case. No rewriting. | P2 generates and retains canonical IDs/idempotency. Existing explicitly supported v1 rows remain legacy. |
| DateTimeImmutable | Normalize to UTC and retain microseconds in timestamp(6); OutboxEvent now writes `Y-m-d H:i:s.u`. | P2 passes the actual typed timestamp on the shared connection. |
| EventContext(status) | Incident snapshot `['status' => status]`; null maps to an empty context for empty-context families. Validate the exact event definition before persistence. | P1/P2 must extend the typed context deliberately for the other payloads below; arbitrary arrays are not an alternative. |
| RecipientReference | Actual typed list, relational recipient rows, server-derived persisted audience; in-app-only is valid. | P2 selects authorized users/channel intent and reauthorizes source/audience at consumption. SMS intent is not consent/budget approval. |
| AuditSummary.values | Allowlisted structured JSON <=4096 encoded bytes; also satisfy DB JSON_STORAGE_SIZE <=4096. Actor/role/scope server-derived; explicit system actions may have null actor/role. | P2 implements the typed audit adapter, physical aliases and SQL commit/rollback/bounds tests. The outbox probe does not certify the production audit writer. |
| ResourceReference(type,id) | Accepted audit vocabulary includes `alert`/`personnel`; these are not automatically outbox `incident`/`personnel_appointment`. | P2 maps audit physical fields explicitly and infers the outbox resource/template from its canonical registered type. No consumer aliases. |
| Transaction ownership | One named/default mysql Connection; caller owns domain commit/rollback, dispatcher owns each in-app receipt transaction. No writer/handler independent commit, queue or HTTP. | P2 supplies production adapters; P1 supplies reviewed integration bindings. |

P1's current context can represent the five incident stages and empty contexts (announcement, resident registration, profile and household). It cannot represent verification Approved/Resubmission requested/Rejected/Expired, personnel role/status, facility Active/Inactive, security action or feedback kind/status. The coincidental string Pending does not make the verification family complete. Those families remain **dormant** pending bounded typed context, authorized P1/P2 source projections, correct event names and P2's actual per-recipient handler/templates. Registry presence is storage validation, not producer/consumer completion. No additional family gains SMS permission.

P2's published portable wrappers still use Actor/array audit arguments, string timestamps, array event fanout and prototype IDs/fields. They may remain portable-test implementations; they are not hardcoded as the production adapter by the acceptance gate. P2 must supply typed SQL Store/ReferenceData/audit/outbox/notification adapters and set `P2ServiceProvider::P1_CONTRACT_VERSION=1` only after review. P1's current integration adapter config is null and both enable flags remain false. Do not implement another writer or bind a test double to make this gate green.

The corrected `tests/Compatibility/check-shared-contracts.php` resolves the actual P1 port binding or configured implementation class (or explicit validated `--outbox=FQCN --handler=FQCN`). Production classes must implement the reviewed interface and live under app/, never tests/. It constructs real P1 DTOs, uses SQL fixtures and the same targeted dispatcher/receipt pipeline. The default case requests **in-app only**; `--sms-intent` is a separate authorized-intent check with fake transports and no provider send. See [runner setup](../tests/ci/README.md). Passing this fixture is required but does not replace actual domain races, audit writer acceptance or five-role HTTP/E2E.

## Handler and receipt boundary

Keep `InAppNotificationHandler::handle(OutboxEvent $event, OutboxRecipient $recipient): void`. P2 implements the real one-recipient adapter/handler; P1 binds it after review. The current P2 `handle(array): int` implementation loops recipients and starts its own outbox transaction, so it is not a compatible production binding. No adapter or P1-domain notification handler is supplied by DBA.

The dispatcher, on the default MySQL worker connection, claims a committed event using SKIP LOCKED/lease/fencing; validates **all** event/recipient/channel combinations before creating routing intent; and persists independent receipts. For one in-app receipt, it locks the event then receipt, starts the transaction, calls P2 on the same connection and verifies a persisted notification before completing the receipt. P2 joins that transaction and must never commit it or use another database connection. It reauthorizes the source for this exact recipient; if access was revoked, throw `InAppRecipientUnavailable`, producing a failed diagnostic receipt rather than false success. A handler that writes nothing or returns incompatible metadata is a terminal contract failure.

Notification uniqueness remains (event_id,recipient_id) because this table is exclusively in-app. Write recipient_id, barangay_id, resource_type/id, audience, event_status for incidents, in-app template_key, safe kind/title/description/target and created_at=occurred_at. The per-channel receipts independently key (outbox_event_id,recipient_id,channel,template_key). SMS uses its own template version, delivery state and attempt ledger. A completed or failed in-app receipt is not retried by an SMS replay. A legitimate unavailable-recipient receipt can coexist with successful other recipients.

Unknown types/versions/payloads/channels/templates, missing audiences, an unbound handler or mismatched handler result set outbox_events.blocked_at plus a static last_error. No raw payload values are logged. Invalid envelopes create no receipts or SMS intent. Handler errors after valid preparation leave an explicit failed in-app receipt; valid urgent SMS intent remains independently durable. Generic transient exceptions retry at most10 dispatcher claims, then block as dispatch_attempts_exhausted. Operators must review/fix and explicitly clear blocked_at/requeue affected pending/failed receipts; never reset accepted/uncertain SMS. See the runbook.

## Concrete persistence map for P2

| P2 logical field/key | Authoritative physical field/projection and required adaptation |
| --- | --- |
| emergency_alerts.created_at (incident time) | reported_at; created_at remains processing time |
| assigned_responder_id/rescuer_id | read-only latest assignment-user projections; active state/workload derives from alert_assignments.status=active; cancelled clears current projection, completed/closed preserves historical assignee; P2 must not write user pointers |
| incident_status_history.barangay_id/status/actor_role | scope via alert FK; stage/role_at_action; allocate sequence under incident lock; recorded_at is processing time |
| alert_responses.barangay_id | scope via alert/assignment joins; response_status/responded_at/explicit rescue_required; new logs need current assignment; preserve nullable legacy provenance |
| rescues.facility_snapshot | destination_snapshot; immutable safe directory snapshot; facility_id retained; scope via incident/assignment |
| announcements.posted_by | author_id plus author_role; archived/retracted actor comes from immutable announcement_history, not duplicate writable fields |
| announcement_history.by/at and copied fields | actor_id/occurred_at + role_at_action; bounded JSON snapshot; recorded_at distinct; scope through announcement |
| community_feedback.type/created_at | kind/submitted_at; created_at is processing time; assigned_tanod_id references retained Tanod membership, not a sixth login role |
| activity_logs.actor_role/created_at | role_at_action/occurred_at, plus genuine recorded_at; summary JSON bounded; generic resource ID is not a universal FK |
| idempotency_requests.request_key/resource_id | key_digest (server HMAC bound actor/route); request_hash + safe outcome reference JSON/http_status + expires_at; P2's current plaintext-key/minimal insert cannot run unchanged |
| outbox_events.event_type/payload.version/recipients | type/version columns and separate outbox_recipients; canonical UUID, no serialized recipient list |
| notifications.user_id/link/channel | recipient_id/target; channel is always in-app; source/audience/status/template metadata added additively |
| users role flags/status | independent memberships + scoped current appointment; Tanod membership persists through appointment/removal; no operational boolean writes |
| facilities.barangay_id/is_active | managed_by_barangay_id + visibility (shared display scope may be null), active; safe DTO maps type exactly “Evacuation Center”; shared visibility never grants write authority |

P2 owns its SQL repositories/Store adapter and business services. Some P2 documentation asks DBA to implement that port, but this integration assignment explicitly reserves repositories/business implementation to P2. No production SQL Store or ReferenceData implementation exists in the reviewed drafts. Do not bind MemoryStore or claim actual-domain MySQL races until those owners deliver them. DBA supplies schema, fixtures, common locking helpers and index review only.

## Shared lock protocol — exact calls and remaining owner work

All paths use one default MySQL/InnoDB connection and transaction. First acquire staffing scope when relevant: `CapacityGuard::lockScope('barangay', $id, 'staffing')`. Next `CapacityGuard::lockPeople($allAffectedUserIds)` locks operations person guards in numeric order. Role/status/scope changes and dispatch/transfer/cancel/complete/resolve must share those keys; transfer locks both old/new personnel, and resolution locks all affected operators before any incident row.

For SOS, take the resident's operations guard then `lockPeople([$residentId], 'sos')`; verification uses operations then verification kind. Recovery/password revocation takes operations then recovery kind, then user row, then recovery challenge rows (stable ID order), then sessions; session revocation must not lock a user in the reverse order. P1 must implement/review its login/reset/session paths against this order; no such workflow is added here. Do not acquire a lower-rank guard after a higher one.

After all person guards, use **current locking reads** for user/appointment state, then incident IDs ascending, assignment IDs ascending, facility IDs ascending, then append history/audit/outbox. `CapacityGuard::lockRows($whitelistedTable, $positiveIntegerIds)` returns sorted FOR UPDATE rows; it performs no authorization or business decision. Facility deactivation takes only the shared facility row (or earlier required guards) and must never subsequently request person/incident locks. Verification locks application/submission after its user guards; civic commands lock their announcement/feedback rows. P2's logical `person:{id}` maps to operations guards, `incident:{id}` to emergency_alerts row, `facility:{id}` to facilities row, and announcement/feedback keys to their corresponding rows. Its old `outbox:{uuid}` handler transaction is replaced by joining the dispatcher's event/receipt transaction.

The unique upsert then row lock serializes simultaneous first guard creation. Invalid/coerced IDs or scope/kind pairs are rejected before SQL. Under REPEATABLE READ, a plain SELECT after a prior snapshot can stay stale despite a later guard wait: use FOR UPDATE/current reads for authoritative role, status, revision and capacity scans. The regression test demonstrates this with two independent connections. Whole internal transactions may retry deadlocks; no provider HTTP belongs in that retry boundary. Generated keys separately prevent duplicate active incident-role/resident-current records.

Occupied staffing remains3/6/6, including inactive staff; incident capacity remains Responder2/Rescuer1. Captain override stays disabled pending explicit ratification. P1/P2 actual-domain race tests must cover competing incidents, duplicate same-incident writes, stale revision, transfer/revocation, completion release, facility deactivation/use and full rollback. The existing DBA independent-process protocol fixtures are not substitutes for those service tests.
