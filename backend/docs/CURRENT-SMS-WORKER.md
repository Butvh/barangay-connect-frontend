# Current SMS worker — actual P1 authority integration

P1 current2e8161e/c087eb7 publishes CurrentSmsConsent. DBA now integrates the existing SmsDeliveryService with that ACTUAL SmsDeliveryEligibility boundary; no further consent approval, second dispatcher or provider client is introduced. P2 at5e61893 still produces in-app only, so actual positive P2 producer/probe acceptance remains unavailable.

## One pipeline, current gates

An outside-transaction immutable delivery/event/recipient lookup identifies one original EffectiveIdentity observation. P1 then locks current recipient/account/appointment -> consent; DBA checks exact current source, event, explicit SMS recipient/audience and receipt before ledger/rate/budget reservation. No whole-audience locks, delivery/source-first user acquisition or fresh replacement identity after denial.

The worker commits reservation, emits only an internal after-commit SmsReserved observation, then repeats the real P1 authority/current source/winning fence/lease/provider/destination gates immediately before the EXISTING Semaphore POST. Callback code has no provider/byte I/O. Revocation before that final gate blocks POST; an already-started request cannot be cancelled. Contact changes block instead of silently rerouting a frozen destination.

Only incident.created.v2 / incident_review / sms-consent.v1 / alert-review.v1 is urgent direct Laravel->Semaphore. Only active/unexpired published announcement.published.v2 / barangay_announcements / sms-consent.v1 / announcement-review.v1 uses authenticated Make->the same ledger. Current same-scope audience intersects the explicit persisted SMS recipient; no phone/config/in-app upgrade. Other families, including legacy v1 send requests, are denied by the current worker; legacy event-contract tests remain isolated.

Original outbox/independent receipts, Make authentication/scope/replay, segment/allowlist/rate/daily budget, definite-rejection retry, lease fencing, uncertain POSTs and GET-only reconciliation remain. Completion/reconciliation and denial use receipt->delivery order consistently. Expired sending claims become uncertain without acquiring people afterward or blindly resending. A valid reservation later denied retains its conservative budget/attempt/evidence; it does not imply a provider call.

## Private append-only evidence

NEW eleventh migration adds sms_authorizations; first ten migrations are unchanged. It records reservation/pre_send gate, exact delivery/attempt/fencing token, scoped recipient, purpose, consent revision, exact policy/template and checked_at UTC. FK references the actual SMS attempt and scoped user; unique delivery/token/gate prevents duplicate observation. SQL/model updates and model deletion refuse; any retained evidence blocks downgrade. Compatible missing DDL recovers after table-before-trigger interruption; incompatible objects are retained/rejected.

SmsAuthorization guards all assignment and serializes no attributes. The row records the accepted actual authority result; it is neither consent itself nor a provider/handset receipt. Scope/source/channel authorization remains checked in the guarded application callback. Internal SmsReserved is a failure-observation seam like P1 PhotoStored, not a P2 business event or additional outbox writer.

## Measured candidate and remaining gate

Targeted actual-authority/current-worker plus preserved fake transport suites: **37 tests/234 assertions,0 failures/errors/warnings/skips**, genuine disposable MySQL8.4.13, frozen P12e8161e/P25e61893. Tests invoke actual CurrentSmsConsent.change and TypedAuditRecorder, not an authority double. They cover missing/revoked/obsolete/purpose/binding/UTC denial, current account/generation/role/contact/source changes between gates, actual P2 retraction, source/attempt/budget/evidence rollback, retry/uncertainty, retained evidence/DDL recovery and independent-process actual revocation/worker blocking with an observed row-lock wait.

Refinement adds current Make enabled/credential/scope/authenticated-payload checks, repeated explicit intent checks, stable delivery-reference fencing and Manila-day budget re-reservation for definite retries or midnight between gates. The prior day reservation remains conservative evidence. Latest targeted matrix: **43 tests/272 assertions,0 errors/failures/warnings/skips**. Full published83f4fa0 worker run:282 tests/1376 assertions,0 errors/failures/warnings,1 explicit Windows symlink skip. The final refinement/full joint producer run is recorded separately.

These are transport/worker fixtures, not positive P2 producer acceptance. P2 must publish actual incident/announcement service-produced positive/negative intent, rollback/replay and pre-source consent/audience intersection. The configured positive SMS probe must consume those real producer fixtures; an actual writer alone is insufficient. Default in-app and explicit unsupported SMS exit2 remain separate until that integration is measured.

## UTC/profile handoff

The worker fails closed on a non-UTC MySQL session. A real independent-process test exposed P1's stock SYSTEM/+08 connection reading an existing UTC grant eight hours ahead, correctly rejected by the monotonic consent guard. P1 owns the shared connector fix to +00:00; no P1 config was edited here. The independent disposable child explicitly selects UTC to match MysqlDbaTestCase. Parent/child use one named MySQL database and real current authority.

Use only reviewed isolated actual P1 test bindings and fake transports. Normal production/SMS/Make/dispatch remain off. No shared/live migration, real SMS/mail, activated Make/scenario/worker, deploy, merge or retarget.
