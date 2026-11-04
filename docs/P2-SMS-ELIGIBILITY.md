# SMS recipient authority — P2 proposal1, November4,2026

Status: **not ratified, not enabled**. Reviewed P1 96632bf, DBA 9d6c699 and previous P2 acc9f56. Current DBA migrations contain provider delivery records but no persisted notification-purpose consent. P2 Module::event emits in_app only and TypedOutboxWriter rejects sms=true. Those defaults remain unchanged. No working SMS producer or provider acceptance is claimed here.

## Exact proposed purpose/audience rules

| Event | SMS purpose | Candidates before consent | Delivery |
| --- | --- | --- | --- |
| incident.created.v2 | incident_review | Current active Captain/Secretary in the source barangay, already eligible for that incident's official in-app notification. No unassigned responder/rescuer or unrelated resident. | alert-review.v1; urgent Laravel queue -> Semaphore, bypass Make. |
| announcement.published.v2 | barangay_announcements | Current active same-barangay Resident/Captain/Secretary in P2's actual publication audience, already authorized to read the announcement. No operator-only role or cross-barangay audience is newly added. | announcement-review.v1; nonurgent Make -> authenticated scoped Laravel command -> same SMS ledger/queue. |
| Every other v2/v1 family for new producers | none | none | SMS denied; existing explicit legacy compatibility tests remain isolated. |

Proposal: publication by the authorized Captain/Secretary is the announcement content-approval event; it is not recipient consent. There is no new browser channel/phone/template input and no inferred SMS approval from a registry entry, phone number, role, global feature flag or in-app permission. P1/DBA must explicitly ratify that content-approval interpretation before implementation. Existing announcements are not retroactively enqueued.

## Concrete missing persisted authority request to DBA/P1

Proposed DBA-owned `notification_preferences` (or a reviewed equivalent) stores one row per `(user_id, barangay_id, purpose, channel)` with composite scoped user FK, channel=`sms`, purpose restricted to the two names above, state=`granted|revoked`, nonnegative revision, policy_version, template_version, granted_at, revoked_at, recorded_by and server timestamps. Purpose-specific consent must be affirmative, attributable, and revocable; absent/null/unknown purpose/policy/state always denies. Preserve consent change evidence through the existing audit pipeline; do not log phone numbers or free-form sensitive text. No new P2 migration/model is supplied.

P1 owns authenticated consent/provisioning policy and current eligibility projection, not the browser. Proposed permission: users may grant/revoke only their own purposes; an administrator cannot grant consent on another person's behalf merely because they can manage personnel. A documented lawful operational alternative would need an explicit separately ratified permission/evidence contract; none is inferred here. Staff appointment, account and scope changes affect eligibility immediately. Consent from a different barangay or purpose is never reused automatically. Password generation change does not manufacture or renew consent.

P1 supplies a reviewed server-only read boundary with the following proposed signature, after agreement:

`SmsEligibilityReferences::allows(EffectiveIdentity $recipient, string $purpose): bool`

Missing binding/data returns unavailable/default-deny, never true. The implementation validates the current observed identity, scoped persisted preference, current account/appointment, purpose and accepted policy/template version. It returns only a decision; no phone, message or private contact DTO enters P2's outbox context. P1/DBA must agree ownership/namespace and worker-side use before implementing this port. P2 does not create a fabricated interface implementation or test fixture as a production authority.

## Source transaction and delivery boundary

After ratification, the existing P2 domain event producer will intersect its authorized in-app recipient set with the agreed purpose eligibility inside the same source transaction. It will pass distinct typed `RecipientReference(userId, inApp:true, sms:<approved decision>, audience:<server derived>)` to the existing writer. The writer will persist the separate booleans and allow SMS only for the two exact v2 families above. UUID, event-time context, actor scope, replay receipts and source rollback stay unchanged. No second writer, dispatcher, webhook client or provider adapter is added.

Do not lock an entire audience or read fresh identities after incident locks to construct fanout. Candidate recipient/reference selection stays nonlocking/minimal. Consent evidence seen while constructing the event is insufficient to guarantee eligibility at delivery; DBA's worker must obtain current single-recipient authority and source authorization before reserving/sending SMS, following the reviewed recipient-before-source lock order. A revoked preference/account/role/scope or withdrawn announcement denies SMS even if the outbox previously requested it. Default-deny if that worker capability is not present. The P1/DBA handoff must settle the current-read/worker port before accepting producer integration.

DBA owns destination normalization, current contact/allowlist, one-segment/daily/rate budgets, credentials, provider attempts, fencing and uncertain outcomes after commit. Make cannot fabricate an SMS intent, change source/template/purpose or replay into another ledger. In-app delivery and SMS receipts remain independent. Provider-accepted/network-sent is not claimed as handset-delivered. Timeout after uncertain acceptance must not cause blind POST retry.

## Required tests before implementation can be enabled

1. Real P2 source services produce SMS intent only with ratified persisted positive eligibility for the matching purpose; missing binding/row, wrong purpose/scope/policy, revoked or invalid identity produce no SMS intent. New/client-supplied phone/channel/template/message fields are rejected.
2. Only the two exact families accept sms=true; all others reject it. In-app-only remains valid, with no worker/global upgrade to SMS.
3. Same command replay creates one source/event/intent; source/audit/outbox failure rolls everything back. Worker replay creates independent deduplicated channel receipts without resending completed in-app work.
4. Consent/account/role/scope/source revocation after event creation blocks SMS at the actual worker. Include stale repeatable-read snapshots, concurrent preference revocation, source retraction and worker retry.
5. DBA default in-app and separate `--sms-intent` configured-production probes plus fake Make/Semaphore timeout/authentication/replay/budget tests must all pass. Existing fake transport fixtures alone do not prove an actual P2 producer requests SMS.

Current acceptance in this slice verifies denial and preserved in-app transactions only. Agreement, new preference authority/schema and worker recheck are external dependencies. Keep SMS/Make/production dispatch off; no live recipient/budget approval or real send is requested.
