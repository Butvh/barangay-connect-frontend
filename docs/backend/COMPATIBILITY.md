# Current integration compatibility — November 3, 2026

[Current P2 production-class review, isolation, commands and handoff](P2-BINDINGS-REVIEW.md) supersedes the old portable-only adapter availability statements. Pins: P1 review c0a32cf, DBA3d2b3a2, P2 production candidate3d23092; exact full values are in integration-lock.json. Final tested P1/synthetic-merge SHAs and measured results are in draft PR49.

| Boundary | Current implementation / status |
| --- | --- |
| PHP vs storage contract | Typed interface version1; persisted event envelope version2. EventId is lowercase UUIDv4; DateTimeImmutable UTC; ResourceReference IDs/types and AuditSummary fields/4096-byte bounds are explicit. Original EventContext(status) and three-argument RecipientReference constructors remain compatible. |
| Bounded contexts | forEvent(type,payload).payloadFor(type) validates exact14 DBA v2 shapes, max256 bytes. No arbitrary message/contact/credential/recipient body. Persisted audience is server-derived; optional server intent hint must agree. New v1 aliases/ID rewrites are not emitted. |
| Identity | Actual DBA User/appointment/membership/auth_version. Original observed generation/role/scope survives current/locked reads. Real lifecycle/revocation/stale-tab tests exist; no missing-generation or scope-fixture blocker remains. |
| P1 references | SourceReferences supplies scoped minimal household/approval/directory/report projections. P2's actual ReferenceData/IncidentReferencePolicy consumes them, with captured actor and selected locked destination. Late participant lock order is still blocking. |
| P2 persistence/writers/handler | The five real implementations are published and selected only by the isolated test profile. Their source is reviewed in P2-BINDINGS-REVIEW.md. Default active adapter keys stay null; configured production-adapter acceptance now executes instead of reporting absent classes. |
| Tests | P2's SQL/HTTP/race runner and new foundation adapters are now published and included unchanged, along with all P1/DBA/portable/frontend suites. Results/skips and lock-order failure remain explicit. No portable/test-double pass is presented as production acceptance. |
| Browser registration | Existing shared envelope/factory seam retained; P2 scoped readers reviewed. domains.js factories/readers remain empty until original-form integration and the concurrency correction pass. Missing modules/revisions remain explicit401/503. |
| Private photos / P1 families | [Photo contract](PRIVATE-INCIDENT-PHOTOS.md) is a typed port, not uploaded bytes. Byte implementation/metadata/policy and P1 security/verification/personnel/facility producer+handler review remain pending. Photo routes fail closed. |
| Deployment | Explicit frontend artifact and backend/public root retained. No private bytes/vendor/config/logs/tests/dumps/seed in the backend artifact. No production integration, shared migration, worker activation, main/teammate merge or external message. |

The DBA's auth_version/cast, corrected scope fixture, canonical v2 envelope and per-recipient receipt pipeline remain reviewed. P2's corrected NotificationController formatting and newly published implementations must be measured by the combined run; historical missing-class/format findings are not automatically retained as current blockers.

Production release remains blocked by the specific P2 lock-order regression and form handoff, even if selective production-adapter and existing race probes pass. P1 edits only its own foundation/config/CI/tests/docs; exact owner source hashes are verified after every combined run.

Setup: [Foundation](FOUNDATION.md), current commands/profile: [P2 binding review](P2-BINDINGS-REVIEW.md), facade routes: [API matrix](API-MATRIX.md), measured evidence: [Validation](VALIDATION.md). Preserve private .env/APP_KEY; SQL acceptance uses only confirmed disposable MySQL8.4 schemas.
