# Private photo and consent handoff — November 4, 2026

Current Nov4 update: DBA1dceb0e active ninth photo migration/model and P25e61893 exact joint acceptance/consent ratification are reviewed and pinned. Photo metadata and consent approval are no longer blockers; statements below at older pins are historical. Actual P1 private bytes proceed next; consent authority waits for DBA persistence. Current-pin browser evidence and the truthful presentation feature matrix are in PR49 and PRESENTATION.md/FEATURE-MATRIX.md. Production remains off.

Reviewed P1 baseline `526ef0bc12ac54e8a654085d7617288ccb074a92`, DBA `9d6c699250078a54551944fe4e109bde0cb4fb7c`, P2 `5f3828566f73c40c9473b6b2276206ae07f17b8c`. Full pins: integration-lock.json. This supersedes the earlier missing-photo-policy request. P2 has published the exact policy; P1 adopts it. No byte service, consent authority, migration/model, producer or transport is enabled here.

## Adopted exact photo boundary

P1 reviewed the actual IncidentPhotoAuthorization/IncidentPhotoPolicy, GuardedStore::assertIncidentLocked, RelationalStore held-scope tracking and three new real SQL policy cases. No reproducible counterexample was found. Preserve the owner sources/tests; do not reimplement the accepted incident lock correction.

- assertAttach(EffectiveIdentity $observed,int $incidentId,int $expectedRevision):void requires declared actor and exact incident locks on the same connection. It reloads original generation/current role/scope, Approved verification, reporter ownership and frozen revision. Only Pending/Acknowledged allow attachment. Household permission is insufficient.
- assertDownload(EffectiveIdentity $observed,int $incidentId):void starts outside **every existing transaction**, owning a short guarded current-read transaction. Owner resident/current same-scope Captain/Secretary retain resolved access. Operators require latest active exact-role assignment on the exact unresolved source. Completed/closed/cancelled/transferred/historical/unrelated assignments confer no access.
- P1's unbound IncidentPhotos::attach now requires four arguments: (EffectiveIdentity $observed,string $uploadId,int $incidentId,int $expectedRevision):int. Pass the original submitted command revision to assertAttach **before source revision increment and photo locks**. Never infer it from current storage. No existing implementation/caller is silently upgraded.
- Caller owns source/audit/outbox/replay commit and original generation. People -> identity/appointment -> exact incident/assignment -> photo metadata. P1 moves/deletes no bytes there. Cleanup only locks metadata, never later user/source. Cleanup winning first rejects attach and rolls back the source command; attach winning makes staging cleanup ineligible.
- Download authorizes the persisted immutable incident association, then verifies immutable private bytes. An upload token/filename alone is never authority.

[DBA adoption](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6623334565); [P1 decision on48](https://github.com/Butvh/barangay-connect-frontend/pull/48#issuecomment-6623409525) and [50](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6623410722). The policy interface remains intentionally **unbound**, including the combined profile. P2 fixtures instantiate the actual production policy; binding a substitute would invalidate acceptance.

## Private-byte prerequisites and P1 boundary

DBA9d6 still has only an inactive proposal outside active migrations and no photo model. After the reviewed additive schema/model is published (original eight migrations unchanged), P1 implements:
- Reporter-owned scoped FKs; random immutable private_incident_photos key, no public symlink/URL or filename authority.
- Actual JPEG/PNG detection and bounded successful decode; input<=10MiB, edges<=8192, pixels<=16,000,000. Normalize away EXIF/location/ancillary metadata. Separate private immutable input_sha256 from actual normalized output sha256/size; no global deduplication/public digest.
- Original generation and stable stage intent: same completed input returns original token; different input conflicts; processing is explicitly retryable, never ready. Reconcile crash/orphan state without duplicate allocations.
- Unattached lifetime24h;5-minute fenced cleanup claim with fresh token on recovery. Claim/commit, delete verified bytes **outside retried SQL**, record outcome only under winning fence. Never staging-expire attached bytes. Retain attached evidence/tombstones; bound attempts/backoff and retain failures.
- Reauthorize downloads, validate private root/path/no symlink/size/hash, generated attachment name and private/no-store/nosniff.

Real malformed/spoofed/oversized/dimension/normalization/replay/HTTP tests, token/rollback/revocation/transfer/resolved/crash/orphan/fence races are **not executed** without that actual service/schema. Metadata/policy SQL does not certify bytes. Upload routes stay unavailable.

## Concrete consent schema and versions for owner agreement

P1 accepts DBA's proposed notification_preferences tuple(user_id,barangay_id,purpose,channel), scoped user FK, sms only; state granted/revoked, revision>=1, exact policy_version/template_version, recorded_by=self, granted_at/revoked_at and UTC server timestamps. Grant requires granted_at/no current revoked_at; revoke records revoked_at and retains grant evidence. Retain rows/history and audit atomically through the existing contract, without phone/message/free-form sensitive evidence. No default grant. API absence is not_granted/revision0, never fabricated persisted consent.

| Purpose | Accepted policy | Accepted template | Candidate audience before source authorization and consent |
| --- | --- | --- | --- |
| incident_review | sms-consent.v1 | alert-review.v1 | Current same-scope active Captain/Secretary in P2's actual incident in-app audience. |
| barangay_announcements | sms-consent.v1 | announcement-review.v1 | Current same-scope active Resident/Captain/Secretary in P2's actual publication audience. |

Unknown/absent/revoked/obsolete purpose/state/version denies. These are explicit **P1 decisions awaiting owner confirmation**, not joint implemented agreement. Authorized publication is content approval, distinct from recipient consent. No retroactive SMS. Role/phone/registry/global flag/Make/in-app permission never grants consent.

### Current API and transaction boundary

P1 publishes unbound interfaces in DBA's proposed namespace, without authority implementations:
- App\Services\Identity\SmsEligibilityReferences::allows(EffectiveIdentity $recipient,string $purpose):bool starts outside existing transactions, short guarded CURRENT single-recipient MySQL read. Checks original observation/current active identity/appointment/scope plus persisted state/versions. Known denial/missing preference=false; missing schema/binding/current-read capability=unavailable, never true.
- P2 must preflight **before source locks**, then intersect with the source transaction's actual authorized minimal in-app recipients. A locking current reader after incident locks introduces undeclared people; an old repeatable-read snapshot is not current authority. Preflight filters intent only, can be revoked before delivery and requires the current worker gate before positive producer enablement.
- App\Services\Identity\SmsDeliveryEligibility::withCurrentEligibility(EffectiveIdentity $recipient,string $purpose,Closure $reserve):bool starts outside any transaction. Locks recipient/account/appointment then consent, invokes $reserve(int $consentRevision,string $policyVersion,string $templateVersion):bool only if eligible, in the same named connection transaction. DBA callback performs current source authorization/ledger reservation only; private consent revision/version evidence, no provider/network/bytes. False denial skips callback. Commit before external send. Recheck each reservation/retry/final pre-send gate. Revocation before gate blocks sending; cancellation of an external request already started is not promised. Fencing/uncertain outcomes remain DBA-owned. Never lock a whole audience.

This reconciles P2 fanout with current recipient-before-source authorization; owner confirmation is required. No second writer/dispatcher/transport. Keep incident.created.v2 urgent direct Semaphore and announcement.published.v2 approved nonurgent Make -> same Laravel ledger; other new families deny SMS.

### Future self-consent endpoint (not registered)

Authenticated GET/PUT /api/v1/me/notification-preferences/{purpose}; derive user/scope from original session. PUT requires state, expected_revision(0 for absence), policy_version, template_version. Reject unknown/client user_id/recorded_by/channel/phone/message/scope overrides. Lock identity before preference, validate original generation/current scope, compare revision, mutate/audit atomically. Admin staffing authority never grants on behalf. Active owner may revoke after losing grant-eligible role. Password generation never renews consent; other-barangay consent never grants in new scope.

Proposed errors: unknown purpose/version422, stale revision409, revoked session401, role/scope403, unavailable persistence503. Self GET may show absence, never another user's preference/phone. Future real tests cover versions/purpose/revision/generation/scope, stale RR snapshot/current reads, concurrent revoke/reservation and audit rollback. No positive-consent acceptance is claimed now.

DBA owns schema/model/transport; P2 owns real producer/writer fixtures. P1 implements self authority/safe registration **after agreed persistence exists**. New P2 denial SQL preserves actual in-app-only producer/channel rejection/rollback with zero SMS attempts. Default production probe remains in-app only; optional --sms-intent is unavailable, not positive SMS acceptance. SMS/Make/dispatch/production remain off. No shared/live migration, real message, activation, deployment, merge or retarget.
