# P2 communications closure — November 6

This change is a P2 source candidate, not final composed/browser acceptance. P1 owns shared registration, composition admission and CI. DBA preserves its accepted bf2c5e8/runtime f4e8df9 implementation. The published e6a804a reader checkpoint is accepted separately; it does not expose these writes.

## Ready contract for P1

Use the existing `createP2DomainFactories`/`createCommunications` with shared authenticated envelope transport and `configureOperationalSubmissions({ createSubmissionIntent })`. No new transport, key generator, localStorage fallback or shared-helper edit is needed.

| Facade method | HTTP contract | Server authority |
|---|---|---|
| announcements.list(filters), get(id) | GET announcements, announcements/{id} | Authenticated, scoped; nonadministrators only Active |
| announcements.create(input,intent) | POST announcements, stable Idempotency-Key | Captain/Secretary; title/content/expires_at only |
| announcements.update(id,input) | PATCH announcements/{id} | Captain/Secretary; originally observed expected_revision |
| announcements.archive(id,input), retract(id,input) | POST announcements/{id}/archive or /retract | Captain/Secretary; expected_revision; retract requires reason |
| announcements.expireOverdue() | POST announcements/expire-overdue | Captain/Secretary; real existing expiry, never fake/no-op |
| feedback.list(filters), get(id) | GET feedback, feedback/{id} | Resident own; Captain/Secretary local scope |
| feedback.create(type,input,intent) | POST feedback, stable Idempotency-Key | Resident; complaint/suggestion category/description/location; general rating/comment |
| feedback.assignmentOptions(id) | GET feedback/{id}/assignment-options | Captain/Secretary; pending operational feedback only |
| feedback.assignTanod(id,tanodId,observed) | POST feedback/{id}/assignment | Captain/Secretary; tanod_id + expected_revision |
| feedback.resolve(id,observed) | POST feedback/{id}/resolution | Captain/Secretary; expected_revision |

Assignment options return `{feedback_revision,tanods:[{id,full_name}]}`. The new P2 TanodReferences read port filters active local memberships/accounts; it adds no display locks or private account fields. The existing sorted person/feedback write boundary independently rechecks current membership/eligibility. No schema/model/migration or lock-protocol replacement.

Original page consumers: Secretary Home needs feedback.list; official Announcements needs real expireOverdue before list; resident feedback creation needs stable intent and an allowlisted payload; official feedback needs assignmentOptions and original record revision. Original confirmations/layout remain. Suggestions store Pending/Assigned/Resolved, with summary-only display mappings. General feedback review/archive has no implemented contract and stays unavailable; do not invent methods or statuses.

## Retry/session rules

Create forms capture opening actor/session, retain one P1 retry key and the canonical original body. Editing an uncertain failed submission requires cancel/reopen; it cannot silently acquire a new key. Revisioned edit/archive/retract/feedback actions retain the observed revision; no read-refresh/rebase after a failed mutation. The backend uses revision concurrency for those existing actions, not a new exactly-once receipt protocol. A new confirmed action is not a replay of an old confirmation. Client rejection of a late response is not server rollback.

## Evidence and remaining gates

New `tests/p2-communications-forms.mjs` executes original page controllers with a VM DOM harness, real P1 intent helper and real P2 adapter. It is unit/controller evidence, NOT real-browser/HTTP acceptance. It covers stable publish/feedback keys and bodies, session denial, original edit/retract/feedback revisions, changed options and scoped picker. Standalone tests can explicitly set P2_TEST_SUBMISSION_HELPER to P1's unchanged helper; final composition uses its ordinary relative import. No helper is copied into this owner branch.

Portable service runner covers read-only options, foreign/role denial, inactive membership port, stale completion and no extra effects. New SQL fixture covers real membership deactivation between options and submit, limited picker fields and stale source/audit/outbox invariance. SQL execution and original registered-browser lifecycle remain pending clean P1 admission. Existing P2 rehearsal node phase includes the new controller tests; P1 should add its existing required CI/browser checks for final pins.

P1 must publish a final clean owner tuple/tree/manifest/lock/CI after adopting this P2 source. P2 then independently runs original announcement publish/edit/archive/retract, all three feedback types and operational assignment/completion, unauthorized/foreign denial, notification recipient state, remaining picker/capacity/destination scenarios and retained-data/photo restart. Never patch a frozen snapshot or relax source guards to call it final acceptance.

DBA accepted baseline persistence/fake delivery in PR48comment6677182084 and reader delta in6679127588. These are prior candidate-specific results, not new results for this change. P2 device invalid_image remains open until the actual trusted web parent/child/main-ini GD setup and real attach/decode/download are measured. No real mail/SMS/Make/dispatch, shared reset, activation, merge or deploy.
