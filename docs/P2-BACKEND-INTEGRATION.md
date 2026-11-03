# P2 backend modules — integration handoff

Status: **P2 compatibility candidate** (November3,2026). Actual P1/DBA sources are composed privately for SQL/HTTP tests; production and original-UI registration remain gated. Read [the current compatibility matrix and evidence](P2-COMPATIBILITY.md) first. It supersedes provisional storage/event assumptions below and records exact revisions, owner requests and untested gates. No main merge or live deployment is performed.

## Ownership and registration

P2 supplies portable domain services plus real Laravel/DBA persistence, identity/event adapters, controllers, route fragments, factories/readers and isolated/SQL/HTTP tests. The current composed runtime is PHP8.5.12/Laravel13.39.0/MySQL8.4.13. P1 owns framework/authentication and reviewed binding selection.

P1 must:

1. Preserve these `backend/app` modules while adding the foundation. Configure `App\` => `app/` using the application's Composer autoload.
2. Keep P1 IntegrationServiceProvider as the single registration entry point; it selects the reviewed Store, reference, typed audit/outbox and optional handler bindings before registering P2. Do not register P2 directly a second time. P2 preserves these bindings; its HTTP gateway must implement ActorReferences. **No production fake bindings are supplied.** Missing bindings fail closed.
3. Preserve P1's existing conditional includes for `operations.php`, `communications.php` and `reports.php` under `/api/v1`. Each fragment uses P1 CurrentIdentity plus P2 error/enable middleware in the foundation web/session/CSRF group; no browser identity or role is accepted as authority. P2's middleware only formats domain `Problem` errors; auth/419/429/unexpected errors remain P1's global envelope and redacted logs. Shared rate-limit/release policy remains an owner review gate.
4. Inject the authenticated HTTP transport into the adapter factories; coordinate the small facade/config/form integration PR. Do not enable backend mode for incomplete modules. Existing public demo and backend release coverage must be separate.
5. Preserve P1's new explicit static artifact staging when composing the eventual merge result; its artifact/module-graph tests pass on the pinned composition. Main's older whole-root upload must not deploy backend sources. P2 has not edited P1's CI/foundation files. Update P1's snapshot owner pins and P2 allowlist only after this P2 revision is published/reviewed.

DBA supplies schema/models/casts/indexes, guard helpers, factories, MySQL integrity tests and the single dispatcher. P2 supplies the relational Store/reference adapter candidate; P1 selects reviewed bindings. Binding the Store without implementing the locking semantics below is not sufficient.

## HTTP transport and facade mapping

All paths below are relative to `/api/v1`. JSON success is `{ "data": ... }`. Lists return `{ "data": [...], "meta": { "complete": true, "total": N } }`. These MVP lists contain the entire **authorized scope**, not a first page disguised as all records. The adapter rejects incomplete lists. Before larger deployments, replace complete-snapshot reads with tested aggregates/explicit pagination and DBA query-plan evidence; current services prioritize the existing snapshot consumer over query optimization.

Errors are `{code,message,fields,request_id}`; AUTH401, FORBIDDEN403, NOT_FOUND404, CONFLICT/CAPACITY/INVALID_STATE409, VALIDATION422. P1 owns 419/429/503 and generic500 rendering. Never return raw exception messages, SQL or provider responses. JSON mutation bodies must be objects, numeric IDs/revisions must be whole numbers, and unknown/protected body fields are rejected.

`request(path, {method, body, headers, signal})` is the injected **P1-owned** function. It prefixes the API root, sends cookies/CSRF, JSON-encodes `body`, parses the envelope and throws normalized errors. It must not return an already-unwrapped DTO or a `Response`. P2 adapters never call `fetch` directly and never fall back to localStorage after failure.

| Existing facade / prepared adapter | Route | Additional integration contract |
| --- | --- | --- |
| `alerts.list(options)` | GET `/alerts` or `/nearby-alerts` when `nearby:true` | q, status, alert_type, resident_id (private list only), sort:newest/oldest. Resident can only request own private records; staff only assigned; Captain/Secretary same barangay. |
| `alerts.get(id)`, `addDetails(id,patch)` | GET/PATCH `/alerts/{id}` | Own resident details only; lifecycle/assignment fields immutable. See photo gate below. |
| `alerts.create(input,intent)` | POST `/alerts` | Mandatory `intent.idempotencyKey`; persisted SOS has no automatic assignments. One active SOS per resident. |
| `assignmentOptions(id,role)` | GET `/alerts/{id}/assignment-options?role=...` | Numeric current assignment ID, `alert_revision`, eligible personnel, workload/limit, selected/at-capacity flags, current workflow flags. Inactive personnel excluded. |
| `acknowledge(id,input)`, `assign(id,input)` | POST `/alerts/{id}/acknowledgments`, `/assignments` | Explicit personnel_id, role, expected_revision; acknowledgment defaults responder. No automatic choice. |
| `reassign(id,input)`, `cancelAssignment(id,input)` | POST `/assignments/{assignmentID}/transfers`, `/cancellations` | Captain only. Adapter resolves the active assignment, verifies the **observed** revision, never silently refreshes it. Reason required. |
| `logResponse(id,input,intent)`, `logRescue(...)` | POST `/alerts/{id}/responses`, `/rescues` | Mandatory stable command key; explicit assessment/destination and own active role assignment. |
| `resolve(id,{expected_revision})` | POST `/alerts/{id}/resolution` | Explicit official action; completion alone never resolves the incident. |
| `dashboard.officialStats()` | GET `/dashboard` | Role-scoped counts; administrative counters are null for operational roles. Resident projection contains own alerts, sanitized nearby and latest announcement. |
| `map.get(filters)` | GET `/map` | Assigned/scoped incidents for officials, sanitized nearby for residents, visible safe facilities and own household only. |
| `announcements.list/get/create/update/archive/retract` | GET/POST `/announcements`, GET/PATCH `/{id}`, POST `/{id}/archive` or `/retract` | Create requires command key; updates require observed revision. Title200/content5000; future explicit-offset expiry; retraction reason1–500. Archived may be retracted; only Active may be edited. |
| `announcements.expireOverdue()` | POST `/announcements/expire-overdue` | Same-barangay Captain/Secretary only, retry-safe recorded expiry. Public visibility checks expiry immediately even before this operation. Scheduler registration remains P1/DBA integration. |
| `feedback.list/get/create` | GET/POST `/feedback`, GET `/{id}` | Create(type,input,intent) needs command key. Own resident history or same-barangay administrators; optional location. Full rating/comment retained. |
| `assignTanod(id,tanodID,{expected_revision})`, `resolve(id,{expected_revision})` | POST `/feedback/{id}/assignment`, `/resolution` | Existing local Tanod membership, Pending->Assigned->Resolved. No General Feedback operational status/review/archive. |
| `notifications.list/get/markRead/markUnread/dismiss` | GET `/notifications`, GET/PATCH/DELETE `/{id}` | Recipient + scope + current source authorization. PATCH `{is_read:boolean}`. Safe links reconstructed from references. |
| `markAllRead()`, `clearRead(observed)` | POST `/notifications/mark-all-read`, `/clear-read` | Clear-read removes only accessible read records. Optional observed recipient_id/expected_role must match session; never selects another recipient. |
| `reports.snapshot()` | GET `/reports/snapshot` | Captain only, complete scoped joined snapshot for current report model. |
| `summary(month)`, `activity(filters)`, `performance(month,role)` | GET `/reports/summary`, `/activity`, `/performance` | Month YYYY-MM; Asia/Manila start-inclusive/end-exclusive. Actual source evidence, no invented baseline. |
| `incidents`, `incident(id)`, `exportPath(id)` | GET `/reports/incidents`, `/{id}`, `/{id}/export` | Captain scope; CSV safely quotes/formula-neutralizes cells. P1 handles same-origin authenticated download; native print stays in frontend. |
| barangays/me/people/facilities/verification/personnel/auth/profile/recovery | **P1-owned routes** | P2 consumes their safe reference DTOs; no duplicate APIs. |
| subscribe/server time/current-user hydration | **P1 integration** | Replace demo storage events with authenticated polling; stop on teardown/logout/revocation; preserve dirty forms and focus. |

The stable command key is created once per submit intent, retained for retries and replaced only for a new intentional command. P2 deliberately does not generate a new key per HTTP retry. Existing form calls for SOS/response/rescue/publish/feedback need P1's coordinated key handoff. Existing resolve/feedback calls also need the revision observed when the dialog opened. The adapter refuses missing revisions instead of overwriting newer work.

### Example command and DTO

```http
POST /api/v1/alerts/1042/acknowledgments
Content-Type: application/json

{"role":"responder","personnel_id":4,"expected_revision":0}
```

The result is a joined alert with numeric IDs, `status:"Acknowledged"`, `assignment_revision:1`, assigned people, `active_responder_assignment:true`, response/rescue arrays, administrative assignment history and five timeline stages `{status,at,current}`. Unreached stages retain `at:null`. `victim_count:null` means unknown; zero remains zero. Map pins remain image percentages0–100, never latitude/longitude. Log timestamps and actor names are preserved without reconstructing unknown history. `facility_snapshot` is immutable and projected as `facility` after deactivation.

Nearby DTO is limited to `id,barangay_id,alert_type,status,created_at,location_label,description,map_x,map_y`. Location is the barangay name; pins round to10% increments, unknown remains null; free text is replaced with a type/area description. Search only examines sanitized fields. No resident/household IDs, reporter names/contact, exact pins, private comments or photos.

Snapshot keys: `alerts,verifications,feedback,announcements,facilities,users,personnel,activity_logs,barangays,at,barangay_id`. Alerts are joined, not raw incident rows. `activity_logs` includes current consumer aliases `at,entity,record_id,title,actor_name`, plus recorded actor role. ReferenceData must return the existing public-user flags and personnel/report DTOs, never credential, session, password-reset or private-document attributes.

## Store and reference contracts for DBA/P1

Logical row fields below define the module boundary, **not approved migrations**. DBA may use different physical names through an adapter. All IDs returned to services are integers, booleans are booleans, JSON columns are arrays, nullable values stay null. Money/provider data is absent. Timestamps serialize as explicit-offset ISO8601, canonical UTC for sortable source dates; never feed naive MySQL date strings to the domain. `Store.select` applies equality predicates in SQL and returns deterministic ascending ID order (latest-log semantics depend on it). Soft-deleted rows must not disappear from authorized historical projections.

| Logical table | Required fields beyond numeric id |
| --- | --- |
| emergency_alerts | barangay_id, resident_id, household_id, alert_type, description, location_label, victim_count(nullable), map_x/y(nullable paired), status, assignment_revision, assigned_responder_id/rescuer_id(derived read projections only), acknowledged_by(nullable), created_at, acknowledged_at/resolved_at(nullable) |
| alert_assignments | barangay_id, alert_id, role, user_id, personnel_name(snapshot), assigned_by/at, status(active/completed/cancelled/reassigned/closed), ended_at/by/end_reason(nullable), override_by/reason/at(nullable) |
| incident_status_history | barangay_id, alert_id, status, actor_id/role, occurred_at |
| alert_responses | barangay_id, alert_id, assignment_id, responder_id, response_type, response_status(Responding/Completed), rescue_required(boolean), notes, responded_at |
| rescues | barangay_id, alert_id, assignment_id, rescuer_id, facility_id, facility_snapshot(JSON), rescue_status(In progress/Completed), notes, rescued_at |
| announcements | barangay_id, posted_by, title, content, status, revision, created_at/published_at/updated_at, expires_at(nullable), archived_at/by(nullable), retracted_at/by/retraction_reason(nullable) |
| announcement_history | barangay_id, announcement_id, action, by(nullable for expiry), at, title/content/expires_at snapshot, reason |
| community_feedback | barangay_id, resident_id, type(complaint/suggestion/general), title, created_at/submitted_at, category, description, location, rating(nullable1–5), comment, status(nullable for general), assigned_tanod_id, assigned_at/resolved_at(nullable), revision |
| activity_logs | barangay_id, actor_id, actor_role, resource_type/id, action, summary(JSON allowlisted), created_at, evidence |
| idempotency_requests | actor_id, route, request_key, request_hash(SHA256), resource_id |
| outbox_events | event_id(canonical UUIDv4), version2, type, barangay_id, resource_type/id, payload(bounded source context), occurred_at, template_key; separate outbox_recipients per DBA registry |
| notifications | event_id, user_id, barangay_id, channel(in_app), resource_type/id, audience(resident/official), kind, title, description, link, event_status(nullable), created_at, read_at/dismissed_at(nullable) |

Required integrity/index requests: tenant/resource indexes on all scoped reads; `(user_id,role,status)` assignments; **unique active `(alert_id,role)`** (MySQL generated nullable active-role key or equivalent approved design); one active unresolved SOS per resident via shared guard + DBA-approved uniqueness; unique idempotency `(actor_id,route,key_digest)` with keyed digest, not raw command key; unique event_id; unique notification `(event_id,user_id,channel)`. Template key/version follow the explicitly registered DBA event definition; DBA delivery receipts use `(event_id,recipient,channel,template_version)` for transport independently. Index source dates/actor IDs and review report query plans with realistic scopes before release.

`ActorReferences.current(Request)` and `locked(observed)` preserve P1 request identity/security generation. `actorFor` is a trusted internal recipient/test lookup, never browser identity authority. Current locking user/appointment reads are used for mutation eligibility. P1 must review the candidate safe-source projections before production binding. Independent resident membership remains P1's responsibility. `person/people` are safe public role/status/name DTOs; `household` is the registered resident's safe address/pin projection; `approved` checks latest valid residency; `facilities` is the active/inactive visible referral directory, including shared read-only facilities; `verifications/personnel` are the existing Captain-report projections. P1 owns private contact/document authorization. No raw ORM arrays.

### Transaction and lock protocol — release gate

`Store.transaction(keys, closure)` must use the **same MySQL connection/transaction** as ReferenceData, audit and outbox writes, acquire each supplied guard in order before executing the closure, retain locks through commit, and join nested transactions without committing them independently. Store must whitelist logical tables and bind query values. Unknown tables/fields are a programming error. P2's MemoryStore is tests only.

Global order: P1 staffing/capacity guard (when changing positions), unique per-person guards sorted numerically, incident guard/current assignment rows, then facility row. Keys emitted here: `person:{id}`, `incident:{id}`, `facility:{id}`, `announcement:{id}`, `feedback:{id}`, `outbox:{eventID}`. The DBA must implement durable lockable guard rows or an agreed equivalent; do not silently ignore a key. Per-person guards are essential for capacity across different incidents. P1's role changes must contend on the same guards; facility deactivation must lock the same facility row as rescue logging.

Use current/locking reads inside mutations (`SELECT ... FOR UPDATE` as appropriate), not stale REPEATABLE READ snapshots established before waiting for another guard. All row updates, assignments, revisions, histories, audit and outbox/idempotency receipts roll back together. A transfer ends the old active row before inserting its replacement; failed insertion restores the old assignment through rollback. Whole internal transactions may retry deadlocks; external sends must never be retried by the domain transaction.

Normal incident capacity: Responder2/Rescuer1. Override remains **disabled** by the provider. If the team later enables it, only Captain explicit confirmation+reason can override capacity; tenant, active status and role eligibility remain mandatory. Responder Completed releases its slot; no-rescue resolution requires completed response with explicit false and no active rescuer. Rescue-required branch requires manual rescuer selection. Rescue Completed releases its slot while incident remains Rescue in progress until official resolution. Assignment pointers retain historical identity; workload uses active assignment history only.

## Committed-event contract for DBA

Production implementations are Persistence/TypedAuditRecorder and Persistence/TypedOutboxWriter, implementing P1 Contracts/Events interfaces. The domain wrappers preserve portable tests while delegating production writes through typed resources, audit summaries, UUIDv4 EventId, RecipientReference, DateTimeImmutable and EventContext. They join the same caller transaction and never independently commit or send HTTP.

P2 maps its seven internal incident/announcement/feedback event names explicitly to the registered .v2 types. Incident status and feedback kind/status freeze at write time. Relational recipients are in-app-only. Deduplicated fanouts over1000 are chunked into distinct UUIDs within the same transaction. No32hex conversion or implicit SMS occurs.

Canonical event-context fixtures (resource ID and recipients always come from the authorized transaction, never these documentation examples):

| Persisted type | Exact example payload |
| --- | --- |
| incident.created.v2 | `{ "status": "Pending" }` |
| incident.assigned.v2 | `{ "status": "Acknowledged" }` |
| incident.status_changed.v2 | `{ "status": "Responding" }` |
| incident.rescue_required.v2 | `{ "status": "Responding" }` |
| announcement.published.v2 | `{}` |
| feedback.submitted.v2 | `{ "kind": "general", "status": null }` |
| feedback.updated.v2 | `{ "kind": "complaint", "status": "Assigned" }` |

The typed boundary is `EventContext::forEvent($type, $payload)`, read with `payloadFor($type)`. `RecipientReference($id, true, false, 'official')->toArray($derivedAudience)` rejects audience changes. The writer stores relational recipients and never puts contact details, private comments, arbitrary text or files in the outbox payload. Actual SQL/HTTP fixtures are committed in `backend/tests/P2/sql-cases.php`, `http-cases.php` and `sql-review.php`; DBA's full v2 fixture registry is retained unchanged in the composed owner tests.

DBA's one dispatcher calls Persistence/InAppHandler.handle(OutboxEvent,OutboxRecipient) in its receipt transaction. It reauthorizes recipient/source, preserves event-time status and UUIDs, reconstructs category-specific safe links, and deduplicates. An unavailable source/recipient is not falsely completed. Unsupported P1 verification/personnel/facility/security events remain unavailable pending owner projections/context/templates.

See [current mappings, executable fixtures and precise owner requests](P2-COMPATIBILITY.md). The portable CreateInAppNotification array handler is not the production binding. P1 owns registration and DBA owns receipts/dispatch/Semaphore/Make; P2 creates no parallel transport.

## Explicit remaining gates and reproduction

The current [compatibility/evidence document](P2-COMPATIBILITY.md) is authoritative: P1 safe-reference ratification, original facade/form key/revision and reader registration, private photo bytes, P1-domain event consumers, actual cross-owner mutation races, full browser/scale/release acceptance. SQL fixtures and HTTP harnesses do not replace those tests. Production stays disabled; demo and native print remain intact.

From the P2 checkout, portable checks remain:

    php backend/tests/P2/run.php
    node --test tests/p2-adapters.mjs
    node scripts/run-tests.mjs
    node scripts/check.mjs

The current matrix additionally gives composed real SQL/HTTP/race, actual P1 transport, artifact and combined owner-suite commands. Preserve all owner tests and source hashes. No live SMS/mail, shared database, deployment or main merge is part of this slice.
