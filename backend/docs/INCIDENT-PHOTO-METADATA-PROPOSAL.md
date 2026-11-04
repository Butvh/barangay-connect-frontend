# Incident-photo metadata — proposal 1, awaiting P1/P2 review

**Superseded:** agreement is recorded and a new additive migration/model are active. Use [the current handoff](PHOTO-METADATA-AGREEMENT.md), including input/output hashes, five-minute leases and recoverable DDL. The original proposal below is retained as history.

**November4 review:** current P1 5447d87 and P2 acc9f56 publish no joint ratification, exact attach/download incident policy or private-byte implementation. The accepted incident lock correction does not ratify this schema. [Concrete decisions/implementation prerequisites](PHOTO-SMS-CONTRACT-DECISIONS.md) are sent to both owners; no active migration/model is added and the original eight migrations stay immutable.

Reviewed against P1 `c0a32cfaf4b26b86d57681cd1ed6aa42d6c87bb1`, [PRIVATE-INCIDENT-PHOTOS.md](https://github.com/Butvh/barangay-connect-frontend/blob/c0a32cfaf4b26b86d57681cd1ed6aa42d6c87bb1/docs/backend/PRIVATE-INCIDENT-PHOTOS.md), and P2 `3d23092883e0f24aa89b4c86ce93862e35880e3e`. This is **an unratified DBA proposal**, not a running upload feature. The executable candidate is [database/proposals/incident-photo-metadata.php](../database/proposals/incident-photo-metadata.php), deliberately outside Laravel's migrations directory. All eight existing migrations remain unchanged. No table/model/route/binding is enabled by deploying this branch.

## Proposed relationships and fields

New `incident_photos` InnoDB table; no reuse of verification/personnel `documents.kind` or ownership columns. One immutable staged object becomes at most one attachment. Numeric IDs remain internal safe API identifiers; upload tokens and private keys have separate purposes.

| Field / constraint | Proposed meaning |
| --- | --- |
| id | unsigned bigint primary key; P1 validates numeric API range and never exposes a raw model |
| upload_id | unique, server-generated canonical lowercase UUIDv4, matching StagedIncidentPhoto; opaque reference, never bearer authorization |
| barangay_id + uploader_id | required composite FK to users(id,barangay_id), RESTRICT update/delete, including while unattached |
| uploader_auth_version | required unsigned captured generation, no default/fallback; P1 compares to the **original observed** identity and current locked user at attach |
| incident_id | nullable until attachment; composite FK (incident_id,uploader_id,barangay_id) to emergency_alerts(id,resident_id,barangay_id) enforces same scope and reporter ownership |
| supporting incident key | additive unique index photo_incident_owner_scope on (id,resident_id,barangay_id); existing primary key and history unchanged |
| intent_digest | 64 lowercase hex HMAC of authenticated uploader/scope/generation/route/submit key using a server secret; never raw browser key; unique per uploader/scope/generation/intent |
| disk + object_key | fixed proposed private disk `private_incident_photos`; unique pair; random 256-bit key `incident-photos/<2hex>/<64hex>`, no client path/filename, extension or public URL authority |
| mime, bytes, sha256 | detected image/jpeg or image/png,1..10485760 bytes,64 lowercase hex digest of actual immutable stored bytes; all null while inspection is incomplete, all present before ready/attached |
| state | processing, ready, attached, failed, removing, removed; explicitly described below |
| created_at, updated_at, uploaded_at | UTC timestamp(6); uploaded_at records successful inspection/private-byte persistence, not merely receipt of a filename |
| expires_at | required; proposed unattached lifetime at most24h from allocation, subject to agreement; attached records keep it as staging history, not an attachment-deletion deadline |
| attached_at | required iff state=attached and incident_id is nonnull; between uploaded_at and staging expiry |
| cleanup_token, cleanup_lease_until, cleanup_attempts | fenced UUIDv4 claim and expiry for removing state; bounded counter; cleanup occurs outside domain/file transactions |
| failure_code, failed_at, removed_at | static diagnostic allowlist and outcome timestamps; no submitted text, local paths, exception or provider credentials |

The reporter-owned FK is a deliberate **proposal limitation**: only a resident's own staged upload attaches to their incident. It does not approve official/operator uploads. P1/P2 must agree any broader uploader relationship before changing that FK. Numeric IDs, generation, tenant, path and state never come from multipart authority. A matching hash does not grant cross-user reuse; hashes are not globally deduplicated or public.

Indexes: unique upload token, private object and scoped submit intent; `(barangay_id,uploader_id,state,expires_at,id)` for owner staging, `(state,expires_at,id)` for expiry scans, `(state,cleanup_lease_until,id)` for worker recovery, and `(barangay_id,incident_id,id)` for scoped attachment lists. The composite attachment FK has its own supporting index. These are metadata access indexes, not evidence of a large-scale query plan.

## Lifecycle, transactions and ownership

1. **P1 stage:** validate current captured identity/residency and actual UploadedFile bytes; detect JPEG/PNG, nonempty<=10MiB, decode and bound dimensions. Allocate a private random object, inspect/write immutable bytes, then persist ready metadata. Processing must not return a successful StagedIncidentPhoto. A retry with the same intent returns the same persisted token only if actual byte hash/size match; different bytes conflict. Incomplete/failed inspection never fabricates uploaded evidence. P1 owns orphan detection if storage succeeds and SQL fails.
2. **P2 incident transaction + P1 attach:** hold the agreed operations-person guards, current user/appointment rows, incident/assignment rows and exact observed revision before the photo row. Reload token FOR UPDATE, require ready/unexpired, exact uploader/scope/original generation and actual immutable private-byte evidence. P2 authorizes the exact persisted incident and attach purpose; P1 changes state/incident/attached_at in that same connection/transaction. No object move, deletion, decoding or provider call inside a retryable domain transaction. A rolled-back attachment returns to ready and leaves the staged bytes intact. Idempotent replay returns the existing attachment only after current authorization and command verification; a different incident conflicts.
3. **P1 download:** reauthorize the current observed identity and exact photo/incident through a purpose-specific P2 source policy. The existing household `IncidentReferenceAuthorization::allows(observed,residentId,locked)` is **not** an exact incident-photo policy and must not be reused as one. P2 must ratify separate attach/download rules, including resolved/history access and transferred/completed assignments. P1 enforces private-root resolution, no symlinks/escape, hash/size integrity, generated attachment name, private no-store/nosniff response. No nearby/public projection contains a token, object key, hash or photo link.
4. **P1 cleanup:** claim only an expired **unattached** processing/ready/failed row using a short metadata transaction/lease. Change it to removing; commit; delete its verified object outside the transaction; update removed outcome with the matching token. Expired leases permit fenced recovery. A claimed row cannot attach. Cleanup never takes a photo row and then waits for an incident/user row, and never removes attached bytes because expires_at passed. Failure/retry keeps evidence; no tombstone pruning/retention period is approved here.

CHECKs enforce token/key shapes, inspection bounds, state/attachment pairs, maximum staging lifetime, claim pairs and removal/failure metadata. They cannot validate actual bytes, current time, current generation, incident revision, residency or authorization, and cannot make object storage atomic with SQL. They also do not enforce transition history or prevent a privileged update/delete; P1's transition service and reviewed runtime privileges must preserve immutable attachments/evidence. P1/P2 own those checks. Proposed models must guard all attributes and hide disk/key/hash/intent/generation; use explicit safe DTOs (`upload_id,mime,bytes,expires_at` for staging), never model serialization.

## Candidate migration and rollback acceptance

The proposal is executable for review on an explicitly disposable MySQL8.4 database only. After ratification, DBA will publish a **new additive migration/model**, keeping original migrations immutable. MySQL DDL auto-commits: if table creation fails after adding the supporting incident index, inspect the existing index/table and forward-fix that partial state; do not blindly rerun or drop unrelated indexes. Empty downgrade requires a quiescent database with writers/cleanup stopped; its existence check is not protection against concurrent inserts. No shared migration is authorized by this proposal.

`IncidentPhotoProposalTest` runs candidate up/down directly outside auto-discovery. It verifies seeded records survive, InnoDB/index creation,20 invalid ownership/scope/token/key/MIME/size/hash/generation/lifecycle/expiry cases, attachment rollback, duplicate submit intent, and downgrade refusal with retained attached metadata. Empty downgrade removes only the candidate table/supporting index and forward application works. **Any retained metadata blocks down**, including failed/removal tombstones; forward fixes preserve evidence. The test cleans its own disposable rows before rehearsing empty downgrade; production rollback must never copy that cleanup.

P1/P2 integration tests still required: actual private-byte staging/download and malformed/truncated image/path/symlink denial; same-key/same-bytes and changed-body retries; current generation/ownership/expiry; exact revision and resolved-incident policy; two concurrent token consumers; attach versus cleanup with worker crash/lease recovery; rollback plus orphan processing; account/role/assignment revocation; storage integrity and public-root exclusion. No byte-service or photo workflow concurrency acceptance is claimed by metadata tests.

## Decisions requested before ratification

P1: private disk/key convention,24h lifetime, processing response/retry policy, dimension limits, cleanup lease/retention and storage-integrity strategy. P2: exact attach/download policy keyed by incident ID and original observed identity, allowed uploader roles, resolved/history/transfer behavior and transaction lock plan. DBA: confirm fields/constraint names and final migration after those decisions. The proposal does not enable upload routes, substitute a filename, or broaden SMS/event payloads.
