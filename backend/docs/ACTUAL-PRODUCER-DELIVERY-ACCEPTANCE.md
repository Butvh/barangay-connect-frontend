# Actual producer-to-current-worker acceptance — November 5, 2026

P1's explicit UTC connector and P2's actual source-produced SMS/administrative/photo implementations supersede the older unavailable-dependency ruling. This evidence consumes P2's unchanged producer-fixture.php in this device's confirmed private MySQL8.4.13 database. It never constructs production outbox events by hand. [Machine-readable inputs, accepted attempts, gate evidence and replay](evidence/2026-11-05-produced-delivery.json).

## Exact measured composition

Current source/consumer modes: P1 **7abfd842b0a9c714a6e2d47afad4e811a98ba4e5**, P2 **9fbe5d3cb0246ab79517506ad69a09562d7e3f1b**, DBA facility schema **815c27293419797ebe3fbab4fe84daaf3580de0b** plus the consumer/tests published with this document. Fresh actual P1 schema has42 InnoDB tables,13 migrations and a +00:00 session; metadata exports show67 FK relationships. The preceding eleven migrations remain unchanged. Full current-owner suite/SQL/races/Linux/browser certification is **pending separate measurement**; the older288/1415 report does not certify this composition.

Producer source hash: 0bc53587f46db1227c0798611a7c4f78f7b9313b9b84c63d18bf98a2469e7204. Consumer source hash: d8e6a7bf88fc27905f8249d482cd81275334d5a629d483451862404ba317f0a4. Reports include their exact input SHA256. The current P1 optional-service/session-observation publication is consumed unchanged; normal optional/SMS/Make/dispatch selections remain off.

## Actual source results and independent receipts

| Mode | Incident in_app/SMS | Publication in_app/SMS | New accepted fake POSTs |
| --- | --- | --- | --- |
| positive |1/1 |2/1 |2 |
| missing |1/0 |2/0 |0 |
| revoked |1/0 |2/0 |0 |
| wrong_purpose |1/0 |2/1 |1 |

Wrong-purpose grants only publication consent to the Captain; that publication SMS is valid. Every intended fake delivery has exactly one attempt and private reservation/pre_send revision/policy/template evidence from ACTUAL CurrentSmsConsent. In-app completes through actual configured TypedOutboxWriter/InAppHandler/dispatcher receipts independently. Complete-report replays for positive/wrong_purpose add zero fake POSTs, attempts or gate rows. Default TypedOutboxWriter stays allowSmsIntent:false; its separate default --sms-intent exit2 remains denial evidence, distinct from this positive source proof.

Urgent incident events use the existing Laravel worker directly. Publication stays pending before a Make command, then the actual in-process authenticated HTTP endpoint accepts one scoped command, deduplicates replay, records the expected credential/payload hash, and the SAME worker performs one fake POST after its current gate commits. Fake/stray-request prevention is installed before temporary in-process provider/Make settings; no external Make HTTP/scenario or real provider request occurs. Accepted Queued fake responses do not prove handset delivery.

| Case | Source event | This device's event UUID | In-app/SMS | Delivery:fake provider ID |
| --- | --- | --- | --- | --- |
| positive | incident.created.v2 | 3744cfb0-e9c1-494a-8d75-034e5fd89021 | 1/1 | 4:fake 85004 |
| positive | announcement.published.v2 | 05bf13cc-f8d8-4de7-8998-df9a81b10217 | 2/1 | 5:fake 85005 |
| missing | incident.created.v2 | f4a93405-3a0f-49ff-a020-4313707f23ea | 1/0 |  |
| missing | announcement.published.v2 | 68968226-5d13-41d5-87b9-fd13264dc177 | 2/0 |  |
| revoked | incident.created.v2 | c4ed1480-9429-400b-b8ae-451ee2b502f4 | 1/0 |  |
| revoked | announcement.published.v2 | accc44e6-108b-409c-96f5-50701d6dba0c | 2/0 |  |
| wrong_purpose | incident.created.v2 | b4e26bfd-b23f-41c4-83f9-ebc10c9c50a3 | 1/0 |  |
| wrong_purpose | announcement.published.v2 | bac52b15-f2bf-463a-8f78-cdc117d52169 | 2/1 | 6:fake 85006 |

These fictional IDs identify these exact local tests. Other devices must run the owner fixture again in their own confirmed schema and use the generated report; do not import these IDs/paths as portable fixtures.

## Current-source mutation/retry tests

Focused P1 4c53718 / P2 9fbe5d3 + current DBA test matrix: **19 tests /177 assertions, zero errors/failures/warnings/skips**. This includes the unchanged P2 original-facility-key correction. The subsequent7abfd84 source modes above are separately pinned; their successes are not added into a fictional combined-suite total. The final full suite will certify one frozen combination.

ProducedEventWorkerTest invokes unchanged P2 producer-fixture.php in a child process before each case. Actual P1/P2 authority and source services then exercise consent/account/role/contact/source changes before reservation and after reservation, generation/appointment changes after original observation capture, current Make credential/scope changes, definite retry with retained conservative budget and uncertain POST without blind resend. Actual P2 retraction uses the originally captured publication revision/reason. In-app receipts remain complete when SMS denies. Scope defense includes deliberate isolated FK-bypass corruption; normal retained scoped FKs already reject a user scope move, so this is not claimed as an authorized transfer workflow. Generation tests concern the original current worker observation; an enqueue-time generation is not invented in the event contract.

Early harness-only runs are retained separately: a retraction fixture omitted its required reason/revision, a replaced HTTP stub did not select the intended429, and separate fake-provider processes reused an ID rejected by the real unique ledger. Those are fixture corrections, not P1/P2 runtime fixes. The final fake IDs derive from distinct delivery IDs. The ambiguous old claim is preserved; no blind retry is used to repair it. Earlier successful fallback/source combinations remain separately labelled.

## Lock and facility boundaries

P2 actorFor now performs a nonlocking display projection after receipt/outbox locks. Mutable commands retain declared sorted people -> exact source and locked(original observation). No whole audience/barangay lock, extra dispatcher, blind retry or owner-service patch is introduced. Current deterministic/independent service order and enabled deadlock counters remain separate gates; historical capacity allocator contention is retained rather than erased.

[Facility schema/model contract](FACILITY-PERSISTENCE-CONTRACT.md) is already published: widened160/300/50 fields, scoped immutable full history and safe downgrade. Corrected target:27/95, real fresh P1 unicode collation plus per-column overrides, prior11 upgrade, constraints/rollback/DDL and actual source destination preservation. P1 still owns atomic full-history writing/projection; current reviewed FacilityAdministration projects action-only audit history. A published table/model alone is not full facility-history feature acceptance.

## Reproduction

From a source-preserved reviewed owner composition with matching disposable DB/DB_TEST settings, APP_ENV=testing, P2_SOURCE_FIXTURE=1, all delivery/Make/dispatch environment switches false, genuine MySQL8.4, GD and P1's actual UTC connector:

~~~text
php backend/tests/P2/producer-fixture.php positive > PRIVATE_REPORT.json
php backend/tests/Compatibility/check-produced-delivery.php --fixture-report=PRIVATE_REPORT.json
~~~

Repeat missing/revoked/wrong_purpose using fresh owner-generated reports; repeat the consumer on a completed report to prove zero additional POSTs. The consumer selects actual configured adapters and P1 current authority and always fakes HTTP; a handcrafted writer-only event cannot replace the recorded producer execution chain. PHPUnit includes all unchanged owner suites plus DBA Database/Integration/Compatibility, with the real native PDFINFO_BINARY where available. No shared/live migration, real SMS/mail, activated Make, production worker, owner source/bootstrap/CI/frontend edit, merge/retarget or deployment. Keep PR48 draft.
