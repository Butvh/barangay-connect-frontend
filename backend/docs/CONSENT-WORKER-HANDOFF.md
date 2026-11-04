# Current worker integration handoff

Consent agreement is complete (P2 comment6623812692/5e61893). Persistence is published at3e632f3; actual P1 CurrentSmsConsent is available at2e8161e; the existing DBA worker integration is published at83f4fa0 and refined at81daca1. [Exact current behavior, tests and remaining dependencies](CURRENT-SMS-WORKER.md).

Reservation/retry starts outside every transaction, preserves one original recipient observation, and calls the real P1 current recipient/account/appointment -> consent boundary before exact current source/event/explicit recipient/receipt -> ledger/rate/budget work on one named connection. It commits, repeats the same current authority/source/fence/lease/destination gates, commits private pre_send evidence, then uses the existing Semaphore client. No new dispatcher or provider client exists. A non-UTC MySQL session fails closed pending P1's shared connector correction.

NEW eleventh sms_authorizations migration retains private reservation/pre_send revision/policy/template/recipient/attempt/token evidence; preceding ten migrations are unchanged. This evidence neither grants consent nor proves provider delivery. Denial after a valid reservation retains conservative attempt/budget evidence. Independent in-app receipts, Make scope/credential/payload/replay checks, rate/segment/day budgets, uncertain outcomes, fencing and GET-only reconciliation remain.

Only urgent incident.created.v2 / incident_review / sms-consent.v1 / alert-review.v1 and approved nonurgent announcement.published.v2 / barangay_announcements / sms-consent.v1 / announcement-review.v1 are eligible routes. Current recipient consent is separate from content approval. Other families/legacy send requests deny.

P2 must publish actual service-produced positive/negative SMS fixtures with returned event identifiers, original command replay and source/audit/outbox rollback. Its current writer remains in-app-only. A writer-only handcrafted event or transport fixture cannot prove producer acceptance. Until that dependency is measured, configured default in-app and explicit unsupported SMS exit2 remain separate. No default-true authority or inferred phone/role/config consent is allowed.

The earlier missing-authority phase at P1bbb690e/2e70538 is historical in [persistence acceptance](CONSENT-PERSISTENCE-ACCEPTANCE.md). Normal SMS/Make/dispatch remain off; no shared/live migration, real messages, scenario/production-worker activation, merge, retarget or deployment.
