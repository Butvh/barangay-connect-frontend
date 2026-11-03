# P2 compatibility candidate and integration evidence — November 3, 2026

Spec: assigned P2 follow-up prompt and shared backend plan. P2 changes only its owned modules/adapters/tests. No main/teammate PR merge, shared migration, deployment, SMS or Make activation occurs.

## Exact composition and release state

- P1 #49: c0a32cfaf4b26b86d57681cd1ed6aa42d6c87bb1.
- DBA #48: 3d2b3a2dd6afa88ea34b9a441f48da3863787bbd.
- P2 #50 base: c902d9f7239a8fcefdddf293fbc531876548c10a, plus this patch. The published commit identifies the patch; uncommitted evidence is not a shared dependency.
- Main remains3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0; #50 remains stacked on planning PR #47. Recheck all heads before reproducing.

P1/DBA now provide actual framework, security generation and v2 storage. Earlier requests for missing auth_version/cast, root Testbench and the expanded registry are superseded. Their addition is tested in the disposable composition, not a claim that owners have approved every P2 adapter.

The original frontend demo is unchanged. P1 production identity/P2/dispatch flags and global factory registration remain off/unset. This is a **reviewable integration candidate**, not completion of P1 feature persistence, an original-browser backend release or production readiness.

## Compatibility matrix

| Boundary | Canonical owner interface/storage | P2 implementation / acceptance |
| --- | --- | --- |
| Request identity | P1 IdentityReferences.current(Request), locked(observed), private generation | ActorReferences retains captured identity. HTTP refuses a legacy gateway without it. Real login/CSRF and mid-request generation rejection tested. |
| Safe source references | P1 SourceReferences + captured EffectiveIdentity; IncidentReferenceAuthorization | ScopedReferences binds a clone to the original actor. Household/approval/facilities/personnel/verifications/barangay delegate to P1's reviewed projections. P2 IncidentReferencePolicy requires the latest authorized role assignment and denies a transferred responder. people is admin-only; minimal participant names require accessible incident/feedback/announcement provenance. Internal eligible official event selection is separate from the browser directory. |
| Destination | P1 SourceReferences.facility(observed,id,true), after ordered guards | DestinationReferences delegates to P1's current selected-facility read, avoiding an old RR snapshot. Full P1 deactivation workflow race is separate. |
| Persistence | DBA Eloquent models and physical FKs/casts | RelationalStore maps fields explicitly; unknown writes fail. No writable assignment pointer columns. Pointers derive from history; history snapshots and UTC instants are preserved. |
| Locks | DBA operations-person/SOS guards; current users/appointments, incident/assignment, destination | Caller connection/transaction retained; nested work joins. Appointment and history-sequence reads are current. Independent-process domain races execute actual P2 services. |
| Audit | P1 typed nullable actor/role, ResourceReference, bounded AuditSummary; DBA activity_logs | Persistence/TypedAuditRecorder implements interface, validates actor/scope and writes structured evidence. Reports reconstruct display text; no independent commit or HTTP. |
| Event identity/time | P1 UUIDv4 EventId, DateTimeImmutable | Canonical UUIDv4 generated directly; no32hex conversion. Projections preserve UUID strings; dates normalize to UTC before SQL writes. |
| Event storage | P1 EventContext.forEvent(type,payload).payloadFor(type); DBA v2 registry | Persistence/TypedOutboxWriter supports seven P2 v2 families. Logical names map explicitly to .v2. Incident status and exact feedback kind/status freeze in the source transaction. Family/context mismatches fail closed. |
| Fanout/channels | P1 RecipientReference.toArray(derivedAudience); DBA <=1000 recipients per event | Audience hints must match server-derived audience. Deduplicate/chunk larger audiences into distinct UUIDs in the same transaction. In-app-only; malformed explicit refs and implicit SMS rejected. |
| Receipt handler | DBA handle(OutboxEvent,OutboxRecipient):void | Persistence/InAppHandler joins the dispatcher's receipt transaction. Persisted scoped recipient/source is reauthorized, UUID/person deduplicated, unavailable source never falsely completed. |
| Browser API | P1 web/session/CSRF/current.identity and global errors | Actual middleware plus P2 domain errors/enable gate; no Sanctum or alternate auth. |
| Transport/readers | P1 envelope bridge/createP2DomainFactories | Three existing P2 factories compose through bridge. p2-domains.js exports only scoped cancellation-aware revision readers, not another transport. |
| Registration | P1 selects compatible implementation bindings | P2 provider requires/preserves them, installs no fake/default handler. Explicit test bindings live only in tests/P2/bindings.php. Interface version1 differs from envelope version2. |

P2 producers: incident.created.v2, incident.assigned.v2, incident.status_changed.v2, incident.rescue_required.v2, announcement.published.v2, feedback.submitted.v2, feedback.updated.v2. P1 verification/personnel/facility/security families remain unavailable here until authorized source projections/context/templates are reviewed.

## Executable evidence

Environment: PHP8.5.12, P1 locked Laravel13.39.0/Testbench11.3.0 runtime, MySQL Community8.4.13/InnoDB, Node24.15.0. Dedicated loopback server and fresh disposable databases; no XAMPP/shared data migrated; external transports fake/disabled.

- Portable runner retains original47 checks and adds advancing-clock regression:48 checks. Original8 adapter checks retained;3 additional foundation adapter/readers checks.
- SQL cases are in tests/P2/sql-cases.php, http-cases.php, sql-races.php and sql-review.php. They use actual models/guards/services/transactions, not MemoryStore.
- Real HTTP harness uses P1 login/cookie/CSRF against DBA User: guest401, CSRF419, stable-key durable SOS retry, complete authorized scope/revision, generation revocation. This is **not** an original-UI browser walkthrough.
- SQL manual acknowledgment/transfer/current assessment, both rescue branches, snapshot preservation and explicit resolution pass. Injected writer failure rolls back source/history/audit/outbox/idempotency.
- DBA v2 dispatcher creates real in-app notifications exactly once after source progression, retaining event-time Pending status. SMS/Make intents remain zero.
- Independent processes test same-resident SOS, last responder slot across incidents, same-incident acknowledgment and completion versus dispatch. Two-connection tests cover current appointment/destination/history reads; those are not P1 workflow race proofs.
- Review regressions cover inactive optional recipients, original announcement content, non-Z expiry, >1000-recipient chunks and refusal of legacy HTTP identity gateways. Five further cases cover bound P1 sources, approval, assignment-transfer privacy, audience hints and exact feedback snapshots: **33 SQL/HTTP/race cases** total.
- Unchanged P1/DBA combined Unit/Feature/Database/Integration/Compatibility suites: **152 tests / 704 assertions / zero skips**, on the latest owner heads. Final formatted-composition rerun is recorded in the draft PR.
- DBA's unchanged ConfiguredAdapters + SqlContractProbe executes against the actual selected P2 TypedOutboxWriter/InAppHandler: transaction rollback, dispatch/event time, receipt replay, revocation, cross-scope rejection, malformed version/context/channel/template rejection and typed size/UUID boundaries pass. SMS intent is explicitly **not requested**; provider calls=0. `tests/P2/check-shared.php` only boots/binds and invokes DBA's probe; it does not implement another checker/dispatcher.
- All original **405 frontend assertions**, **47 portable PHP +1 regression**, **8 adapter checks +3 new foundation checks** pass. Current P1 shared-HTTP checks:8 domain-factory checks and16 transport checks. Artifact isolation and staged module graph pass. P1's unchanged live loopback test passes all3 checks with testing env/file sessions and the generated frontend; identity/modules remain disabled in that test. This is transport/public-root evidence, not authenticated original-domain UI acceptance.

## Remaining owner/release gates

1. **P1 binding ratification:** select RelationalStore, Persistence\\ReferenceData, TypedAuditRecorder, TypedOutboxWriter and InAppHandler through existing integration configuration after reviewing this committed candidate. P2 now consumes P1 SourceReferences directly and supplies IncidentReferencePolicy with bindIf. Review the minimal provenance-based participant/internal worker selection; no broad directory authority is granted to residents or operational roles.
2. **P1 registration/forms:** connect factories/readers and stable submit-intent keys/observed revisions through original forms/facade. No stale revision refresh or demo fallback. Original-browser five-role acceptance is not performed while global registration is empty.
3. **P1 private photos:** P1 now supplies Contracts/Photos/IncidentPhotos and StagedIncidentPhoto; its comment explicitly states that the byte-storage implementation/binding awaits DBA metadata and the incident-policy seam. No actual stage/attach/download service exists at the tested pin. P2 continues rejecting filenames/upload IDs as evidence of bytes. Attach integration and private byte/browser tests remain blocked on that concrete implementation.
4. **Cross-owner races:** actual role-change/removal versus transfer and actual facility deactivation versus rescue await P1 mutation services/shared locks. Direct fixture updates prove P2 reads only. Dedicated rescuer last-slot and other unlisted races remain unclaimed.
5. **DBA checker resolved for P2's in-app slice:** the latest owner checker now resolves configured production adapters and uses actual typed SQL/receipt probes. P2's selected production implementations pass that probe in a disposable composition. Default production selection is still unset, so invoking the bare CLI without owner-reviewed bindings truthfully reports unavailable adapters. SMS-intent/provider acceptance is outside this P2 slice.
6. **P1 event consumption:** unsupported source families remain unavailable until projections/templates/context are reviewed. No false receipts or second dispatcher.
7. **Release/scale:** safe Pages artifact on eventual merge result, authenticated original UI/download tests, combined style/CI, realistic query-plan/large-scope review, owner approval and operational worker/scheduler evidence. No production/provider success claimed.

## Reproduction

Use exact committed owner files unchanged, P1's root Composer lock, and all eight DBA migrations in a private composition. P1 owns the snapshot/CI manifest; request updated DBA/P2 pins and the P2 path allowlist. Never overlay into a live checkout.

From composed repo root:

    php backend/tests/P2/run.php
    node --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs
    node tests/domain-transport.mjs
    node tests/backend-transport.mjs
    node scripts/run-tests.mjs
    node scripts/check.mjs
    node tests/frontend-artifact.mjs
    node tests/backend-artifact.mjs
    ./backend/tests/P2/run-sql.ps1 -Php <php-executable> -Mysql <mysql-client> -Port <dedicated-port>

For DBA's production-adapter probe, migrate a NEW dedicated bc_dba_p2_* MySQL database; set APP_ENV=testing, DB_CONNECTION=mysql, matching DB_DATABASE/DB_TEST_DATABASE and DB_TEST_DISPOSABLE=1, then run `php backend/tests/P2/check-shared.php`. It invokes DBA's unchanged SQL gate with real P2 bindings and never enables SMS. For the live transport test, stage `scripts/stage-backend-frontend.mjs` in the disposable composition and set APP_ENV=testing, APP_KEY and SESSION_DRIVER=file before `node tests/backend-live.mjs`.

SQL runner creates fresh p2_test_* databases and refuses populated fixtures. The local test router refuses other prefixes. Evidence is retained. For unchanged P1/DBA tests follow P1's disposable bc_dba_p1_* setup and additive tests/Database, tests/Integration and tests/Compatibility discovery; do not replace either owner's harness. The manifest hashes123 P1 files and107 DBA files as exact Git blobs; P2 source hashes normalize CRLF to LF for reproducible Windows checkouts, after checking the composition bytes match. Initial fixture/connection/env errors were corrected before green runs; no failed gate was suppressed or owner source changed.

Final review minor deferred: ReportService prefers the current directory actor name over the audit-name snapshot. Renaming an official can alter display attribution, while source IDs/roles remain recorded. Not included in this compatibility fix pass.
