# P2 operational rehearsal — Saturday presentation

Presentation: Saturday November7,2026, Asia/Manila (time unspecified). P1 is available; DBA is temporarily unavailable. Final acceptance and merging await DBA's independent review. This runbook changes no application workflow or production activation.

## Source contract

P2's session/gallery correction is published in82897de (runtime ce9a684). P1's811ffaf checkpoint admits it and requests exact shared-dependency adoption in [PR50 comment6658121795](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6658121795). Dependency-only P244b2acf adopts these unchanged regular100644 P1 blobs:

- `assets/js/core/incident-photos.js`: `01c4bd21f4280a4f5395ff2583f3708ca168e12e`.
- `assets/js/core/runtime-config.js`: `c27d4975acf2a8055cbf74c96fb8aec5875214d0`.

P1 retains ownership. Default Runtime is demo; the existing owner staging script selects the isolated backend test profile. No competing gallery, fallback, checker exclusion or aggregate branch merge is permitted. P1's composer admits only those two exact canonical blobs and rejects divergent content. DBA remains bf2c5e8 (documentation-only descendant of runtime f4e8df9).

P1 must repin the final P2 publication and its exact-head staging guard after this tooling lands. Until that clean composition exists, these are prepared tools and prior acceptance is historical. Do not copy the runner into a frozen snapshot or alter its manifest to claim admission.

## Portable verification runner

Run from the root of P1's **clean owner-admitted composition**, with its matching locked vendor runtime and private Playwright1.64.1. No device-specific path is part of the source contract. The runner validates exact pins, invokes P1's actual source verifier and the required static check, then invokes unchanged production-service test entry points. Its7 orchestration tests are not domain/auth/database acceptance.

Set these locally; use the full40-character values P1 publishes in `integration-manifest.json` and its handoff. Supply expected pins independently from the agreed team record, rather than automatically trusting whichever manifest happens to be present.

```text
P2_CANDIDATE_P1=<agreed exact P1 SHA>
P2_CANDIDATE_DBA=<agreed exact DBA SHA>
P2_CANDIDATE_P2=<agreed exact P2 SHA>
APP_ENV=testing
SMS_ENABLED=false
MAKE_ENABLED=false
OUTBOX_DISPATCH_ENABLED=false
```

PowerShell sets variables with `$env:NAME='value'`; POSIX shells use `export NAME='value'`. Keep credentials in private local configuration. Use the agreed actual PHP8.5.12/GD/native PDF runtime through `PHP_BINARY`/its normal test configuration; never suppress platform checks.

```text
node backend/tests/P2/rehearsal.mjs preflight
node backend/tests/P2/rehearsal.mjs node
```

Expected: real source fingerprints and static graph pass; original frontend/page suites and current P2 Node tests pass. A standalone P2 checkout has no integration-manifest and correctly refuses preflight (exit2); it is not a backend test composition. Its normal `node scripts/check.mjs` and `node scripts/run-tests.mjs` still run independently. An unadmitted copied runner is also refused before the verifier starts.

## SQL and original browser phases

Have the existing P1 setup prepare a **new**, explicitly confirmed disposable schema for each phase. Do not drop/truncate/reseed an old or shared dataset. The runner never creates a database, migrates, seeds, changes flags or starts production workers. Existing test entry points remain responsible for their actual Laravel/MySQL guards; this runner's environment checks are an additional orchestration check, not database authorization.

For SQL use a fresh `p2_test_<unique>` schema. For each browser runner use a separate fresh `bc_dba_p1_<unique>` schema. Configure all of:

```text
DB_CONNECTION=mysql
DB_HOST=<verified local instance:127.0.0.1,localhost or::1>
DB_TEST_HOST=<same host>
DB_PORT=<verified explicit private instance port>
DB_TEST_PORT=<same port>
DB_DATABASE=<fresh schema for this phase>
DB_TEST_DATABASE=<same schema>
DB_USERNAME=<private test user>
DB_TEST_USERNAME=<same user>
DB_PASSWORD=<private test password>
DB_TEST_PASSWORD=<same password>
DB_TEST_DISPOSABLE=1
MYSQL_INTEGRATION=1
P1_COMBINED_TESTS=1
APP_BASE_PATH=<absolute backend directory of this exact composition>
P1_BROWSER_MODULE=<absolute private locked Playwright index.mjs; browsers only>
```

If `DBA_TEST_AUTOLOAD` is set, it must name this composition's own `backend/vendor/autoload.php`. Verify actual `SELECT VERSION(),DATABASE(),@@port` against the prepared schema/instance and actual runtime config, not just environment text. Require genuine MySQL8.4; retained/shared databases are outside this procedure. Use P1's normal APP_KEY, storage/session/GD/PDF and installed-browser prerequisites.

```text
# Fresh SQL schema:48 existing SQL cases +2 HTTP branches, then unchanged DBA order probe.
node backend/tests/P2/rehearsal.mjs sql
# New separate browser schema for EACH line:
node backend/tests/P2/rehearsal.mjs operations
node backend/tests/P2/rehearsal.mjs photos
node backend/tests/P2/rehearsal.mjs opening
```

Each phase stops at its first failed command, preserves existing checks and prints exact phase/pins/exit evidence. A passing phase is not final DBA approval or full P1 Linux CI. No new test counts should be fabricated if an entry point does not run. Save local logs and original runner reports/screenshots privately; publish only safe source IDs/state/counts/hashes.

## Short manual rehearsal on the presentation device

Use actual same-origin Laravel/MySQL with the agreed artifact and fictional accounts, not localStorage demo as backend proof. Record candidate pins, browser and runtime versions before starting; preserve the previous dataset/object root for comparison.

1. Resident sends SOS and opens details. Confirm durable alert ID and Pending timeline. Add fictional PNG/JPG/details. Lose/retry a response through the existing test harness: exactly one logical command retains File/body/key/revision. Keep immediate SOS independent of photo staging.
2. Secretary acknowledges and manually chooses a responder. Captain opens a stale picker in another tab: stale revision must conflict rather than silently replace the assignment. Check assigned responder's own incident access.
3. Responder records the current assessment. For no-rescue, complete the response and verify that explicit official resolution is still required. On another incident choose rescue-required; Captain/Secretary manually assigns a rescuer, who records an active destination and completion; official explicitly resolves it.
4. Resident timeline shows recorded stages and actual personnel/destination. Authorized gallery decodes/downloads. Unrelated resident and unassigned operator get404; transferred old operator loses access. Resolved resident/admin history remains available while operator private-photo access is denied.
5. Reauthenticate the same resident/account/role with an already-open details form, including the settled committed-upload-BODY delay. Old form must issue ZERO details PATCH and leave source revision/description unchanged. Explicit reopening succeeds. Check cached receipt/hash/import and pending-response cases through the existing regressions; a client-rejected late committed response is not server rollback.
6. Check recipient-only in-app notifications and Captain/Secretary/Responder/Rescuer screens at desktop and mobile widths. Restart the local demo using P1's runbook and verify source/private-byte persistence; do not reset prior evidence to make a result pass.

Keep existing UI/design and incomplete optional controls unchanged. No new tracking/ETA/victim/general-feedback workflow is part of this rehearsal.

## Handoff for DBA's return

Give DBA ONE exact clean P1/DBA/P2 tuple, Composer lock/manifest hashes, test commands and source-preservation evidence. Distinguish prior manual overlays, this round's local checks and P1's final Linux run. DBA independently checks scoped incident/attachment/history/audit/idempotency/outbox/receipt/ledger invariance after zero-PATCH denial and existing orphan cleanup/current fake-worker behavior. Preserve an already staged unattached object for the existing cleanup service; never delete retained source/history to conceal denial.

No real mail/SMS, Semaphore spending, external Make scenario, production worker/scheduler activation, shared/live migration/reset, main/teammate merge/retarget or deployment is authorized. Fake provider acceptance does not establish handset delivery. Final acceptance and merging remain pending until the required DBA review completes.
