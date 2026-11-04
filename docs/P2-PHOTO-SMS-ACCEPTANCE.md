# P2 photo/SMS contract acceptance — November 4, 2026

This follow-up starts at P2 `acc9f56f37d34c96021c415ab81612bef92dac63`. PR50 remains draft and stacked on planning47. The published commit identifies the tested P2 tree; the [manifest](P2-INTEGRATION-MANIFEST.json) records its canonical-LF sources and exact owner blobs.

## Frozen sources and ownership

| Source | Revision |
| --- | --- |
| Current P1 #49 | 96632bfe320997b3e239be6dbe9444f7ff18b151 |
| Current DBA #48 | 9d6c699250078a54551944fe4e109bde0cb4fb7c |
| Unchanged main | 3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0 |

Both owners independently accepted acc9f56's current lock correction in their November4 updates. No newly reproduced P2 locking defect was reported; no second lock rewrite or relaxed regression was introduced. The current composition retains the newer P1 identity/registration/polling tests and DBA lower-ID transfer regression unchanged. All142 P1 and120 DBA changed-file Git blobs match; all79 P2 PHP/JS/test source hashes match. No P1 registration/account/admin source, DBA migration/model/transport, Composer lock/bootstrap/CI, original UI, main or teammate branch was edited.

## Deliverable status

- [Exact photo port](P2-PHOTO-AUTHORIZATION.md): executable but **unbound**. Separate attach/download operations accept original P1 EffectiveIdentity and exact persisted incident ID. Attach checks declared actor/incident guards, current approval and original revision; only Pending/Acknowledged owner attachment is proposed. Active assigned operators read unresolved photos only; completed/closed/transferred/cancelled operators do not, and only owner/admin retain resolved history. Download owns a short authorization transaction, outside any existing transaction. These narrower rules reconcile P1's new handoff with the earlier broad candidate; concrete binding still requires owner agreement.
- [SMS authority](P2-SMS-ELIGIBILITY.md): concrete purpose/audience/template/consent proposal with exact missing preference fields and a proposed P1 decision seam. Actual producers and writer remain in-app-only. Current schema has no reviewed purpose/template-version consent authority. No positive consent fixture, SMS producer, worker registration or real send is fabricated.
- Private byte attach/replay/cleanup integration waits for reviewed DBA additive metadata/model and actual P1 bytes. SMS-positive acceptance waits for ratified eligibility, persistence and delivery-time revocation checks. Existing controls and production/dispatch/Make remain disabled. Original fully registered Chromium acceptance is P1-owned; the P2 HTTP/controller tests below are not a substitute.

## Measured results

PHP8.5.12, Laravel13.39.0, Testbench11.3.0, PHPUnit12.5.43, genuine MySQL Community8.4.13/InnoDB, Node24.15.0. Only isolated disposable local databases were used; no shared/live data or provider action.

| Check | Result |
| --- | --- |
| All unchanged composed Unit/Feature/Database/Integration/Compatibility suites | **186 tests /836 assertions;0 failures/errors/skips**, including P1 current lock and source gates, and DBA lower-ID transfer. Evidence DB bc_dba_p1_p2final_1793764006667. |
| Full P2 SQL/HTTP/independent-process concurrency runner | **45 cases**, plus2 original-controller workflow branches, pass. Includes the previous deterministic one-attempt assignment/details lock regression and all four new photo/SMS cases. Evidence DB p2_test_1793764006923. |
| DBA unchanged manual actual-service lock review, isolated after suites | late_user_ids=[], both real response/details commands commit,1 response/victim_count0; lock_order_accepted=true. Enabled InnoDB lock_deadlocks **1->1** during this schedule. No universal-deadlock claim. |
| Actual configured in-app production adapters | Selected TypedOutboxWriter/InAppHandler; caller rollback, event time, independent receipts/replay, scope/revocation/malformed typed contracts pass; provider calls0. Evidence DB bc_dba_p2_finalprobe_1793764703541. |
| Separate SMS-intent production-adapter probe | **Unavailable, not positive acceptance**: unchanged CLI exits2 `configured_contract_probe_failed`. Private direct invocation of the same probe confirms intentional writer LogicException `Use distinct in-app-only recipient references.` and provider attempts0. Evidence DB bc_dba_p2_smsdenial_1793765050771. DBA can improve the unsupported-intent diagnostic; no checker was modified. |
| Existing frontend / portable P2 | All405 existing frontend checks and48 portable domain checks pass. Frontend layout unchanged. |
| Shared interfaces and original controllers |19 P2 Node entries;8 actual P2 factory/shared-HTTP checks;16 shared transport checks pass. Original-controller SOS -> manual responder -> assessment -> rescue/no-rescue -> explicit resolution, frozen retries/revisions and privacy remain covered over actual cookie/CSRF HTTP/MySQL. |
| New unchanged P1 helper/registration/polling/snapshot checks |8 Node entries pass, including6 snapshot composition cases and registration/polling scripts. |
| Style / dependencies / artifacts | Read-only Pint226 published-owner/P2 PHP files passes. Composer strict validation/platform requirements/locked audit passes with no advisories. Both frontend/backend artifact suites and actual staged-module graph pass; static source scanner passes. |

The first source-policy regression failed because the policy did not exist. After newer owner heads appeared, the Pending/Acknowledged restriction failed `Expected INVALID_STATE` against the broader draft, then passed after narrowing the policy. Enum/default/one-active-SOS fixture mistakes were corrected without weakening production checks. A temporary-Git sandbox denial in P1 snapshot tests was rerun with the required filesystem access. The earlier181/796 old-owner run is retained privately but does not replace the current186/836 result. Missing P1 files in the standalone P2 checkout are composed dependencies, not copied into the branch.

One fresh whole-change reviewer found no actionable issues. The subsequent owner-state reconciliation is covered by the new RED->GREEN assertion and the complete current suites. Decisions and remaining gates are recorded in the [execution ledger](superpowers/plans/2026-11-04-p2-photo-sms-contracts.md).

## Reproduction and remaining handoff

Compose the exact owner blobs and this P2 tree in a private checkout with P1's unchanged lock; retain all suites and explicit reviewed test bindings. Use the existing [reproduction commands](P2-COMPATIBILITY.md#reproduction), `backend/tests/P2/run-sql.ps1`, and DBA `backend/tests/Review/p2-lock-order.php`. Run the unchanged configured-adapter CLI separately on fresh disposable schemas for default in-app and `--sms-intent`; the latter remains unavailable. Never infer positive producer or consent acceptance from fake transports alone.

P1 must pin this new P2 head, review/register the exact policy only after agreement and dependencies, and finish its original-browser gate. DBA must review the reporter-owned metadata/ordered-photo-row/cleanup conflict contract, agree the proposed consent fields and publish only owner-approved additive persistence. No merge/retarget, deployment, shared migration, worker activation, Make or real messages are authorized by this acceptance record.
