# Make/Semaphore fake-transport acceptance — November 3, 2026

This verifies DBA's existing **single dispatcher and independent channel receipts**. No live SMS, paid credits, sender change or Make activation is performed or authorized. Urgent `incident.created.v2` stays Laravel worker -> Semaphore directly; approved nonurgent `announcement.published.v2` stays Make webhook -> scoped Laravel command -> the same SMS ledger/queue. Legacy v1 pairs remain explicit compatibility cases, not new producer aliases.

## Current evidence

The full P1 c0a32cf/DBA baseline passes **178 tests / 781 assertions, zero failures/errors/skips** on PHP8.5.12, P1 locked Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43 and MySQL8.4.13. P1 subsequently published aec4e78 with a required failing actual-service lock-order regression; its separate latest-composition result is recorded in [current evidence](INTEGRATION-ACCEPTANCE.md), and is not described as green. The unchanged delivery cases cover:

- All14 registered v2 shapes in-app; exactly two permitted v2 SMS families; unknown type/version/context/template/channel combinations fail closed without false successful receipts.
- Independent event/recipient/channel/template receipts; duplicate dispatcher/send jobs and Make callbacks preserve one logical intent; completed in-app work does not repeat on SMS retries.
- Bearer/credential/tenant/type/template/timestamp scope, unknown fields and arbitrary relay data; Make payload has only the five registered reference fields and API-key authentication.
- Disabled provider, allowlist, segment/rate/daily budget,429 Retry-After and low-balance handling; no sends from a rolled-back source or unconfirmed nonurgent Make path.
- Transport timeout, malformed success and expired sending lease become **uncertain**, without blind POST retries. Reconciliation uses GET for a known provider message ID; Sent means network-sent, not handset delivery. Unknown-ID uncertainty remains on hold for operator review.
- Fencing, crash recovery, attempt exhaustion, source/recipient revocation, urgent queue isolation from a Make backlog, and durable SMS intent even when in-app fails.

New `DeliveryAcceptanceTest` adds three cases: correct bearer with wrong credential ID is denied; a callback cannot change the v2 template or manufacture SMS for an in-app-only event; and two v2 urgent deliveries contend on the same one-segment budget, leaving both in-app receipts complete while the second SMS is blocked. Exactly one fake HTTP request, one SMS attempt/reservation and no Make row are produced in the budget case. All HTTP in these tests is fake and test-only credential/recipient values are fictional.

## P2's real in-app contract and outstanding SMS intent

P2 now publishes `Persistence/TypedOutboxWriter` and `Persistence/InAppHandler`. With its explicit **disposable test bindings**, the real selected classes pass DBA's configured typed SQL/receipt probe: caller rollback and independent visibility, event-time snapshot after source progression, receipt replay, recipient revocation, scope and malformed contracts. Provider calls=0 and `sms_intent_not_requested`. This supersedes the earlier claim that no production-class candidate exists; P1's **default production selections remain null/off**, pending review.

The selected P2 writer deliberately rejects any RecipientReference with sms=true (`Use distinct in-app-only recipient references.`); Module::event also hardcodes in-app channel intent. An explicit separate fake SMS-intent probe exits2 with `p2_sms_intent_contract_not_implemented`. The working DBA SMS fixture is not evidence that a real P2 producer emits SMS.

Required P2 contract, before end-to-end SMS acceptance:

1. The authorized domain producer explicitly selects SMS-eligible recipients and channels **inside its same source transaction**. Change the existing typed writer/producer path; add no competing outbox writer or dispatcher. In-app-only remains a valid independent integration and must not be silently upgraded to SMS by workers, Make or global flags.
2. Permit SMS intent only for `incident.created.v2` (alert-review.v1, urgent direct) and `announcement.published.v2` (announcement-review.v1, approved nonurgent Make). P2/P1 must ratify eligible audiences, permissions/consent and source revocation behavior. A phone number's presence, registry entry or in-app permission is insufficient authorization. No SMS is granted to the other12 v2 families.
3. Persist distinct relational recipient in_app/sms booleans with server-derived audience, stable UUID/event-time context, scope and same-connection rollback. Never accept client phone/message/URL/template fields. Sender credentials, current destination normalization/allowlist, segment budget/rate and uncertainty remain DBA worker gates after commit.
4. Supply an actual P2 committed incident/announcement fixture carrying **explicit approved SMS intent**, plus same-intent replay/rollback/out-of-scope/denied-channel tests. Rerun the existing default in-app probe and separate sms-intent probe, then fake provider/Make timeout/replay/reconciliation tests. An authorized future live trace would require its own explicit recipient/budget approval; none is requested here.

P1 still owns reviewed class selection, scheduler/route/queue registration and required-green combined CI. Make remains an unconfigured nonurgent blueprint; no hosted scenario or operational worker success is claimed by offline fakes. See [current combined evidence](INTEGRATION-ACCEPTANCE.md) and [operations runbook](MESSAGING-RUNBOOK.md).
