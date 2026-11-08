# PR51 follow-up contract and ownership

Status: **PROPOSED — P2 and DBA agreement pending.** No dependent product or schema changes are authorized by this document alone. Integration reference: PR #51 only. Inspected source checkpoint: `b00d944789dada39a356ebb6497da0aae4d74049`. All role branches start there; this document-only checkpoint does not replace the product baseline.

## Ownership and handoff

| Area | Writer | Boundary |
| --- | --- | --- |
| Map renderer, facility forms/model, map consumers and shared scope helper | P1 | Preserve illustrated artwork and percentage coordinates; narrowly patch resident consumers only for this shared correction. |
| Barangay reference projection/reader, shared factory registration, integration tests/configuration | P1 | Publish explicit server scope; preserve auth/revisions, original owner hashes, composer/verifier and public-root isolation. |
| General Feedback commands, routes, DTOs, communications adapter, official/resident feedback UI and domain regressions | P2 | P2 decides and confirms domain semantics below before implementation. P1 will not implement these files. |
| Additive migrations, Eloquent models, constraints, independent lock/database review | DBA | DBA confirms minimum persistence and publishes schema checkpoint before dependent positive SQL tests. |
| PR51 candidate composition and patch declarations | P1 only | Integrate explicitly handed-off reviewed role commits, schema first. Preserve authorship; never rewrite role branches. |
| Actual recording profile identification and final encrypted capture/restore | Current custodian + DBA | Private handoff; no retained coverage backfill or invented pin. Final backup follows exact source freeze. |

P2/DBA: report exact role branch/base/commit, files, dependency SHAs, commands/results/skips and ready/not-ready verdict in PR51. Raise shared-file overlap before editing. Production activation, external delivery, main merging and retained database mutations remain outside this packet.

## Map scope proposal (P1; DBA/P2 confirmation required)

1. Existing `barangays.map_scope` is authoritative: the only recognized artwork key is exact `sampaguita`, matching existing fixtures and `assets/img/maps/sampaguita.png`. NULL, missing, unknown, generic truthy flags, names and numeric IDs never enable it. No schema addition or data backfill is proposed.
2. Keep `Api.barangays.list()` and the current server-selected factories/readers. Return `{id, name, map_scope}` from both existing barangay read paths. A compatibility `map_available` may remain, computed from recognized coverage, but clients must select by exact scope. Registration may list available barangays; authenticated map consumers select only the current identity's row. Client input cannot submit `barangay_id`, `map_scope` or availability to choose authority.
3. P1 adds one shared resolver and passes an explicit resolved map context to the renderer and page models. Demo mode resolves its explicit seed declaration separately; backend mode obtains current references through the API and fails closed on errors without browser/seed fallback. Include barangay reference invalidation where coverage can change.
4. Render a marker only with valid finite 0..100 percentage coordinates, an authorized current tenant, and matching declared artwork. Zero is valid. Do not clamp invalid/missing coordinates into invented pins. Alert/household coordinates inherit their server-authorized tenant's declared scope; facility coordinates additionally require their own exact `map_scope`. Foreign-tenant facility pins stay off this map even when their directory entry is an authorized shared referral. Shared referral directory and historical destination visibility remain intact; inactive facilities remain unavailable as new rescue destinations. Do not invent a barangay hall pin in backend mode.
5. Facility writes derive both owner and map scope from the authenticated Laravel context. P1 proposes tightening existing coverage validation to recognized `sampaguita` for new/changed pins. Editing other fields on a legacy unsupported pin must preserve its historical values or require an explicit user-cleared pin, never silently relabel it. DBA reviews this service boundary; P1 owns the existing service, not its model/migration.
6. Regression preparation: supported scope with non-1 ID; ID1 with NULL/unknown scope; foreign/wrong-scope pins; valid 0/100 and invalid/missing coordinates; shared referral reads; inactive/new-destination and immutable rescue history. Then real HTTP/browser Captain/Secretary create/edit/pin/deactivate/reactivate and applicable Resident/Responder/Rescuer reads, keyboard and 1920/768/390 layouts.

Retained recording proposal only: before = current declared scope/actual coordinates (unknown until custodian identifies current profile); after = custodian-approved exact artwork declaration and independently verified approximate pins, if supported. No change is executed under this proposal. Capture before/after with DBA approval if later authorized.

## General Feedback proposal (P2 ratifies domain; DBA ratifies persistence)

The existing full comment/rating/submitted time/resident/tenant/revision remain canonical. General `status` stays NULL; Complaint/Suggestion status transitions remain unchanged. Proposed minimal lifecycle:

| Decision | Proposed contract — awaiting P2/DBA |
| --- | --- |
| Commands | `POST /feedback/{id}/review` and `POST /feedback/{id}/archive`; `expected_revision` plus the existing original idempotency command key. No client actor/time/state fields. |
| Permissions | Current Captain/Secretary in the owning barangay only; current role/scope/security generation revalidated under locks. Other roles cannot review/archive; residents retain authorized own-history reads. |
| Transitions | Unreviewed -> reviewed -> archived, archive requires prior review; no delete/unarchive in this packet. Existing general rows start unreviewed without invented history. |
| DTO | Existing fields plus nullable server `reviewed_at`, `reviewed_by`, `archived_at`, `archived_by`, capabilities and immutable action history with action-time actor name/role/time. P2 to confirm precise DTO nesting/history visibility. |
| Visibility | Default official general queue excludes archived; explicit archived/all filter preserves full read-only comment/rating/history. Resident own history remains visible with archived records; operational categories unaffected. |
| Metrics | Compute average rating/positive percentage over all authorized General Feedback with valid ratings, including archived; received-this-month over all scoped submissions by Asia/Manila submitted time. Queue filters do not silently change this population. P2 to confirm authoritative server summary shape or complete-list strategy. |
| Retry/conflict | Same original key and unchanged intent returns original committed result without duplicate audit/event; changed intent/key reuse conflicts. A fresh command with stale revision conflicts and preserves the form; no automatic rebase. Repeat transition under a new key must have explicit P2-defined semantics. |
| Audit/event | Atomic command receipt + lifecycle update + existing immutable activity log + agreed event, no parallel history table. Internal review/archive proposes no resident-facing notification or external side effect; P2 must confirm event names/audience and history projection. |
| Persistence | DBA's minimum proposal: nullable paired `reviewed_by/reviewed_at` and `archived_by/archived_at`, scoped restrictive actor FKs, general-only checks and scoped queue index. Reuse revision/receipt/audit/outbox. Actor history survives role reassignment. DBA decides whether existing audit derivation is sufficient instead. |
| Lock order | Original receipt, declared sorted actor/person eligibility rows, then scoped feedback, atomic write/audit/event. P2/DBA confirm actual lock plan; no broad audience locks or late actor reads after source locks. |

Before implementation P2 must confirm endpoints/DTO and history visibility, archive policy, metrics population, retry/repeated-state semantics and notification/event intent; DBA must confirm schema/constraints/lock compatibility. Incomplete General Feedback actions remain disabled until schema + production services + original forms pass real end-to-end tests.

## Acceptance and freeze

Original source fingerprints remain immutable in `owner-source-baseline.json`; every changed owner file needs an explicit before/after/reason declaration. Existing composer/verifier and original assertions remain. Run frontend/static/artifact/Pint/Composer, complete PHP on genuine fresh isolated MySQL, original P2 contract/SQL/race/lock suites, original browser suites plus new map/general regressions, both SOS branches, manual assignment, capacity2/1, stale identity/revisions, private photos and actual in-app receipts. Baseline green evidence is not acceptance of a changed candidate.

P1 freezes one exact clean PR51 head and manifest with dependency commits and actual results/skips. P2/DBA independently accept that same head; any source change withdraws its final verdict. Final actual-recording encrypted backup and different-new-target restore remain a separate DBA/custodian gate. PR51 stays draft/unmerged.
