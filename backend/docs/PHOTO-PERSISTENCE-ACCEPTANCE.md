# DBA photo persistence and delivery acceptance — November 4, 2026

**Subsequent consent implementation:** P2 ratification is now published at5e61893; [the additive consent persistence](SMS-CONSENT-PROPOSAL.md) supersedes the pending-P2 dependency below. All202/922 results here remain the measured photo-era run at its stated pins, not tests of the later consent migration. Actual byte/current-authority/worker/producer acceptance remains separate.

Implemented at d2a3217811b2c0ff5af5ba42fd2dc31f64269087 (tree22e5787a5ab5dc477f22c37bd5ff45be0079fbc7). PR48 remains draft, based on main. No P1/P2 service, shared Composer/bootstrap/CI or frontend was edited.

| Frozen source | Commit |
| --- | --- |
| Starting DBA |9d6c699250078a54551944fe4e109bde0cb4fb7c |
| Current P1 |a821d5dd4cb45ffc4cbe0d5bf9531e214eb308c6 |
| Current P2 |5f3828566f73c40c9473b6b2276206ae07f17b8c |
| P2 planning base |ef9a57a2ea0feeb99829e7928595cc925c25bcc7 |
| Main |3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |

Private composition: exact P1 tree plus P2 planning-base delta and DBA-owned backend source. All512 nonoverlap P1 files and90 P2 changed files match their Git blobs after CRLF text normalization; binary bytes remain exact. Five original P2-owned frontend overlays are explicitly verified against unchanged P1 main-base content. Original eight migrations match the prior DBA baseline. Combined app/config/database/routes/tests fingerprint:233 files, SHA256980edf3435eab9be8cc62c96a5141efdd1904fbb98857d3da191d65187ce4e7c. This is a private verification composition, not a merged integration branch.

## Implemented and agreed

[Photo agreement and schema/API handoff](PHOTO-METADATA-AGREEMENT.md) records owner decisions and DBA adoption before activation. One NEW ninth migration adds incident_photos (39th table), scoped uploader/reporter FKs, opaque token/private key, distinct immutable input/output evidence, bounded staging/cleanup lifecycle and recoverable partial DDL. The private model guards mass assignment and exposes no serialized attributes.

P1's exact byte decisions are adopted; P2's exact source policy is reviewed and accepted. It remains unbound and is not a byte implementation. P1's four-required-argument attach port carries original expectedRevision. Preserve idempotent replay with current identity/source authorization and the original stored command result; revision preflight occurs only on the once-miss write path before mutation/photo locks.

The existing single dispatcher, independent receipts, Semaphore and Make paths are preserved. The configured probe now identifies only P2's intentional in-app-only writer rejection as sms_intent_unsupported_in_app_only_writer, exit2. Same-text/unexpected LogicExceptions remain failures; unsupported SMS is never a positive probe.

## Exact local evidence

PHP8.5.12, MySQL Community8.4.13, unchanged P1 lockfile (Laravel13.39.0, Testbench11.3.0, PHPUnit12.5.43). Private database users are limited to named disposable test schemas; root is used only for local provisioning and enabled deadlock observation.

| Gate | Result |
| --- | --- |
| Current combined PHPUnit, all default suites plus Database/Integration/Compatibility |202 tests,922 assertions;0 errors/failures/warnings/skips |
| Metadata cases within full run |35 tests,127 assertions: fresh/seeded up, scoped/check/unique rejection, input/output pairing and immutability, lifecycle, rollback, retained downgrade refusal, fenced expiry/reclaim/stale outcomes, concurrent consumers/cleanup, partial DDL |
| Probe cases within full run |7 tests,24 assertions, including actual P2 unsupported SMS and unexpected same-text exception preservation |
| Unchanged lower-ID actual P2 transfer regression |1 test,12 assertions; sorted lower IDs, no late person lock, correct history/capacity/revision |
| Unchanged current P2 sql-cases.php |45 SQL cases plus2 nested original-controller HTTP branches pass; includes exact photo policy and real producer SMS-denial fixtures |
| Isolated unchanged P2 deterministic sql-lock-order.php rerun |Both retained cases pass with their one-outer-attempt contract; enabled lock_deadlocks0->0 |
| Unchanged independent DBA actual-service order/race review |late_user_ids=[]; actual response/details both commit,1 response,victim_count0; enabled lock_deadlocks0->0, exit0 |
| Default configured actual P2 TypedOutboxWriter/InAppHandler CLI on separate disposable fixture |exit0; rollback/visibility, event time, receipt replay, current recipient/source denial, foreign scope and invalid contract cases pass; provider_calls=0 |
| Separate configured --sms-intent CLI |exit2, BLOCKED: sms_intent_unsupported_in_app_only_writer; no positive acceptance; provider_calls=0 |
| Probe cleanup |Both fixtures have0 event/recipient/receipt/SMS-delivery/SMS-attempt rows afterward |
| Frontend/read-only owner gates |run-tests.mjs,check.mjs,frontend-artifact.mjs,backend-artifact.mjs pass;19 P2 Node entries,48 portable P2 checks and all7 integration-snapshot safety tests pass |
| Formatting |Changed DBA PHP files and complete LF-normalized combined PHP tree pass Pint --test; git diff --check passes |

The full delivery suites use rejecting/controlled HTTP fakes and cover allowed/forbidden event/channel pairs, independent receipt replay, Make scoped bearer authentication/replay/template/source checks, budgets/rates/allowlists, timeout uncertainty and reconciliation. No real provider request or actual persisted-consent authority is claimed. Missing current consent/revocation integration cannot be certified by those infrastructure fakes.

Representative commands (verification composition backend):

    php vendor/phpunit/phpunit/phpunit --configuration phpunit.photo.xml --bootstrap <private-photo-bootstrap> --display-warnings --fail-on-warning --log-junit <photo-current-combined.xml>
    php <private-bootstrap-runner>   # unchanged P2 sql-cases.php, then isolated sql-lock-order.php with enabled metric observations
    php -d auto_prepend_file=<private-photo-bootstrap> tests/Review/p2-lock-order.php
    php -d auto_prepend_file=<private-photo-bootstrap> tests/Compatibility/check-shared-contracts.php
    php -d auto_prepend_file=<private-photo-bootstrap> tests/Compatibility/check-shared-contracts.php --sms-intent

Private bootstrap selects APP_BASE_PATH, P1's actual autoloader, matching DB_TEST_*/DB_* disposable credentials, testing/UTC, P2 test bindings and fake/off transport configuration. Private phpunit.photo.xml adds DBA suites to unchanged P1 phpunit.xml; no shared bootstrap/config file is changed. Never reuse these fixture commands against a shared/live database.

DDL recovery tests inject interruption immediately after the supporting incident index commits; repair a missing trigger, rerun complete up, and reject incompatible table/index/trigger/dependency state while preserving unrelated rows/objects. MySQL's equivalent ASCII literal charset rewrites after ALTER are normalized for comparison; column charset/collation, types/defaults, keys/FKs/check expressions remain verified. There is no claim that SQL inspects/normalizes image bytes.

The first local snapshot-test attempt was prevented by sandbox Git writes in its external temp directory; the unchanged tests passed using an explicitly created workspace temp root with approved execution. This environment failure was not an owner implementation failure. Initial development-only migration/probe harness failures were corrected before the final frozen202/922 run; they are not counted as passing acceptance.

P1's original operational Chromium/identity browser acceptance is separate owner evidence at [CI41780233040](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41780233040), against its published pins before this new migration. It was not rerun or relabeled as this DBA composition's browser evidence.

## Remaining owner dependencies

- P1: review active metadata/model, implement bounded private-byte stage/normalize/store/download/fenced cleanup and joint actual-byte/token races. No byte route is enabled here.
- P1/P2: settle the four-argument attach caller/replay implementation, bind the reviewed exact policy only with real bytes, and prove source/history/audit/outbox/photo rollback and concurrent actual-service consumption/cleanup. Current DBA races are SQL metadata protocol fixtures.
- Consent: P1 and DBA accepted the exact schema/versions/current-read interfaces; P2 explicit ratification remains requested. [Concrete contract](SMS-CONSENT-PROPOSAL.md). No active consent migration/model is published before that agreement.
- After agreed consent persistence, P1 must implement/bind the real current authority, then DBA can integrate ordered recipient-before-source reservation/final pre-send/revocation into the existing worker. Missing authority remains unavailable/default-deny with production delivery off.
- P2 then supplies actual service-produced positive incident/announcement SMS fixtures. Only urgent incident.created.v2 direct Semaphore and approved nonurgent announcement.published.v2 through Make into the same ledger are permitted. Every other new producer family stays denied.

No shared/live migration, real SMS/mail, Make activation, production worker, deployment, merge or retarget occurred. Historical184/811,188/845 and199/910 results remain evidence for their own older pins, not this202/922 result.
