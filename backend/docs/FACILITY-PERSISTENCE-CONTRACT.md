# Additive facility persistence — November 5, 2026

Implements P1's requested contract in PR48 comments [6632174458](https://github.com/Butvh/barangay-connect-frontend/pull/48#issuecomment-6632174458) and [6633918572](https://github.com/Butvh/barangay-connect-frontend/pull/48#issuecomment-6633918572). No preceding eleven migration is changed. P1 owns the authorized source writer and history projection; this persistence publication alone does not certify those future service changes.

## Width upgrade and downgrade

Migration 2026_11_05_000100 widens facilities.name to VARCHAR(160), address to VARCHAR(300), contact to nullable VARCHAR(50), retaining utf8mb4_0900_ai_ci, nullability and existing references/values. Compatible old/new shapes are accepted on replay; unexpected types/widths/collations refuse. No row or rescue destination snapshot is rewritten.

Downgrade first refuses values exceeding the original 100/200/30 character bounds. A strict atomic ALTER also rejects an independently committed wide write between the precheck and DDL, including a permissive caller SQL session; the original sql_mode is restored. No truncation is an accepted downgrade. Prefer a forward fix once longer values exist.

## Immutable facility_history

Migration 2026_11_05_000200 adds the following fields; there is no backfill or fabricated legacy snapshot.

| Column | Persisted contract |
| --- | --- |
| id | BIGINT UNSIGNED primary key |
| facility_id | BIGINT UNSIGNED, required source |
| barangay_id | BIGINT UNSIGNED, required actual managing scope |
| actor_id | nullable BIGINT UNSIGNED |
| actor_name | nullable VARCHAR(100), name at action |
| role_at_action | nullable VARCHAR(20), effective role at action |
| action | ASCII VARCHAR(30), Created/Edited/Deactivated/Reactivated |
| revision | INT UNSIGNED, source revision at action |
| snapshot | required bounded full display JSON |
| occurred_at | required TIMESTAMP(6), server UTC |

Unique(facility_id,revision). Scoped RESTRICT FK (facility_id,barangay_id) -> facilities(id,managed_by_barangay_id), backed by a NEW unique parent index facility_history_scope_parent. Nullable scoped RESTRICT actor FK (actor_id,barangay_id) -> users(id,barangay_id). Scope/time/id and actor/scope indexes support exact manager history. No cascading deletion or nulling of retained evidence occurs. Management scope cannot be rewritten underneath retained history.

Created requires revision0; the other three actions require revision>=1. P1 locks the exact facility, checks the original revision and increments once for changes. New facilities receive their actual Created/revision0 row. An existing legacy facility's first real post-upgrade change may start at its real source revision; do not manufacture earlier entries. SQL uniqueness prevents duplicate revisions; current authority, sequence and source/history/audit/outbox atomicity are P1's service responsibilities.

## Exact snapshot shape

Required keys: id, managed_by_barangay_id, name, type, address, capacity, contact, notes, status, map_x, map_y. Optional display keys: barangay_id, visibility, map_scope. Other fields are rejected, including private document/upload/contact-authority tokens. The nullable display barangay_id of a shared facility never replaces its required actual managed_by_barangay_id.

Type uses existing display values Hospital/EvacuationCenter; status Active/Inactive. Name/address/contact bounds are 160/300/50; nullable contact and notes are allowed, notes max300. Capacity is null or integer1..999999; an evacuation center requires capacity. Pins must be both null or both numeric0..100. Optional map_scope is nullable max100 and visibility local/shared. IDs use positive JavaScript-safe integers. JSON_SCHEMA_VALID enforces this shape and a maximum8192 serialized bytes; snapshot ID and managing scope must equal the row/FK. Deactivated/Reactivated snapshots must match Inactive/Active respectively.

Snapshot fields are facts captured at the action, not pointers to today's facility/user values. P1 should extend its current snapshot function with actual managed_by_barangay_id and insert the full snapshot in the SAME source/history/audit/outbox transaction. No second outbox writer or dispatcher is needed. P1's current service still projects action-only audit history at reviewed90208db; adopting this full-history table remains its task.

## Immutability and access

BEFORE UPDATE and BEFORE DELETE SQL triggers reject facility_history_immutable, including raw query-builder operations. FacilityHistory also guards all mass assignment, refuses model updates/deletes and serializes no attributes. Explicit authorized P1 DTOs may return the approved display history to a current Captain/Secretary of the managing barangay; a shared-directory read grants no history write/read authority by itself. Database constraints do not replace this authorization. Only the P1 facility source service should insert real history; schema migrations/tests use isolated fictional fixtures. Runtime database privilege separation remains a deployment responsibility.

Any retained row refuses migration down with facility_history_retained. Empty downgrade drops only this table/triggers/owned parent index. A compatible table left before trigger creation is verified and repaired; an incompatible table/index/trigger is retained and rejected. No CREATE IF NOT EXISTS silently accepts a divergent schema.

## Acceptance and owner handoff

Targeted acceptance: **26 tests / 89 assertions, zero failures/errors/warnings/skips**, genuine isolated MySQL8.4.13, frozen P1 90208db / P2 272f8d6. The missing-width test was RED at 100/200/30 before implementation. Tests cover unchanged-eleven upgrade, existing values/references/destination JSON, multibyte boundaries/oversize denial, scoped FKs/unique/action/snapshot constraints, SQL/model immutability, nullable actor evidence, transaction rollback, safe downgrade and interrupted/incompatible DDL. A separate real connection inserts a wider value after the downgrade precheck; strict atomic ALTER rejects narrowing without losing data and restores the caller's permissive mode. Actual P1 FacilityAdministration edit/deactivation with the widened boundaries preserves existing rescue destination snapshots; it is not represented as a full-history writer acceptance test before P1 adopts the contract.

No P1/P2 service, shared Composer/bootstrap/CI/frontend, shared/live database, production selection or external delivery is changed by this extension.
