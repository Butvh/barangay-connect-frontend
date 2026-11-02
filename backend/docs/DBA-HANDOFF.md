# DBA schema and delivery handoff — proposed contract v1

Owner: DBA + SMS/automation engineer. Base: main `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. Schedule: November 2–6, 2026, Asia/Manila. This branch implements only the DBA assignment. P1/P2 have not yet supplied a scaffold or agreed interfaces; the contracts here are proposals for review, not evidence of team agreement.

## Integration order and boundaries

1. P1 supplies the Laravel scaffold and replaces Pages `path: .` with an allowlisted root HTML/assets artifact. **Do not merge this backend branch into main while the old full-checkout Pages upload remains.** P1 also reviews PHP/framework pairing and host support. This branch does not edit their workflow, bootstrap, root Composer files or frontend.
2. Review schema and writer/handler contracts with both programmers. Replace Laravel's generated users/cache/jobs migrations with these ordered DBA migrations before the first shared migration; do not run duplicate table generators. No shared/applied migration may be rewritten; subsequent changes are additive migrations.
3. Apply the six migrations in timestamp order. `000100` identity/staffing; `000200` verification/documents/facilities; `000300` incidents; `000400` civic/recovery/audit; `000500` delivery; `000600` framework tables. The circular verification submission FK is added only after both tables exist. The reverse removes it first.
4. P1/P2 build their policies/services against the models and lock contract below. P2 supplies the outbox/audit writers and in-app handler. P1 registers integration routes, handler binding, scheduler and workers as a small reviewed foundation change. No registration is silently added here.
5. Run the integrated domain tests and this genuine-MySQL suite together. Publish a reviewed PR only after the combined revision is green. Draft review of this proposal is useful before integration; no merge or deployment is authorized by this handoff.

The isolated verification harness tested PHP 8.5.12, Laravel 13.39.0 and MySQL Community 8.4.13 (`SELECT VERSION()`). XAMPP's installed server identifies as MariaDB 10.11.16 and was not used. Host/runtime agreement remains pending. See [Laravel's support policy](https://laravel.com/framework/docs/13.x/releases). The application dependency manifest/lock remains P1-owned; `tests/ci/composer.*` pins only the independent test harness.

## Schema-to-frontend DTO mapping

All IDs are unsigned bigint internally and numeric JSON identifiers within JavaScript's safe integer range. All dates persist UTC; API dates carry an explicit offset. Models are storage records, never automatically public DTOs. Guarded model properties require explicit allowlisted writes or trusted `forceFill` after service authorization. Independent membership is retained.

| Existing UI field/record | Persistence and owner adaptation |
| --- | --- |
| users.is_resident/is_captain | independent booleans on users; P1 derives effective role using Active appointment then resident fallback and account policy |
| is_tanod | presence of retained tanod_memberships; appointments never remove the membership |
| is_secretary/is_responder/is_rescuer, personnel_status | personnel_appointments.role/status; one current row per user, retained history; **not** extra role booleans |
| personnel_records.id/user_id, appointed_at/source/requirements/history | current appointment joins user, maps effective_date to appointed_at and child document metadata/history; null source/history stays unknown |
| household address/map_x/map_y | households with paired 0–100 image coordinates; `(0,0)` valid; neither lat/long nor public household pins |
| verify_residency.user_id, submitted_at, submission_revision | verifications.resident_id + current_submission.submitted_at/revision; application's optimistic revision is separate |
| reviewed_by, resubmission_reason | reviewer_id, correction_reason; corrections append to the same application; reapplication creates a new one after Rejected/Expired |
| valid_id/proof, personnel requirements | scoped documents with one relational owner, private disk/key, detected MIME/bytes; P1 maps authorized safe metadata/downloads; no public storage links |
| alert.created_at | emergency_alerts.reported_at for incident event time, separate created_at processing time |
| alert.resident/household, assigned pointers/flags | P2's authorized projection joins scoped records; derive latest assignment projections from history, count only status=active; no duplicated writable pointer columns |
| responses.assignment_id/rescue_required | explicit composite assignment/incident/actor FK; new boolean/time mandatory; legacy nullable boolean requires provenance |
| rescues.facility | immutable destination_snapshot with relational facility_id; historical snapshots retained on facility changes |
| facility.barangay_id, managed_by_barangay_id, status | visibility=shared maps display barangay_id=null; manager remains required; active maps Active/Inactive; map_scope is optional artwork reference, unknown artwork remains unavailable |
| announcement.posted_by | author_id and author_role; status Active/Archived/Retracted; expiry remains a deadline, not a new stored workflow |
| feedback.type | community_feedback.kind; general has rating/comment and no operational status; complaint/suggestion use Pending/Assigned/Resolved |
| notification.user_id/link/text/is_read | notifications.recipient_id/target/title + description/read_at; P2 owns presentation, current recipient authorization and read/dismiss endpoints |
| activity.actor_role/entity/record_id/at | role_at_action/resource_type/resource_id/occurred_at; recorded_at is processing time; no invented history |
| password recovery stages | opaque UUID challenge + keyed digests, null user for dummy challenge, bounded attempts/expiry/resend, consumed timestamp; P1 owns the protocol and atomic password/session change |

No Victim entity or dashboard/chart tables are introduced. Enum labels follow the existing contracts. See [data dictionary](data-dictionary.md) for actual column types, generated keys, FK/delete rules and indexes.

Every operational FK uses RESTRICT, preserving history. Composite keys reject cross-scope households, appointments, submissions, assignments and event recipients. Actor authority, assignment role correctness, actual facility visibility/active status, immutable Tanod management, document count and workflow legality remain service-policy checks. Generic resource IDs in audit/outbox are intentionally polymorphic references, not universal foreign keys. Do not claim they guarantee referential integrity.

Application model hooks reject modifications to immutable history/submissions/document metadata; query-builder/database privileges can bypass hooks. Production grants should deny UPDATE/DELETE of append-only tables to the runtime user while allowing INSERT/SELECT. Migration credentials remain private and separate. Retention corrections require an authorized administrative procedure; no ordinary delete API is implied.

## Shared transaction and lock contract

Within one transaction, staffing writes first call `CapacityGuard::lockScope('barangay', $barangayId, 'staffing')`, then `CapacityGuard::lockPeople($affectedUserIds)` (ascending numeric IDs). Dispatch, transfer, completion, resolution and old-role removal all use that same **operations** person guard; transfer locks both people. Only then lock incident rows ascending by ID, then assignment rows ascending by ID. Destination use takes the facility row after person/incident locks; deactivation locks that same facility row and must not subsequently acquire person/incident guards.

Verification review/resubmit lock the person with `kind='verification'` then application/current submission. SOS creation uses `kind='sos'` then current incident/idempotency rows. Recovery locks its challenge plus user inside the same password-update/consume transaction; P1 must finalize session-revocation ordering. Avoid acquiring one kind and later another in reverse order. Upsert plus the unique guard key handles simultaneous first creation before `FOR UPDATE`.

Under the locks, re-read authoritative role/status/tenant, capacity and expected revision. Current staffing counts occupied appointments including Inactive: Secretary 3, Responder 6, Rescuer 6. Concurrent active incident responsibilities: Responder 2, Rescuer 1. No capacity trigger is hidden in the schema. Captain override metadata is preserved but enabling an exception remains pending explicit team ratification; no domain service here enables it. Only P1/P2 own the policy decisions and revision errors.

Generated nullable unique keys enforce one active incident per resident, one active assignment per incident/role and one current Pending/correction/Approved verification per resident. Approved is final. History rows coexist because generated keys are null when no longer current. The per-person guard serializes capacity across different incidents; incident uniqueness alone cannot do so.

P1/P2 must atomically persist state/history plus `AuditRecorder.record(actor, roleAtAction, scope, resource, action, summary)` and `OutboxWriter.record(eventId, type, scope, resourceId, recipientRefs, occurredAt)`. These writers remain P2-owned. Audit summary <=4 KiB, event payload <=2 KiB. Unknown historic actors/times stay null. Neither writer calls HTTP. Deadlock retries must wrap only the database transaction, never a provider call.

## Event/recipient contract v1

P2's writer inserts outbox_events and outbox_recipients in the caller's transaction. Proposed v1 accepts two initial SMS event types; other domain event types must be agreed/allowlisted before dispatch, rather than silently treated as either of these:

| type | resource_type | template_key | route |
| --- | --- | --- | --- |
| alert.created.v1 | alert | alert-review.v1 | sms-urgent worker -> Semaphore directly |
| announcement.published.v1 | announcement | announcement-review.v1 | Make authenticated webhook -> idempotent Laravel command -> sms-default worker |

Outbox fields: UUID `event_id` globally unique, `version=1`, type, numeric barangay_id/resource_id, resource_type, UTC occurred_at, `payload={}` (empty only), template_key. P2 assigns one authorized recipient row per user, with same barangay_id and explicit in_app/sms booleans. The writer's recipientRefs DTO is proposed as `[{user_id: number, in_app: boolean, sms: boolean}]`. Derive scope/recipient eligibility on the server; do not accept browser-selected recipients. Reject reuse of event_id with different semantic data. Initial SMS text is server-controlled and generic, containing only the alert/announcement reference. No address, reporter name, victim details, precise pin or file data leaves Laravel.

The dispatcher consumes only committed records on a worker connection, claims with SKIP LOCKED, leases with fencing tokens and persists separate logical receipts keyed by event/recipient/channel/template. It recovers expired outbox leases. P2 implements `InAppNotificationHandler::handle(OutboxEvent, OutboxRecipient): void` using its `CreateInAppNotification` handler and binds the interface. That handler participates in the receipt transaction, writes no external HTTP and deduplicates notifications by event_id/recipient_id. An SMS retry cannot repeat a completed in-app channel, and a failed in-app handler does not discard durable SMS intent.

The scheduled delivery scan closes the crash gap between committing a ledger row and enqueuing its job. SMS POST intent/attempt is committed before HTTP. An expired sending lease becomes uncertain, including a crash before the call: conservative manual review is safer than a possible duplicate charge. Provider acceptance updates provider ID/status; network Sent completes the receipt, not handset delivery. Unknown-ID timeouts stay on hold. Database deduplication provides logical at-most-once intent, not exactly-once provider effects.

## P1 registration change to review

Bind `App\Services\Messaging\InAppNotificationHandler` to P2's adapter. Load `routes/integrations.php` in the stateless `/api/v1` group. Keep its bearer-authenticated command separate from browser cookie-session CSRF flows; no broad CSRF exemption. Add a scheduled `DispatchOutbox` job on `messaging-control` every minute. After domain commit, optionally enqueue that job for lower urgent latency; periodic scanning remains recovery. Use a database queue with `retry_after > 90` (e.g. 180 seconds), worker timeouts below retry_after, and dedicated workers from the runbook. Config/messaging.php is loaded by Laravel's normal configuration discovery.

P1 owns common HTTP errors/session/CORS, bootstrap, shared queue config and scheduler registration. P2 owns domain triggers, eligible recipients, CreateInAppNotification and the audit/outbox writers. This branch implements none of their controllers, policies, adapters or report queries. Pending integration tests must prove those owners use this contract.

## Verification and release limits

See [test instructions](../tests/ci/README.md), [messaging/Make runbook](MESSAGING-RUNBOOK.md) and [acceptance evidence](ACCEPTANCE.md). Keep fake-provider tests separate from real configuration and real recipient evidence. Neither an approved sender, live Make scenario, hosting configuration nor a real SMS is claimed. Do not enable SMS until the owner supplies specific recipient and segment-budget authorization.
