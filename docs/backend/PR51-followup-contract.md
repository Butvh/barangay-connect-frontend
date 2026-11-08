# PR51 follow-up contract and ownership

Status: **RATIFIED by P1, P2 and DBA.** Integration reference: PR #51 only. Product/role checkpoint: `b00d944789dada39a356ebb6497da0aae4d74049`; document-only checkpoints do not replace it. P2 domain proposal: `e8fc119b48838b7f55c25d63f43fc9790613fc08`. Agreement: P1 comment `6719300658`, DBA `6719300876`, P2 `6719320886`. These include the corrected actual lock order and independent archive transition below. Dependent product work may begin within this ownership; positive P2 SQL waits for DBA's schema checkpoint.

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

## Agreed map scope (P1; no schema/backfill)

1. Existing `barangays.map_scope` is authoritative: the only recognized artwork key is exact `sampaguita`, matching existing fixtures and `assets/img/maps/sampaguita.png`. NULL, missing, unknown, generic truthy flags, names and numeric IDs never enable it. No schema addition or data backfill is proposed.
2. Keep `Api.barangays.list()` and the current server-selected factories/readers. Return `{id, name, map_scope}` from both existing barangay read paths. A compatibility `map_available` may remain, computed from recognized coverage, but clients must select by exact scope. Registration may list available barangays; authenticated map consumers select only the current identity's row. Client input cannot submit `barangay_id`, `map_scope` or availability to choose authority.
3. P1 adds one shared resolver and passes an explicit resolved map context to the renderer and page models. Demo mode resolves its explicit seed declaration separately; backend mode obtains current references through the API and fails closed on errors without browser/seed fallback. Include barangay reference invalidation where coverage can change.
4. Render a marker only with valid finite 0..100 percentage coordinates, an authorized current tenant, and matching declared artwork. Zero is valid. Do not clamp invalid/missing coordinates into invented pins. Alert/household coordinates inherit their server-authorized tenant's declared scope; facility coordinates additionally require their own exact `map_scope`. Foreign-tenant facility pins stay off this map even when their directory entry is an authorized shared referral. Shared referral directory and historical destination visibility remain intact; inactive facilities remain unavailable as new rescue destinations. Do not invent a barangay hall pin in backend mode.
5. Facility writes derive both owner and map scope from the authenticated Laravel context. P1 proposes tightening existing coverage validation to recognized `sampaguita` for new/changed pins. Editing other fields on a legacy unsupported pin must preserve its historical values or require an explicit user-cleared pin, never silently relabel it. DBA reviews this service boundary; P1 owns the existing service, not its model/migration.
6. Regression preparation: supported scope with non-1 ID; ID1 with NULL/unknown scope; foreign/wrong-scope pins; valid 0/100 and invalid/missing coordinates; shared referral reads; inactive/new-destination and immutable rescue history. Then real HTTP/browser Captain/Secretary create/edit/pin/deactivate/reactivate and applicable Resident/Responder/Rescuer reads, keyboard and 1920/768/390 layouts.

Retained recording proposal only: before = current declared scope/actual coordinates (unknown until custodian identifies current profile); after = custodian-approved exact artwork declaration and independently verified approximate pins, if supported. No change is executed under this proposal. Capture before/after with DBA approval if later authorized.

## Agreed General Feedback (P2 domain; DBA persistence)

The existing full comment/rating/submitted time/resident/tenant/revision remain canonical. General `status` stays NULL; Complaint/Suggestion status transitions remain unchanged. Proposed minimal lifecycle:

| Decision | Agreed contract |
| --- | --- |
| Commands | `POST /feedback/{id}/review` and `POST /feedback/{id}/archive`; `expected_revision` plus the existing original idempotency command key. No client actor/time/state fields. |
| Permissions | Current Captain/Secretary in the owning barangay only; current role/scope/security generation revalidated under locks. Other roles cannot review/archive; residents retain authorized own-history reads. |
| Transitions | Review and archive are independent; archive never implicitly reviews. Review of archived or fresh already-applied commands returns `INVALID_STATE`409; no delete/unarchive. If both timestamps exist, archive cannot precede review. Existing general rows start unreviewed without invented history. |
| DTO | Existing fields plus nullable server `reviewed_at`, `reviewed_by`, `archived_at`, `archived_by` with UTC times. No new actor lookup/capability/history DTO required. Immutable action-time actor name/role/time remains in existing activity logs/reports. |
| Visibility | Official-only query `archive=active\|all\|only`, default active; filters general only, `only` returns archived general. Direct scoped GET remains readable. Residents default to all own history and cannot use the administrative selector. No new archive-list/restore UI. Queue archive clears selection to next visible/empty, never reveals a linked archived entry in the active queue. |
| Metrics | Fetch complete authorized `archive=all` official data. Average rating/positive percentage include archived valid ratings; received-this-month includes all scoped submissions by Asia/Manila submitted time. Queue filters never change this population. Resident history remains complete. |
| Retry/conflict | Same original key/body uses the existing receipt and re-reads the currently authorized resource; no promise of an immutable response snapshot. No duplicate audit. Changed body/resource/action key reuse conflicts. Fresh stale revision returns `CONFLICT`409; fresh already-applied/wrong-type returns `INVALID_STATE`409, without effects or automatic rebase. Preserve the same form intent after a lost reply. |
| Audit/event | Atomic command receipt + lifecycle update + existing immutable typed activity log. Administrative audit only: **no new event, outbox recipient or notification/SMS intent**. Existing `feedback.updated.v2` is restricted to complaint/suggestion and is unchanged. No parallel history table. |
| Persistence | DBA's minimum proposal: nullable paired `reviewed_by/reviewed_at` and `archived_by/archived_at`, scoped restrictive actor FKs, general-only checks and scoped queue index. Reuse revision/receipt/audit/outbox. Actor history survives role reassignment. DBA decides whether existing audit derivation is sufficient instead. |
| Lock order | Existing `Module::once`: sorted actor/person guards and current rows -> existing receipt -> scoped feedback source -> atomic markers/revision/audit/receipt. Include resource/action identity in command intent. No new event, broad audience locks or late actor reads after source locks. |

P1 owns exposing the existing complete feedback reader (`archive=all` for current Captain/Secretary, resident default unchanged) and readiness/admission; P2 owns communications adapter/routes/domain/feedback pages and tests. DBA owns the four-field additive migration/model/constraints/index and its upgrade/rollback tests; no map migration. Incomplete General Feedback actions remain disabled until schema + production services + original forms pass real end-to-end tests.

## Acceptance and freeze

Original source fingerprints remain immutable in `owner-source-baseline.json`; every changed owner file needs an explicit before/after/reason declaration. Existing composer/verifier and original assertions remain. Run frontend/static/artifact/Pint/Composer, complete PHP on genuine fresh isolated MySQL, original P2 contract/SQL/race/lock suites, original browser suites plus new map/general regressions, both SOS branches, manual assignment, capacity2/1, stale identity/revisions, private photos and actual in-app receipts. Baseline green evidence is not acceptance of a changed candidate.

P1 freezes one exact clean PR51 head and manifest with dependency commits and actual results/skips. P2/DBA independently accept that same head; any source change withdraws its final verdict. Final actual-recording encrypted backup and different-new-target restore remain a separate DBA/custodian gate. PR51 stays draft/unmerged.
