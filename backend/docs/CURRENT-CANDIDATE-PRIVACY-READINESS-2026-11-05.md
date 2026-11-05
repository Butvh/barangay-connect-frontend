# Current candidate: DBA privacy and presentation handoff

Reviewed November 5, 2026, Asia/Manila. **The combined candidate is RED.** P1's required photo opening-session browser test fails; the resident photo gallery is absent. DBA preparation and the independent checks below are complete without waiting for P1. Final photo acceptance awaits P2's correction, an agreed exact composition, and P1's final shared repin/browser/full Linux CI. Optional integration and normal delivery remain disabled.

## Evidence belongs to one composition

| Input | Frozen published SHA |
| --- | --- |
| P1 PR49 | `9bc1a04b2005602de25879221042511f07a3ffa8` |
| P2 PR50 | `22365ad10f05bba4d16ba1d84a8e9c9049e2aa0a` |
| DBA PR48 runtime/tests and reviewed documentation | `f4e8df958234e0bd2b09fd1b10d749fc22c746c3` |
| Unchanged main | `3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0` |

This addendum changes documentation/evidence only. It adds no schema, worker, dispatcher, owner service, shared configuration or browser implementation. P1's facility-history writer and P2's real source producers are **resolved** dependencies. The implemented schema remains42 tables/13 migrations/67 FK relationships; the preceding11 migrations are preserved. [Facility retention contract](FACILITY-PERSISTENCE-CONTRACT.md), [schema](DATABASE-ERD.md), [dictionary](data-dictionary.md).

| Evidence | Measured result and scope |
| --- | --- |
| Reviewed [CI41883691022](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41883691022), combined job126762402177 | Overall **failure**, specifically step31, required optional-photo opening-observation acceptance. Full Linux backend **384 tests/2108 assertions/0 failures/errors/skips**. P1 reports33 passing non-photo original-browser scenarios; other source, dependency, artifact, SQL48/two HTTP/race/order and actual producer gates pass. |
| CI source | Merge `3fc6ce025a63a831793b7019524fcccb6fa0a9a4` has P1 head's tree `23dfd30f8f550336cb21c3726674f0da050d1843`. The final source-preservation step passes839 fingerprints/260 exact DBA/P2 blobs/five reviewed overlays. Deployment is skipped. |
| Independent DBA current snapshot | P1's **unchanged** `composeSnapshot` and `verifySources`, using its published integration-lock: **839 fingerprints**,154 DBA files,106 P2 files, five overlays, dirty=false. Shared Composer lock unchanged. No admission rule or source gate edited. |
| Independent current photo/current-worker target | **120 tests/709 assertions**,0 failures/errors/warnings, **1 Windows symlink-fixture skip**,03:19.550. Actual P1/P2 services, private bytes and MySQL8.4.13; fake external HTTP only. Includes metadata constraints, actual attachment/rollback/replay/privacy/cleanup races and consent/Make/budget/fencing/uncertainty. This is a selected suite, not a second full-run total. |
| Unchanged snapshot rejection tests | **8 pass**,0 failures/skips, with a private writable temporary directory. The initial sandbox run could not create seven temporary Git configurations; that setup refusal was retained and was not a source assertion failure. |
| Independent actual producer → existing worker | Four newly generated device-local modes: positive2 fake accepted POSTs; missing0; revoked0; wrong-purpose publication only1. One intended attempt and reservation/pre_send evidence per accepted delivery. Actual configured typed writer/in-app handler/current P1 authority; urgent direct delivery and recorded authenticated Make command use the same ledger. |
| Completed-report replay | Positive and wrong-purpose each add **0 POSTs/attempts/authority rows**. Existing independent in-app receipts remain complete. |
| Separate configured probes | In-app **exit0**; default SMS-intent **expected exit2**, `sms_intent_unsupported_in_app_only_writer`. Each leaves0 outbox/recipient/receipt/SMS/attempt/authorization rows. Exit2 is intentional denial, not positive SMS acceptance. |

The selected Windows skip is `PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected`; the reviewed Linux full suite executes it successfully. The older [04cf76c/9fbe5d3/b05cb64 matrix](JOINT-CURRENT-ACCEPTANCE-2026-11-05.md),383/2104, and earlier380/2063 checkpoint are retained historical evidence. Neither total certifies P19bc1a04 and none of these counts are added together. [Current machine-readable review and local source evidence](evidence/2026-11-05-current-candidate-review.json).

## Exact P2 photo boundary to review

The [settled owner reproduction](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6637872833) records one PATCH, HTTP200, incident revision0→1 and changed description after same-account/same-role reauthentication. Current CI fails the same zero-PATCH assertion. This is different from the retained header-reapplication schedule that returned401 without mutation: the failing schedule delays the already-committed staging response **body**, applies real cookies once, performs real logout/login and `Auth.refresh`, then releases the body.

P2 owns the opening `session_observation` fence in `createFormSubmission`/`createPhotoUpload` and resident gallery. Review it across opening→first submission, async byte hashing, in-flight upload response, cached receipt and later retry. Preserve the original File, body, key and submitted revision. A new observation requires reopening; an old form cannot prepare a fresh command under it. P1 already supplies the opaque session observation, shared transport and safe gallery/download reader. A server rejection after issuing PATCH does not meet the browser's zero-PATCH requirement.

For the corrected zero-PATCH schedule, compare the **specific original source and its related rows** immediately before releasing the staged response and after all handlers settle:

| Boundary | Required unchanged state |
| --- | --- |
| Incident and retention | Original `emergency_alerts` fields/revision, assignments/responses/rescues, `incident_status_history`, existing attachments and unrelated retained histories. |
| Photo metadata | Existing attachment IDs/state/incident/attached_at/digests unchanged; no new attachment. The already-committed staging token may remain `ready`, unattached, with its original expiry/bytes. No token reuse, reparenting or deletion to disguise denial. |
| Transaction evidence | No new source `activity_logs`, details `idempotency_requests` outcome, matching outbox/recipient row, notification, channel receipt, SMS delivery/attempt/authority evidence or Make command caused by that stale form. Compare scoped IDs/row hashes, not global counts during unrelated work. |
| Session changes | Real login/logout session rotation is expected; do not confuse it with source mutation. No sensitive values, object keys, upload tokens, contacts or cookie bytes enter public evidence. |

A staged orphan is handled only by the existing P1 expired-unattached `PhotoCleanup`. It claims metadata with a fenced lease, deletes the verified private object **outside** SQL, then finalizes a retained tombstone. Attached rows are excluded; retained source/history is not deleted after denial. Existing actor→exact incident→metadata-ID order, original locked identity/revision, once-miss attachment and committed replay stay intact. No new lock protocol or schema is requested. [DBA owner feedback](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6651172229).

The selected server tests are green, but they cannot establish the missing original-form fence or resident rendering. DBA will review the published correction only at these persistence/privacy/delivery boundaries. P1/P2 retain their original full suites and browser ownership.

## Presentation checklist

- **Freeze and label:** use one source-preserved owner composition, one matching private dataset/object root and the same presentation-machine artifact. Record SHA/manifest and stage only the allowlisted frontend. Keep the photo gap visible until corrected and certified; do not suppress the required test or change original workflows.
- **Queue prerequisites:** actual reviewed bindings, committed outbox, UTC MySQL, database queue with `after_commit=true`, retry_after180 greater than SMS lease90 and job timeout30. When separately approved for a host, supervise `messaging-control`, `sms-urgent`, `sms-default`, `sms-reconcile` and `automation`; one dispatcher, independent channel receipts. The registered dispatch schedule is conditional on the normally disabled dispatch flag. A runbook command is not evidence a worker is running.
- **Scheduler and cleanup:** host cron/supervision/heartbeats must be demonstrated. P1's bounded `PhotoCleanup::run` is implemented and tested; **no production cleanup schedule/command is registered in this frozen source**. P1/host operator must review that registration, private-root permissions, expiry/backoff/lease handling and attached retention. Verification expiry/recovery mail retain P1 ownership. Do not start cron, workers or cleanup against shared/live data under this handoff.
- **Current authority:** only `incident.created.v2`/`incident_review`/`alert-review.v1` is urgent; only `announcement.published.v2`/`barangay_announcements`/`announcement-review.v1` uses approved nonurgent Make. Require current exact purpose/policy/template consent, active account, eligible role/appointment, same scope, unchanged contact/generation and current source at reservation/retry and final pre_send. Phone presence, in-app intent and content approval are not consent.
- **Honest fake results:** actual source SQL, private bytes, configured adapters, current authority and ledger are real local tests. Semaphore HTTP is fake; Make callback is authenticated **in-process HTTP**, with scoped credential/payload record and replay. No external Make scenario, real sender, spending, carrier or handset acceptance is established.
- **Uncertain send:** timeout/ambiguous success/lost sending lease stays uncertain; retain attempt, fence, budget and authority evidence. Never reset/delete receipts or automatically POST again. Reconcile an exact known provider ID with GET; without one, operator evidence/review is required. Definite bounded retry rechecks current authority and the current Manila-day budget; an earlier reservation is not automatically refunded. Observe oldest outbox/queue age, exhausted claims, uncertain rows and failed jobs using safe IDs/states only.
- **Backup and reset:** require separate approval and a verified backup/restore plan before any shared change. Back up database, private objects/manifests and decryption/recovery keys privately; restore to an isolated name/root and check integrity/file hashes. For the fictional presentation use P1's existing launcher and a **new uniquely named confirmed disposable schema**. Preserve the previous source, dataset, bytes and evidence; do not DROP, truncate, migrate:fresh or re-seed retained/shared data. This round used four new fixtures and preserved all prior evidence.
- **Defaults off:** `SMS_ENABLED=false`, `MAKE_ENABLED=false`, `OUTBOX_DISPATCH_ENABLED=false`, `P2_MODULES_ENABLED=false`; optional photo/consent/SMS-intent selection is restricted to the confirmed disposable test profile. No production worker, scenario, real mail/SMS, merge/retarget or deployment is authorized. If real SMS is required later, obtain approved account/API key, sender, explicit bounded budget, allowlisted consenting recipient/purpose/template, supervised host/queue and separate authorization before a bounded trace.

Use the same frozen machine for rehearsal/restart. The November5 presentation cutoff remains5PM Asia/Manila; final owner gates must be reported as pending if unavailable. Preparation does not create release or external-send authorization.

## Exact local commands and next owner gate

Private paths below are relative to the review work area; credentials remain in protected local configuration and are not part of published evidence. The unchanged shared lock was used; only private runtime/autoload/cache/configuration was generated.

```text
git fetch origin
git worktree add --detach ../dba-current9bc-p1-source 9bc1a04b2005602de25879221042511f07a3ffa8
node prepare-current9bc-review.mjs
composer dump-autoload --no-scripts --no-interaction --optimize
node scripts/verify-integration.mjs
node --test tests/integration-snapshot.mjs
php -d auto_prepend_file=../../current9bc-bootstrap.php vendor/phpunit/phpunit/phpunit -c phpunit.dba-current.xml --filter "IncidentPhotoProposalTest|CombinedPrivatePhotoTest|P2IncidentPhotoCommandTest|PhotoInspectionTest|PrivatePhotoPathTest|CurrentSmsWorkerTest|ProducedEventWorkerTest|SmsUncertainSendTest|MakeReplayTest" --display-warnings --fail-on-warning --log-junit ../../current9bc-photo-worker.xml
php current9bc-delivery-checks.php --prepared
```

Native GD and private PDF inspector were available. Each fresh setup report confirms42 tables and the actual `+00:00` connector. The guarded source runner generates this device's eight events; never import another device's UUIDs. Failed private runner attempts are retained: first a syntax error, then a child inherited an old `$_SERVER` database despite changed `getenv`/`$_ENV`; the unchanged production fixture correctly refused the mismatched confirmation. Only the private harness was corrected to align the explicit child environment. No refused attempt is counted as acceptance and no owner guard was weakened.

After P2 publishes: agree exact private pins with the owners, inspect its delta, run unchanged source-preservation checks, the actual photo metadata/replay/privacy targets and original producer modes→existing fake worker, plus separate default probes. Re-run accepted locking schedules if the final runtime changes their boundary or a meaningful defect is reproduced; do not churn unrelated migrations or request a new protocol without evidence. P1 later owns final shared repinning, resident gallery/opening-session original-browser assertions and one complete required-green Linux CI. Current task completion is **preparation and independently measured baseline**, not that future certification.
