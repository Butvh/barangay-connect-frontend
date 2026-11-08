# PR51 P2 General Feedback evidence

Status: **owned implementation and focused SQL pass; NOT final browser/candidate acceptance**.

Product base: `b00d944789dada39a356ebb6497da0aae4d74049`. Ratified contract: P1 `5428762` (`PR51-followup-contract.md`). Consumed published schema: DBA `bad5d430ee4ed1efee3809028a6870e4555ab01e`, already integrated by P1 at `2911d8075c6cf18b9a99ef3b9d464a54ba387679`; P2 role merge `1c44172` preserves that ancestry. P2 branch: `codex/p2-pr51-general-feedback-20261108`. P1 remains sole PR51 integration writer; no other PR or main merge is authorized.

Published runtime/UI handoff: **`c919306396828e787caecc66a7fdfaf026a66e57`** (PR51 comments `6721011023` and `6721032735`). Later documentation-only evidence does not replace this runtime source or approve an integrated candidate. At the latest check PR51 remains draft at `2911d80`; the P2 runtime and P1 map/shared role have not yet been composed/admitted there.

## Implementation

- Existing CivicService/controller/routes provide review/archive with original key/body/revision, current actor guards, scoped source locks and atomic audit/receipt. One receipt namespace hashes action + resource + observed revision, rejecting reuse across actions/resources.
- General operational status remains NULL. Archive need not follow review; it never reviews implicitly. A fresh stale revision conflicts, fresh repeated state fails, replay re-reads the currently authorized DTO. No lifecycle event/outbox/notification is emitted.
- List query supports official active/all/only; residents retain own historical reads and cannot use the selector. Existing official page/model hides archived general queue entries while preserving historical rating/monthly statistics and full comments. Complaint/Suggestion workflows are unchanged.
- Original confirmation dialogs retain their opening submission object/key/revision through a lost reply, including reopening a failed intent. Cancellation sends no write. P1's explicit `feedback.generalLifecycleAvailable === true` plus both methods is required; demo and unadmitted paths stay disabled. P1 confirmed this capability boundary in PR51 comment `6719408770`.
- Required DBA migration/model casts are consumed unchanged from the published integration checkpoint, not implemented by P2. Original-form browser acceptance waits for the P1 shared staging/admission dependency. The new civic runner requests P1's agreed isolated `generalFeedbackTest` staging option; ordinary staging is unchanged.

## Evidence executed on the P2 worktree

| Check | Actual result |
| --- | --- |
| New real-service unit Store contracts | RED:13 missing-command failures; GREEN:13 passed after implementation. This is not MySQL acceptance. |
| New adapter/model/page contracts and existing communications forms | RED:7 feature failures; initial GREEN:18 passed. Fresh review found unused-cancelled intent retaining an obsolete revision; new reproduction failed0 versus1, then passed after explicit discard/close recovery. Including unchanged P2 adapters:27 passed. VM DOM boundaries are unit harnesses, not browser acceptance. |
| Original portable P2 contract runner | 52 passed,0 failed. |
| Original actual SQL/controller/race suite | 53 PASS on a different new MySQL8.4.13 target with the unchanged registered suite. Both SOS branches, manual dispatch, capacity/release, photo/source privacy and HTTP checks remain. |
| Unchanged actual-service lock probe | Passed:late user IDs empty, both writes committed, response rows1, victim_count0. |
| Complete combined PHP suite | Exit0:415 tests,2,432 assertions,0 failures/errors,1 Windows symlink skip;21m22s. Genuine MySQL8.4.13 on a separately created fresh schema, PHP8.5.12/PHPUnit12.5.43. Runtime source c919306; this is owned-worktree evidence, not frozen-candidate/browser acceptance. |
| Existing complete frontend test command | Passed after owned changes; no assertions removed. |
| Complete original P2 adapter/form Node command plus new General Feedback contracts | 51 passed,0 failed,0 skipped, including all original entries. |
| Existing rehearsal orchestration guard tests | Sandbox run:9 passed,2 failed because spawned temporary paths hit EPERM; unchanged rerun outside sandbox:11 passed. |
| Pint on owned PHP | Passed after formatting the new feature test. Initial sandbox formatter write was denied; scoped elevated rerun succeeded. |
| `node scripts/check.mjs` | Passed:509 files; local references/asset size checks. |
| New browser runner syntax / PHP test syntax / diff whitespace | Passed. |
| New MySQL/controller/security-generation/rollback/late-lock tests and independent-process races | Passed:6 tests,169 assertions on genuine MySQL8.4.13 / PHP8.5.12 / PHPUnit12.5.43, using the actual DBA schema and P2 services/controllers. Includes competing review/archive (one winner/one conflict) and same-intent processes (one audit/receipt). |
| Existing configured typed SQL/receipt compatibility probe | Passed against actual registered production adapters on a separate new disposable schema; provider calls0. |
| Existing actual P2 producer and DBA fake-only consumer acceptance | Four modes passed:positive,missing,revoked,wrong_purpose. Actual incident/announcement events, in-app receipts and consent gates exercised; real provider calls0, no Make scenario activated. |
| Expanded original civic browser suite | Prepared; NOT RUN pending P1's shared staging/admitted combined candidate. DBA schema is already consumed and tested. |
| Frozen PR51 independent final verdict / actual recording backup+different-target restore | Pending. Historical green baseline tests do not certify these changes. |

Commands: `php backend/tests/P2/general-feedback.php`; `php backend/tests/P2/run.php`; `node --experimental-vm-modules --test tests/general-feedback.mjs tests/p2-communications-forms.mjs tests/p2-adapters.mjs`; `node scripts/run-tests.mjs`; `node backend/tests/P2/rehearsal.test.mjs`; existing Pint on owned PHP; `node scripts/check.mjs`.

MySQL commands: `php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.combined.xml --filter P2GeneralFeedbackTest --log-junit=<private-junit>` (6/169); the same combined command without `--filter` (415/2432,one skip); unchanged `php backend/tests/P2/sql.php` (53 PASS); unchanged `php backend/tests/Review/p2-lock-order.php` (accepted). Each uses the guarded local disposable profile and disabled external delivery. The skipped `PrivatePhotoPathTest::test_object_is_never_overwritten_and_symlink_is_rejected` verifies immutable writes before the OS refuses a symlink fixture; its existing Linux check remains required.

Complete Node command retains `tests/p2-{adapters,form-intents,foundation-adapters,location-forms,official-forms,photo-form,photo-upload,report-forms,resident-photos,communications-forms}.mjs` plus `tests/general-feedback.mjs`. Existing compatibility commands are `php backend/tests/Compatibility/check-shared-contracts.php`, then `php backend/tests/P2/producer-fixture.php <mode>` and `php backend/tests/Compatibility/check-produced-delivery.php --fixture-report=<private-report>` for each of the four modes. These use the existing isolated identity/P2 bindings and fake-only harness; no shared registration was edited.

Node24 rejects the older `--experimental-default-type=module` flag; that first invocation failed before tests. The supported invocation above was used. Raw evidence is retained privately; no credentials, source objects, dumps or provider data are included here.

SQL setup/nonpasses preserved: two initial connections were refused while the existing isolated MySQL runtime was stopped/recovering; no target was created then. The initialized datadir was preserved and restarted without reset. Initial focused run:6 tests/79 assertions,2 failures/1 error because this new test configured route gates after bootstrap and its lock observer did not recognize the empty `WHERE 0 = 1` query (which locks no user rows). Fixed test-only pre-route bootstrap and precise empty-predicate handling; no production gate/shared lock helper changed. Green rerun used the same disposable target without resetting failed fixtures. First original standalone SQL attempt could not authenticate its independent worker because inherited `IDENTITY_ENABLED=false`; rerun uses a different new target with the existing required identity-enabled profile. No old assertion was removed.

Additional compatibility setup nonpasses: the initial sandbox connection was denied before schema creation. The authorized local-socket rerun created a new schema and applied unchanged migrations, then correctly refused unconfigured adapters because the profile omitted `P2_TEST_BINDINGS=true`. Reusing that disposable schema without reset and setting the existing documented CI binding produced the green compatibility/four-mode results above. The refusal was not bypassed by changing registration or replacing adapters.

Fresh read-only review found no additional new backend authorization/locking defect. Its actionable cancellation finding was corrected via RED/GREEN regression; uncertain submitted intents still retain one original key/body/revision. This review does not replace independent SQL/candidate/DBA acceptance.

## Remaining dependency/handoff

DBA's published additive schema/model SHA has been consumed unchanged and the owned real MySQL/HTTP/race tests pass. P1 next integrates the handed-off runtime after that schema, then map/shared work, admits explicit changed-file declarations and publishes one clean capability/staging checkpoint. Rehearse the original civic pages and emergency branches on that exact PR51 candidate, then request independent owner acceptance. Do not use the unadmitted P2 worktree as final browser acceptance or copy a runner over a frozen manifest. Keep PR51 draft/unmerged and external delivery off.
