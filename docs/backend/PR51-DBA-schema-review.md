# DBA schema and recovery review for PR #51

Status: DBA schema implementation against the ratified P1-owned contract at `542876273b513fb7a7c23ccb9e22af27407d4043`. This checkpoint does not approve the final integrated candidate or recording backup/restore. Exact test outcomes are published separately with the role handoff.

## Independent checkpoint results

The DBA dependency is ready for P1 review/integration. [Sanitized exact fingerprints, commands, raw evidence digests and verdicts](PR51-DBA-schema-evidence.json) bind these results to the role files and base. No clean final integration manifest is claimed for this role-only overlay; P1 must declare the three changed upstream files and integrate the two new PHP files before dependent combined admission.

- Genuine MySQL Database suite: **147 tests / 558 assertions / zero failures, errors or skips**, including all 130 original cases and 17 lifecycle cases. Original fictional backup/restore, SQL/constraint/concurrency and migration regressions remain. Only disposable schemas were used.
- Normal Laravel migration repository: migrate, unused one-step rollback and reapply pass on another new empty target. Final inventory: **43 tables / 69 FKs / 14 migration records**. Schema digest `3c5f198ccc3c0b355e55d3fe66c298a4fd9607710b540afd2ca6fd82690276ea` is this target's normalized SHOW CREATE inventory, not a universal device-independent identifier.
- All **13 original migration files remain byte-equivalent after canonical LF normalization**. The two original migration-discovery tests still require those 13 and now explicitly discover the separate new file; no domain assertion was removed.
- Scoped Pint check of five DBA PHP files, strict Composer validation and platform requirements pass. PHP8.5.12/MySQL8.4.13/PHPUnit12.5.43/Node24.22.1. Shared dependency/bootstrap/CI files are unchanged.
- On the unchanged b00 baseline, independent SQL/controller/race suite **53 PASS**, actual-service lock probe **late_user_ids=[] / both writes committed**, and focused integration audit **8 tests / 86 assertions** pass. These include actual in-app delivery/receipts/replay and fake-provider denial. They do not certify unshared future General Feedback commands or a different final candidate.
- Original baseline source verifier passes before/after: **868 fingerprints / 279 retained upstream owner files / 28 explicit audit patches / dirty=false**.

Failures remain preserved: first baseline Database130 run found an extra Artisan migration repository because the DBA pre-migrated a direct-migration fixture; the unmodified suite on a different empty target passes130/486. First expanded147 run found two hardcoded total-migration counts13; the final checks preserve the original13 separately and discover file14. Earlier sandbox connection/cache setup failures and the successful exact-lock Composer retry are labelled diagnostics. No failed run is counted as passing.

Review base: `b00d944789dada39a356ebb6497da0aae4d74049`, PR #51 draft/open. The DBA role branch starts directly from this integration commit. P1 alone integrates reviewed role commits. Historical owner branches are not alternative integration inputs. The referenced November 2 development-plan file is absent from this integration tree; current audit, source, ownership and the supplied execution order govern this review.

## Existing persistence and agreed expansion

`community_feedback` already has scoped resident ownership, `kind`, a full `comment` with rating, operational `status`, `revision`, submission/assignment/resolution times and timestamps. `feedback_kind_check` deliberately requires general feedback to retain a 1–5 rating, nonempty comment of up to 2,000 characters, NULL operational status and NULL assignment/resolution fields. Complaint/suggestion status must remain `Pending`, `Assigned` or `Resolved`. Do not overload this status with general review/archive states or replace the full comment with its display title.

Existing `activity_logs` retains server actor ID/name, role at action, resource reference, action, bounded summary, occurrence and recording times. Its model forbids update/delete. Existing command receipts, transactional typed audit and optimistic revision can be reused; a second feedback history table is not proposed. Never manufacture legacy review events or infer an actor/time from a current staff role.

The agreed queueable review/archive state adds only:

| Physical column | Type / meaning |
| --- | --- |
| `reviewed_by` | nullable unsigned BIGINT; server-authenticated actor |
| `reviewed_at` | nullable TIMESTAMP(6), UTC server occurrence time |
| `archived_by` | nullable unsigned BIGINT; server-authenticated actor |
| `archived_at` | nullable TIMESTAMP(6), UTC server occurrence time |

Keep `revision` as the one concurrency token. There is no redundant status enum. Existing rows receive NULLs, with no rewritten content, owner, scope, revision, submission time or invented review history. Direct archive without review is allowed and does not implicitly mark review. P2 owns fresh-command state checks and replay behavior.

Implemented database rules:

- Each actor/time pair is either entirely NULL or entirely non-NULL. Non-general rows must have all four new fields NULL. Keep `feedback_kind_check` unchanged.
- Each actor uses a named composite RESTRICT FK `(actor_column, barangay_id)` to existing `users(id, barangay_id)`. This uses the existing unique parent key. Do not reference a current appointment, active-role flag or Tanod membership. Role reassignment does not erase the user or the recorded role-at-action evidence. A later tenant-move policy would require an explicit historical-identity decision; do not cascade historical scope.
- Review and archive are independent. When both exist, `archived_at >= reviewed_at`; NULL review is explicitly allowed. No delete/unarchive is implemented. P2 prevents a fresh review of archived feedback or repeated applied transition and preserves the original review actor/time.
- Queue index `feedback_general_queue (barangay_id, kind, archived_at, submitted_at, id)` supports the agreed active general queue. No reviewed-time filter was agreed, so no redundant reviewed-time index was added. The existing scope/kind/status/submission index remains. Actor-scope FK indexes serve integrity. The regression uses 3,000 historical rows with 2,880 archived and checks the actual active-queue `EXPLAIN`.

Model changes are limited to integer actor casts, immutable timestamp casts and `reviewer()` / `archiver()` relationships on the guarded `CommunityFeedback` model. P2 owns DTO field allowlists/projection and all service commands; P1 owns shared registration and the shared contract file.

## Agreed command boundary; owned by P1/P2

The ratified commands are POST feedback/{id}/review and /archive, with original Idempotency-Key and expected_revision. Only current local Captain/Secretary may mutate. Browser input cannot set actor, timestamps, state, scope, owner, rating/comment or history. P2 includes action/resource in command identity so a key cannot replay across resources. Replay re-reads the currently authorized DTO without duplicate audit; fresh stale revisions conflict, and already-applied/wrong-type/archived-review commands reject without effects. Preserve original intent/revision on retry. Official archive=active|all|only filters general feedback; resident own history remains complete and forbids that administrative selector. Official summary metrics use complete archive=all data.

The current `feedback.updated.v2` event permits complaint/suggestion only and remains unchanged. General review/archive is administrative audit only: no event family, outbox recipient, notification, SMS or Make intent is added. Existing activity logs/reports preserve action-time actor/name/role/time; no new history DTO or actor lookup is required.

Lock plan: declare actor and any other mutation-authoritative people before sources. The existing `Module::once` first enters the actor's ordered guards/current user/appointment/Tanod locks, then reads the receipt; a miss joins that same transaction and locks the exact feedback source. Do not invert this into receipt-first then person locks. Read current role/scope/captured security generation under the shared identity seam; recheck kind, ownership/scope, state and expected revision under the source lock. Commit row change, immutable audit and any explicitly agreed event/receipt atomically. Historical display-name and recipient projections must not acquire new user locks after the source. No tenant-wide or notification-audience guard is justified.

P2's actual service tests must cover competing review/archive commands, role revocation/reassignment, replay, stale revisions and caller rollback. A guard-helper-only fixture is insufficient. Old commands must still pass their actual capacity2/1 races, completion release and late-user-lock gate.

## Additive migration and regression plan

The new ordered additive migration is `2026_11_08_000100_add_general_feedback_lifecycle.php`. Old migrations, shared Composer/bootstrap/CI and retained databases are unchanged. MySQL DDL is not transactional: the migration finishes compatible partial applications and rejects incompatible existing columns/FKs/checks/indexes before further changes. It compares existing CHECK expressions with this MySQL server's own canonicalization using a short-lived empty shape-probe table, never by discarding expression parentheses. Probe cleanup is scoped to its generated name. No actor/history backfill occurs. Rollback is tested only on disposable data and refuses any non-NULL review/archive evidence before removing schema. Use a forward fix for recorded data.

Required genuine MySQL 8.4 cases:

1. Fresh migration and populated upgrade with general, complaint and suggestion rows; preserve complete original row values, multibyte 2,000-character comments, ratings, revisions and existing audit/outbox/receipt content. Added values are NULL.
2. Accept valid same-scope actor/time markers; reject orphan/cross-scope actors, half-pairs, forbidden operational-kind markers and any transition ordering agreed in the contract. Preserve existing rating/kind/operational checks. Exercise NULL explicitly because SQL CHECK accepts UNKNOWN.
3. Record server audit, change staff role through the existing owner path, then prove actor references and historical role/name/time remain. Do not obtain this result by changing appointment foreign keys or deleting history.
4. Realistic scoped queue query plans and FK/index inventory. Test interrupted/retried DDL shape handling; preserve failure evidence.
5. On a new disposable upgrade target, rollback an unused expansion without changing original rows/history; refuse rollback after non-NULL markers, then verify all evidence remains. Never run destructive rollback against a recording schema.
6. P2 actual commands: original key/body replay, altered key/body/resource conflicts, stale identity/revision, simultaneous transitions, fault-injected audit/event/receipt rollback, full-text preservation and current scope/owner denial. UI/route implementations remain P2/P1 work.

## Map source stewardship

`barangays.map_scope` and facility coordinates/scope are nullable. The current facility CHECK enforces paired 0–100 coordinates and a non-NULL pin scope; it cannot validate a supported artwork registry or equality to the owning tenant's declared coverage. Current PHP accepts any nonempty coverage string, the administration projection treats any non-NULL string as available, and `BCMap` selects artwork by numeric barangay ID 1. These are different contracts.

P1 should define one explicit supported artwork-key registry and safe DTO consumed by frontend/shared references. Unknown, empty or NULL keys are unsupported even if a fixture ID happens to be 1; a supported key on another authorized tenant must not depend on its numeric ID. Facility percentage coordinates belong to that declared artwork, not GPS. Saving a new pin must validate managing tenant authority, paired range and matching supported scope under P1's current revision/identity transaction. Shared referral visibility does not transfer pin-management authority or make another artwork's coordinates local.

No blanket map backfill or new closed enum is proposed without that contract. Existing NULL data remains missing; a legitimate real-data correction requires custodian review of source evidence, exact ownership/artwork/coordinates and a separate approved write. Do not copy illustrative fixture pins or silently mark retained coverage. Keep historical rescue destination snapshots and facility history as recorded; never update historical pins to match today's directory.

Acceptance cases: supported key on a non-1 tenant; unsupported/NULL/unknown key on tenant 1; complete/partial/out-of-range pin; foreign owner; shared facility with a different map scope; inactive facility hidden from new resident choices but retained in official history; historic destination unchanged after directory edit/deactivation. DBA can verify contracts/data integrity without implementing P1's map code.

## Actual recording capture and independent restoration

The user confirmed Lanz as current custodian and Lanz-Windows as designated device, using DBA-guided local encrypted capture and access-restricted transfer with restoration material separate. P2 was asked to verify the actual current profile/schema; historical aliases/counts remain insufficient identification. No actual PR51 recording archive, transfer or restored gallery is certified in this DBA session.

Confirm privately the actual source commit/manifest/runtime, MySQL identity/schema/table inventory, object roots and key/config custodian. Coordinate a short business-write pause. Use protected MySQL client options and a consistent logical dump including full schema/data, jobs/outbox, notifications/security tables and applicable triggers/routines/events. Record deliberate exclusions and invalidation consequences explicitly; do not inherit a count observer's exclusions as a backup policy. Select every referenced photo/document from that source metadata; shared object-root folder counts are not dataset scope.

Encrypt SQL, source and matching private objects/manifest; verify authenticated opening and record hash/size/custody. Keep decryption key and matching APP_KEY/private configuration separately protected. Use direct encrypted transfer or an explicitly restricted private location; no public/chat archive, writable-link folder, public MySQL, expanded grants/firewall or remote root.

A pre-change safety capture must be labelled separately and retained. Final capture must match P1's frozen PR51 head and actual dataset/config; recapture affected parts when they change. Restore only into a verified DIFFERENT, NEW/empty schema and new private storage with matching source/runtime/key. Never alter the original application profile, reset/reseed/drop recording data or overwrite an old archive. Refuse existing restore targets and validate resolved directories before recursive work.

Keep all restored queue/event/outbox/provider activity inactive. Compare complete applicable tables/content/FKs, source histories, assignments/destination snapshots, notifications/receipts and referenced bytes/hash/decryption. Use the original authorized resident and official browser gallery/download and unrelated/cross-scope denial; record authentication/session/cache changes separately from business-state invariance. Import/checksum alone is insufficient.

Publish three separate verdicts on PR51: schema/technical, actual capture/transfer/custody, and different-target restore/gallery/privacy. Old evidence or another owner's screenshots are attributed references, not independent DBA execution. The schema dependency is ready; final frozen-candidate acceptance remains pending P1 integration/freeze and actual P2 service/UI races. Actual recording capture/transfer and different-target restore/gallery remain blocked/not run pending current private source and archive/restoration-material handoff. No merge/deploy/real delivery is authorized.
