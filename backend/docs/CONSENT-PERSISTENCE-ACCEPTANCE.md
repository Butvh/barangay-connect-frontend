# Ratified consent persistence acceptance — November4, 2026

Persistence was published immediately for P1 at **3e632f37e5090295b665c0a0907c492d34af9997**, tree b84d761194731588487a01b7fc61c85246051eec, before the full-suite/worker phase. PR48 remains draft on main. P2 approval is complete; no additional user or owner approval request blocks persistence.

## Exact frozen inputs

| Owner | Commit |
| --- | --- |
| Starting DBA |1dceb0e4234d8bbfd1d467164f257ab45e574bab |
| P1 |bbb690eda11b6be419ead37fe36bc93edbf59920 |
| P2 |5e61893861f04f652f4106a3ed923ab461b6a86b |
| P2 planning base |ef9a57a2ea0feeb99829e7928595cc925c25bcc7 |
| Main |3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |

Private composition preserves516 nonoverlap P1 tracked files and93 P2 changed files exactly after checkout CRLF normalization, with five explicitly verified original P2 frontend overlays. Binary bytes stay exact. All nine preceding migrations match the starting DBA Git blobs. Combined app/config/database/routes/tests fingerprint:239 files, SHA256 **5c13f829962867dacbd5e145db31b75ed275d37ae74114f8b92fc27f2813fac6**. No P1/P2 service/shared Composer/bootstrap/CI/frontend source was edited.

## Implemented persistence and handoff

[Ratified consent contract/fields/API/error/audit handoff](SMS-CONSENT-PROPOSAL.md). One NEW tenth migration/model adds the40th table: scoped self-only user/recorded_by, tuple uniqueness, two exact purposes/sms, explicit state, safe persisted revision>=1, exact policy/template pairs and UTC microsecond chronology. Identity and prior-grant evidence are guarded; next revision is exactly+1. No grant/default/revision0 is seeded. Existing typed audit is atomic with preference changes, using supported user resource/status/revision/server-generated bounded reason. Eloquent deletion and retained-data downgrade refuse.

Actual MySQL metadata generated [the40-table/63-relationship ERD](DATABASE-ERD.md) and [consent column dictionary](data-dictionary.md#notification_preferences-additive-november4); no proposed tables, row data or credentials are included. Ten migrations define40 tables; Laravel's own migration-tracking table is additional when Artisan manages them.

Photo metadata/migration remain unchanged: reporter scope, immutable input/output evidence, private serialization,24h staging, five-minute fenced cleanup, retained attached/tombstone evidence. [Multi-token handoff](PHOTO-METADATA-AGREEMENT.md) requires ascending immutable metadata IDs after all sorted people/source locks. SQL metadata acceptance does not establish actual P1 bytes.

## Measured execution

PHP8.5.12, genuine MySQL Community8.4.13/InnoDB, unchanged P1 locked Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43. New whitelisted local disposable schemas use a scoped test account; root is used only for local provisioning and enabled deadlock observation. SQL suites, probes and heavy frontend/style runs were sequential.

| Gate | Result |
| --- | --- |
| Immediate consent persistence suite |29 tests/102 assertions;0 failures/errors/warnings/skips |
| Full current owner/DBA PHPUnit composition |**231 tests/1024 assertions;0 failures/errors/warnings/skips** |
| Existing photo cases, within full run |35 tests/127 assertions retained |
| Lower-ID actual P2 transfer, within full run |1 test/12 assertions retained |
| Actual P2 SQL suite |48 SQL cases +2 nested original-controller HTTP branches pass |
| Isolated unchanged P2 deterministic lock-order cases |Both pass; original one-outer-attempt contract retained; enabled lock_deadlocks0->0 |
| Isolated unchanged independent DBA actual-service order/race |late_user_ids=[]; response/details both commit;1 response/victim_count0; enabled lock_deadlocks0->0; exit0 |
| Configured ACTUAL P2 TypedOutboxWriter/InAppHandler, separate fresh fixture |Default in-app CLI exit0; rollback/visibility/time/replay/current recipient-source denial/foreign-scope/contract checks pass |
| Configured separate --sms-intent fixture |Expected exit2: sms_intent_unsupported_in_app_only_writer; unavailable, never positive SMS acceptance |
| Provider effects/probe cleanup |provider_calls=0; each probe leaves0 event/recipient/receipt/SMS-delivery/SMS-attempt rows |
| Read-only frontend/artifacts |run-tests.mjs/check.mjs/frontend-artifact.mjs/backend-artifact.mjs pass;19 P2 Node entries,48 portable P2 checks and7 integration-snapshot safety tests pass |
| Formatting/source integrity |Complete LF-normalized combined PHP tree passes Pint --test; diff --check and owner hashes pass |

The29 persistence cases exercise fresh/fictional-seeded up, no seeded consent, scoped FK/self/unique/state/version/revision/time constraints, exact revision CAS, concurrent creation/revocation conflicts, stale RR versus current locking read, private model relations/serialization, actual existing TypedAuditRecorder atomic commit and rollback on source/audit failure, retained revoke/downgrade safety and compatible partial-DDL recovery after committed table-before-trigger failure. Incompatible table/trigger objects remain intact and are rejected. CAS/current-read fixtures are persistence protocol tests, not a fabricated implementation of P1 authority.

Existing fake-only transport suites retain independent receipt replay, forbidden channels, Make bearer/event/scope/template/replay, allowlist/rate/segment/daily budgets, timeout uncertainty and GET-only reconciliation. They do not establish real persisted-consent worker authority or positive P2 production. No carrier/Make external delivery was measured.

Representative commands from the private composition backend:

    php vendor/phpunit/phpunit/phpunit --configuration phpunit.consent.xml --bootstrap <private-consent-bootstrap> --filter NotificationPreferenceTest --display-warnings --fail-on-warning
    php vendor/phpunit/phpunit/phpunit --configuration phpunit.consent.xml --bootstrap <private-consent-bootstrap> --display-warnings --fail-on-warning --log-junit <consent-current-combined.xml>
    php <private-consent-runner>  # unchanged P2 sql-cases.php, isolated sql-lock-order.php and enabled metric observations
    php -d auto_prepend_file=<private-consent-bootstrap> tests/Review/p2-lock-order.php
    php -d auto_prepend_file=<private-consent-bootstrap> tests/Compatibility/check-shared-contracts.php
    php -d auto_prepend_file=<private-consent-bootstrap> tests/Compatibility/check-shared-contracts.php --sms-intent
    node --test tests/integration-snapshot.mjs

Private bootstrap supplies APP_BASE_PATH, actual owner autoload/source, matching DB_*/DB_TEST_* whitelisted schemas, UTC/testing/test bindings and fake/off transports. Private phpunit.consent.xml adds DBA suites to unchanged P1 config. No private credentials/bootstrap/vendor files are committed. Source preservation, counts, fingerprints, JUnit, SQL metrics and probe diagnostics are exported separately.

P1's own [original Chromium/combined CI41799565014](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41799565014) succeeds for its baseline bbb690e with OLD DBA1dceb0e/P25e61893. It is separate core-fallback evidence, not browser certification of this new consent schema. DBA [CI41802319475](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41802319475) succeeds for persistence3e632f3; that static check is not a substitute for the measured MySQL suites above.

## Runtime dependencies and presentation

### Supplemental actual-photo head, separately measured

During this task P1 published actual private-photo code at **2e70538e3429edf8023d3232e8c1b25f051911fa**, pinned to DBA3e632f3/P25e61893. The original231/1024 source and reports were frozen before copying that exact P1 delta into the private composition. The new head preserves528 P1 nonoverlap files/93 P2 changed files and the same five verified overlays/nine preceding migrations. New app/config/database/routes/tests fingerprint:250 files, SHA256 **67f771d8c42b46476f92961986813c902f0f556b26552a44eae4db13eaa47ccc**.

The unchanged P1 photo-focused run is20 tests/109 assertions, including all12 CombinedPrivatePhotoTest service/HTTP/concurrency cases with96 assertions and zero skips. The newer FULL run is **251 tests/1133 assertions,0 failures/errors/warnings,1 skip**: Windows refused the symlink fixture in PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected. This limitation remains explicit; no owner test was weakened or converted to a pass. P1's [matching Linux CI41803733356](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41803733356) passed check/backend/combined, including MySQL/P2 SQL and original identity/operational browser steps, at its published DBA3e632f3/P25e61893 pins.

Actual bounded GD decoding/normalization, private storage/download/headers, original input versus output evidence, scope/generation, rollback, processing/crash/orphan handling, real independent consumers/cleanup/fences and retained attached bytes now have measured P1 service tests against the unchanged DBA schema. Parent/decoder child GD was enabled with a private PHP_INI_SCAN_DIR; shared php.ini was not changed. New unchanged P1 Composer lock/platform validation passes, including ext-gd; all117 locked package versions are retained.

The newer head's separate fresh48-case P2 SQL/+2 HTTP run also passes, followed by both isolated deterministic cases and the independent actual-service gate. Its BROADER race batch recorded enabled lock_deadlocks0->2; do not report that whole run as deadlock-free. The latest retained engine observation identifies only this fixture's capacity_guards/PRIMARY with insert-intention contention; no query/row data is exported. The isolated deterministic and manual order gates each measure2->2, no late users, both actual commands committed. This observation is handed to P2 for allocator-contention review under the existing retry contract; no new lock inversion is inferred and no owner service/test is rewritten.

Separate new-head configured probes again produce default exit0 and SMS unsupported exit2, provider_calls0 and zero event/delivery/attempt residue. These results have separate filenames from the original baseline.

This supersedes absent-byte-implementation statements at earlier pins. It does not certify P2's still-disabled public upload/caller/multi-token/replay integration or positive controls. Current consent authority is still absent: the newer head retains only the two unbound SMS interfaces, so the worker/producer SMS phase is still dependency-gated.

P1bbb690e still publishes only unbound SmsEligibilityReferences/SmsDeliveryEligibility interfaces. Actual current authority is absent. [Worker handoff](CONSENT-WORKER-HANDOFF.md) explains the required refactor from the existing delivery-first claim to recipient/account/appointment -> consent -> current source/ledger reservation, then retry/final pre-send gates and private evidence. It cannot be wired or certified using a default-true fixture.

P1 must implement current self-consent/authority against the now-published persistence; actual private bytes are now published/tested as described above, with final P2 caller integration pending. DBA integrates the existing worker only after actual authority is published; P2 supplies actual positive/negative source-service SMS intent. Missing/revoked/version/scope/role/source denial must reserve/send nothing. Only urgent incident.created.v2 direct Semaphore and approved nonurgent announcement.published.v2 via authenticated Make->same ledger are permitted. Positive configured SMS probe and concurrent actual authority/revocation acceptance remain unavailable.

[Presentation handout](DBA-PRESENTATION.md) supplies the implemented ERD, transaction/outbox/queue/ledger explanation, the existing P1 isolated fictional prepare/restart/new-schema-reset profile and real-versus-fake limits. P1 must review/repin new DBA files for its original browser/current snapshot; no source-preservation bypass or competing scaffold/seed is introduced. No fabricated consent is added to the presenter dataset.

Keep the tested core fallback tonight8PM Asia/Manila, stretch acceptance by Nov5 8AM, noon freeze,2PM full checks,3PM rehearsal,4PM restart/restore and5PM presentation. No shared/live migration, real SMS/mail, Make activation, production worker/deploy, merge/retarget or destructive existing-data reset occurred.
