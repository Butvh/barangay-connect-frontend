# Agreed photo persistence — November 4, 2026

Reviewed P1 526ef0bc12ac54e8a654085d7617288ccb074a92 and P2 5f3828566f73c40c9473b6b2276206ae07f17b8c. Existing independent lock acceptance stands.

P1 subsequently published explicit policy adoption at a821d5dd4cb45ffc4cbe0d5bf9531e214eb308c6. Its unbound IncidentPhotos.attach now has four required arguments including original expectedRevision. DBA [accepted that handoff](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6623587475): exact policy/revision preflight belongs inside the once-miss command callback before source revision mutation/photo locks. Reauthorize original current identity/source on successful replay, then replay its original outcome without rerunning obsolete revision preflight or consuming again. P1/P2 own final caller/byte integration.

## Agreement before activation

P1's [byte/purpose decisions](https://github.com/Butvh/barangay-connect-frontend/pull/48#issuecomment-6621661192) and PHOTO-SMS-HANDOFF propose the narrower policy. P2 explicitly accepted it in [its exact policy](https://github.com/Butvh/barangay-connect-frontend/blob/5f3828566f73c40c9473b6b2276206ae07f17b8c/docs/P2-PHOTO-AUTHORIZATION.md) and [PR48](https://github.com/Butvh/barangay-connect-frontend/pull/48#issuecomment-6622379154). DBA reviewed the code and recorded adoption on [PR49](https://github.com/Butvh/barangay-connect-frontend/pull/49#issuecomment-6623333338) and [PR50](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6623334565) before activating metadata.

Attach requires the current active approved owner resident, exact Pending/Acknowledged incident, original observed generation and expected assignment revision. Download permits current owner/same-scope admin history; operators require the latest exact-role active assignment on an unresolved incident. Historical/replaced/completed/cancelled/closed/removed/inactive/cross-scope operator access denies. No counterexample was found in the reviewed code.

Attach joins the original declared same-connection people -> exact incident/assignments -> photo-row transaction. Current identity/source/revision checks precede metadata. Download starts outside any existing transaction and owns a short guarded current-read transaction, never under a photo lock. Cleanup takes metadata only and never later user/source locks. The policy remains unbound; P1 bytes and P2 command integration are still dependencies.

## Metadata and byte handoff

NEW ninth migration: [2026_11_04_000100_create_incident_photo_metadata.php](../database/migrations/2026_11_04_000100_create_incident_photo_metadata.php); original eight unchanged. The old proposal entry point delegates to it. [IncidentPhoto](../app/Models/IncidentPhoto.php) guards all mass assignment and serializes no attributes. Relations are persistence navigation, not authorization; P1 uses explicit receipt DTOs.

| Metadata | Enforced shape |
| --- | --- |
| upload_id | Unique lowercase opaque UUIDv4; no path/source authority. |
| uploader_id,barangay_id | Scoped RESTRICT user FK. |
| uploader_auth_version,intent_digest,input_sha256 | Immutable original generation, scoped HMAC intent and original-input digest; unique uploader/scope/generation/intent. |
| incident_id | Nullable until attach; scoped exact reporter-owned incident FK. No verification/personnel document-purpose reuse. |
| disk,object_key | Immutable private_incident_photos and random incident-photos/2hex/64hex key; unique disk/key. |
| mime,bytes,sha256,uploaded_at | All-or-none output evidence; JPEG/PNG,1..10MiB, lowercase hash; ready/attached requires it; write once processing -> ready. |
| state | processing,ready,attached,failed,removing,removed. No resurrection/detach/reassignment. |
| cleanup_token,cleanup_lease_until,cleanup_attempts | Removing only; UUIDv4; exact five-minute lease; expired staging; attempts1..20; recovery after old lease expiry. |
| timestamps | UTC microseconds; immutable creation/expiry <=24h; monotonic updates; attachment within upload/expiry; retained attachment/tombstone evidence. |

Indexes cover uploader/state expiry, state/expiry, state/lease recovery and scoped incident lookup. CHECKs/FKs and update trigger enforce metadata shape/immutability/lifecycle. They do not certify actual bytes.

P1 owns actual JPEG/PNG decode <=10MiB input, <=8192px each edge/16M pixels, bounded resources, normalization/ancillary metadata stripping and immutable private storage. input_sha256 describes original input; sha256/bytes describe normalized output. P1 owns safe orphan handling, private-root/symlink/hash/size verification and generated private/no-store/nosniff downloads.

Same scoped/generation intent while processing is retryable in progress, never ready. Same completed intent/input replays the original token; different input conflicts even if normalized output matches. Do not overwrite duplicates or refresh captured generation.

After P2 checks, lock the exact ready/unexpired/unclaimed upload and validate scope/uploader/generation. Consume inside the original command result/history/audit/outbox transaction. Same-command success replays its original result. Cleanup winning first denies attach and rolls back source work; attach winning first permanently excludes cleanup.

Cleanup commits its claim before byte I/O. Finalize using exact id/state/fencing token and unexpired lease; stale outcomes affect zero rows. Rotate UUIDv4 after expiry, increment attempts, retain exhausted failures. Retain removed tombstones and attached evidence indefinitely pending separate retention agreement. Staging expiry never deletes attached bytes. Actual P1/P2 service races remain required; DBA SQL fixtures do not replace them.

## Partial DDL and downgrade

MySQL commits DDL separately. up validates existing named supporting index/trigger and compares any existing table with server-canonical expected DDL, including columns/defaults/collations/checks/indexes/FKs; only AUTO_INCREMENT counters are excluded. It creates/drops only its own random empty shape-probe table. Missing compatible objects are recreated; incompatible partial objects remain intact and raise specific LogicExceptions.

Run migrations serially with CREATE/ALTER/DROP/TRIGGER privileges. Inspect incompatibility and forward-fix under review, never delete retained data to force rerun. Every row, including removed tombstones, blocks down with incident_photo_metadata_retained. Empty down drops only the agreed table/trigger and compatible supporting index. Disposable tests cover failure after the committed supporting index, missing trigger recovery, repeat up and incompatible objects.

Consent remains [unratified](SMS-CONSENT-PROPOSAL.md). No byte route, SMS producer or transport is enabled.
