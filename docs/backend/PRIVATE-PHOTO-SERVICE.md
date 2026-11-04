# Actual private-photo service — P1 handoff

P1 implements PrivateIncidentPhotos, PhotoInspector, PrivatePhotoObjects, PhotoCleanup and the authenticated controller. These use DBA's active IncidentPhoto metadata and P2's ACTUAL IncidentPhotoPolicy/Store. No owner source or source-command payload is edited. Normal IncidentPhotos and P2 source-policy interfaces remain unbound; original controls stay unavailable until P2's actual caller/replay/payload tests and shared registration pass.

## P2 caller contract

Stage: POST /api/v1/incident-photos, one actual multipart photo, original Idempotency-Key (8..160 ASCII letters/digits/._:-); reject other fields. Actual detected JPEG/PNG, input<=10MiB, edges<=8192, pixels<=16M. A bounded15-second/256MiB child decoder re-encodes and strips ancillary/EXIF/location metadata. GD is now an explicit platform requirement; all existing locked package versions are preserved.

Receipt201: data{upload_id,mime,bytes,expires_at}; never filename/private key/hash/owner. Same original generation/intent/input replays original token; different original input409 PHOTO_CONFLICT even if normalized output is identical. Processing503 PHOTO_PROCESSING is retryable, never ready. Invalid bytes422 PHOTO_INVALID; unavailable/expired/claimed/wrong token404 PHOTO_NOT_FOUND; identity change401. Storage/integrity failure503. Existing shared CSRF/session/rate-limit/error envelope applies.

Attach retains four required args. It invokes actual exact source authorization under caller-declared people/incident, before photo metadata and before source revision increment. Then lock the exact scoped owner token, validate generation/ready/expiry/unclaimed state and attach once. It does **no byte I/O** inside the retryable source transaction. P2 keeps its once-miss callback/source/history/audit/outbox/result transaction and reauthorizes successful replay without calling attach again. For multi-token requests, resolve immutable metadata IDs and lock ascending IDs; do not introduce inverse order. A new attachment must receive explicit source revision/audit treatment; P1 does not change plain-details semantics. Actual public payload integration remains P2-owned and disabled.

Downloads start outside any transaction, use the persisted immutable association, invoke actual current P2 source policy, then verify private-root/no symlink/hash/size. Generated attachment names, exact detected MIME, private/no-store/nosniff; no public URL/link. Actual manual transfer and explicit no-rescue resolution tests demonstrate old/current operator denial and owner/admin retained history.

## Storage, crashes and cleanup

Persist processing metadata before private immutable exclusive-create storage. Separate original input_sha256 and normalized output sha256/bytes. No caller filename/path authority; private root is constrained beneath storage/app/private and never public. A post-storage crash leaves processing metadata and its key, not an unrecorded object; retry stays processing and expiry cleanup recovers it. An internal PhotoStored observation contains metadata ID only and supports failure injection at this real boundary; it is not a business/outbox event.

PhotoCleanup::claim owns a short metadata-only transaction, expired unattached only; commit before deletion. Five-minute fencing token, bounded20 attempts,5min cleanup-failure backoff. run deletes verified private-key objects outside SQL, then finalize requires the exact winning unexpired token. Recover expired claims with new token/next attempt. Attached objects and removed tombstones remain retained. No automatic cleanup worker/schedule is activated. Before a reviewed scheduled integration, invoke this service only on the explicitly authorized disposable profile.

## Evidence boundaries

The P1 tests use actual GD bytes, real MySQL/current owner adapters/policy and Laravel HTTP. Cases cover normalization/input digest/replay/conflict, invalid/truncated/oversized/dimension/path/symlink, ownership/generation, caller/source rollback, HTTP fields/headers, manual transfer/resolved access, injected crash after actual storage, processing/orphan cleanup, expired fences/attached retention and independent-process consumer/cleanup contention. A Windows symlink fixture may honestly skip if the OS refuses creation; Linux CI must exercise it.

These tests do not replace P2's pending upload-field/receipt/source-revision/replay integration or its multi-token ordering tests. No positive photo control or SMS/Make/worker/production flag is enabled. Preserve the separate passing presentation baseline and current owner source fingerprints.
