# Private incident-photo contract — interface proposal1

P1 publishes `App\Contracts\Photos\IncidentPhotos` and `StagedIncidentPhoto`. There is **no production binding or byte-upload implementation yet**. The current DBA schema has verification/personnel documents but no incident-photo metadata; those document purposes must not be repurposed. P2 has no reviewed private-photo source policy. Authenticated upload/download routes therefore return503; guests get401 and missing-CSRF writes419. A filename or a constructed DTO is never accepted as proof of uploaded bytes.

## Proposed HTTP / PHP handoff

| Operation | Contract / owner |
| --- | --- |
| POST /api/v1/incident-photos | P1 implementation, after dependencies: multipart `photo` actual UploadedFile, one caller Idempotency-Key, shared CSRF/cookie/observed-identity checks. Only JPEG/PNG detected from bytes, nonempty<=10MiB, bounded dimensions and a safe decoded image. Reject filename-only, SVG/HTML/PHP/PDF, mismatched MIME, oversized/truncated bytes and unknown fields. No client disk/path/owner/tenant authority. |
| Successful staging | P1 creates immutable bytes under a cryptographically random key in private storage and commits ready metadata. Return `{data:{upload_id,mime,bytes,expires_at}}` only. Never return object_key, public URL or owner credentials. Retrying the same intent/body returns the same persisted token; different bytes with that key conflict. Proposed unattached lifetime24h, subject to DBA/P1 review. |
| stage(observed,UploadedFile,intentKey): StagedIncidentPhoto | P1 port; must verify current identity/residency/upload policy, bytes and persisted metadata before constructing the server DTO. DTO validation alone is not an upload implementation. No writer is bound today. |
| attach(observed,uploadId,incidentId): int | P2 calls P1 inside its ordered incident transaction after current locked identity/source/revision checks. P1 reloads the persisted ready/unexpired token, scope, uploader and original generation; verifies actual immutable bytes; attaches once to that actor's authorized incident. No filesystem move/provider call inside a retryable transaction. Same committed command returns the same attachment; reuse on another incident conflicts. Caller accepts `photo_upload_id`, never a stored filename/path. |
| GET /api/v1/incident-photos/{photoId}/download | P1 reauthorizes current identity and exact P2 incident source for every request: owner resident, same-scope admin or currently assigned active operator. P2 supplies the incident policy through a reviewed purpose-specific port. Missing/cross-scope/inaccessible records do not reveal metadata. Nearby/public DTOs contain no photo reference or link. |
| download(observed,photoId): BinaryFileResponse | Resolve only persisted server key within the private root. Reject symlinks/path escape/missing or modified bytes. Stream as attachment with server-generated name, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. No public storage symlink, direct static fallback or byte response after role revocation. |

`observed` is the original EffectiveIdentity captured by current.identity, including its private generation. Do not replace it with a fresh identity to make an old request pass. P2 must retain its observed form revision and command key. Private upload controls remain unavailable until the actual ports are reviewed and bound.

## Exact DBA request — additive metadata, not a P1 migration

Please review an additive incident-photo table/model (name and final schema DBA-owned): numeric safe ID; unique UUID upload_id; scoped uploader user_id/barangay_id; nullable incident_id with composite scoped FK; private disk/object_key unique; detected MIME JPEG/PNG; bytes1..10485760; SHA256; captured uploader auth_version; uploaded_at/expires_at/attached_at; and explicit processing/ready/attached/failed/removed state. Index uploader+state+expiry and incident+scope; constrain attachment/state pairs. No original filename is an authority or an executable storage path. Do not add personal victim records or overload verification/personnel document kinds.

P1 owns staging/inspection/private response/orphan cleanup and their transactional metadata use after the schema exists. Cleanup must lease/lock an expired unattached row, mark it for removal, delete only its verified private object outside the transaction, and record the outcome. It must never delete a committed incident attachment after a request rollback. Existing historical attachments stay protected and accessible only by current source policy.

## P2 request / acceptance fixture

Publish a source-policy port taking the original observed identity + persisted incident ID, with separate attach/download purposes and locked mutation semantics. Use P1's port only after it exists; no `photo_filename` substitute. Supply fixtures for own resident, other resident, assigned/unassigned operator, inactive/removed role, administrator, other barangay, resolved/immutable incident and sanitized nearby views.

Required joint tests: actual private-byte staging/download, MIME/size/path/symlink rejection, opaque-token ownership/generation/expiry, same-intent replay/different-body conflict, exact incident revision, attach rollback plus orphan cleanup, concurrent token consumption, revoked source access, and public-root exclusions. These tests are **not passed or implemented** by the current DTO/unit test. Current executable evidence covers opaque receipt validation and unavailable authenticated routes only.
