# DBA schema and delivery handoff

**Current November5 candidate review:** [9bc1a04/f4e8df9/22365ad privacy and presentation handoff](CURRENT-CANDIDATE-PRIVACY-READINESS-2026-11-05.md). Reviewed Linux CI41883691022 passes384 tests/2108 assertions but is **overall RED** at the required photo opening-session browser gate; resident gallery is absent. Independent DBA target120 tests/709 assertions passes with one Windows symlink skip; actual local producer/fake-worker modes and replay pass. P1 facility history/UTC and P2 actual producers are implemented. Final corrected-pin photo/browser/Linux acceptance and host operations remain pending; real external delivery is untested. Normal optional/SMS/Make/dispatch flags stay off.

Historical evidence below retains its original pins and failures; earlier totals and missing-dependency statements do not describe the current candidate.

**Final November5 evidence:** [One current history/photo/consent/producer/worker combination](JOINT-CURRENT-ACCEPTANCE-2026-11-05.md) passes383/2104 with1 explicit Windows skip, current48 SQL+2 HTTP and actual source fake acceptance. P1 UTC/full-history and P2 real producer dependencies are implemented; older absent-dependency statements/totals below are historical at their pins. Current Linux/original-browser/external-host certification remains separate.





**Current November4 worker update:** [Actual P1 consent + current worker evidence](CURRENT-SMS-WORKER.md) supersedes older missing-authority/worker statements below. Consent persistence and current worker integration are implemented; actual positive P2 producer acceptance and P1 shared UTC configuration remain dependencies. Older totals are retained only at their stated pins.

**Current worker update:** actual P1 CurrentSmsConsent is published at c087eb7/2e8161e; [DBA current reservation/retry/final pre-send integration](CURRENT-SMS-WORKER.md) adds an eleventh append-only evidence migration, leaving the prior ten unchanged. Targeted37/234 passes; full owner/actual P2 producer acceptance is being measured separately. Older missing-authority statements are historical at their stated pins. All normal delivery flags remain off.

**Current November4 update:** photo metadata remains active and ratified [SMS consent persistence](SMS-CONSENT-PROPOSAL.md) adds the tenth migration/40th table; all nine preceding migrations remain unchanged. P2 ratification is complete. P1 actual byte/current-authority implementation and subsequent worker/producer acceptance remain runtime dependencies. Earlier absent/pending-contract statements below are historical at their stated pins. No byte route or SMS producer is enabled by DBA persistence.

P12e70538 subsequently publishes actual private bytes, now tested against this schema; final P2 public caller integration stays gated. [Current consent/photo evidence](CONSENT-PERSISTENCE-ACCEPTANCE.md) separates231/1024/zero-skip baseline from251/1133/one-Windows-symlink-skip newer run. P1 current consent authority and subsequent DBA worker/P2 positive SMS intent still remain unavailable.

Owner: DBA + SMS/automation engineer. Base: main `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0`. Schedule: November2–6,2026, Asia/Manila. **November4:** [P2 acc9f56 lock correction independently accepted](P2-LOCK-ORDER-REVIEW.md); final P1 5447d87 composition passes184 tests/811 assertions,0 errors/failures/skips. Photo migration/model and actual SMS intent await [explicit owner decisions](PHOTO-SMS-CONTRACT-DECISIONS.md). The [photo candidate](INCIDENT-PHOTO-METADATA-PROPOSAL.md) remains outside active migrations; [delivery fakes](DELIVERY-FAKE-ACCEPTANCE.md) and real in-app probe pass. [Current evidence](INTEGRATION-ACCEPTANCE.md) separates old failures from current results. No production enablement or joint release approval is implied.

## Integration order and boundaries

1. P1 supplies the Laravel scaffold and replaces Pages `path: .` with an allowlisted root HTML/assets artifact. **Do not merge this backend branch into main while the old full-checkout Pages upload remains.** P1 also reviews PHP/framework pairing and host support. This branch does not edit their workflow, bootstrap, root Composer files or frontend.
2. Review schema and writer/handler contracts with both programmers. Replace Laravel's generated users/cache/jobs migrations with these ordered DBA migrations before the first shared migration; do not run duplicate table generators. No shared/applied migration may be rewritten; subsequent changes are additive migrations.
3. Apply the original six migrations in timestamp order, followed by November 3's additive `000100_add_user_auth_version` and `000200_add_versioned_delivery_contract`. Original slices are unchanged: identity/staffing, verification/documents/facilities, incidents, civic/recovery/audit, delivery and framework tables. The circular verification submission FK is added only after both tables exist; rollback removes it first. V2 downgrade refuses to discard v2 events; security downgrade is destructive and disposable-only.
4. P2 supplies actual SQL/reference/typed writers/notification adapter and its current lock correction is independently accepted. P1 supplies conditional registration, suite discovery and reviewed common-base snapshot overlays; it must pin this DBA update. Default production flags stay off. No teammate source is edited by DBA. Photo metadata remains outside migrations until both owners ratify; P1 owns private bytes/downloads and P2 exact incident authorization. Explicit SMS intent/eligibility fixtures remain P1/P2 work.
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

## Legacy event/recipient contract v1

The following documents the original two-type v1 proposal for existing fixtures/rows. New integrations must review the explicit v2 contract linked above, which separates in-app-only families, event-time snapshots and channel templates. No prototype data is automatically converted. P2's writer inserts outbox_events and outbox_recipients in the caller's transaction:

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
