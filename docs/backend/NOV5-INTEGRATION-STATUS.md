# P1 integration acceptance — November 5, 2026

P1 administration now has actual successful-write acceptance. Overall release and optional-photo completion remain blocked by the reproduced P2 opening-observation defect and missing resident gallery. Older unsupported-source and absent facility-schema reports below other documents are historical, not current blockers.

## Frozen candidate

P1 local **45520e49302ae03b02eda032f846af971b7fe40b**, tree **07daac93a5cfa3b42f78529a0542c8e66836a139**; DBA **f4e8df958234e0bd2b09fd1b10d749fc22c746c3**; P2 **22365ad10f05bba4d16ba1d84a8e9c9049e2aa0a**. Main remains3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0. This report's publication changes P1's SHA; final PR evidence must name its published head.

DBA b05cb64 ->f4e8df9 and P29fbe5d3 ->22365ad change documentation/evidence only. App, schema and test blobs are identical, verified with git diff. Their older reports keep their own exact tested combinations.

## Measurements — do not sum across combinations

| Gate | Exact combination | Result |
| --- | --- | --- |
| Linux CI41878055050 | P1 **8e156031e0e5afdbdb5e12a3cceaf231b1619bfe**, local identical-tree739e2fe, treee7129bc; DBA **b05cb64ffb7ee602c5b43e948c6bb2adea569c94**; P2 **9fbe5d3cb0246ab79517506ad69a09562d7e3f1b** | Backend **384 tests /2109 assertions, zero failures/errors/skips**. Overall CI failed an incorrect Secretary reassignment selector in the new photo browser; current candidate correctly uses Captain authority. The run is not called green. |
| Full local backend | P1 **71b3aaab39a395b60829b1616b254a624e55c805**; DBAb05cb64; P29fbe5d3 | **384 tests /2107 assertions, zero failures/errors, one Windows symlink-fixture skip**. GD/native PDF execute. |
| Original administration in that Linux CI | Same Linux combination | Four account/correction/profile/password/consent cases, two recovery/expiry cases and seven personnel/facility/report cases pass. Unchanged five identity, ten operational and five administration-readiness scenarios pass. |
| Current original photo browser | P145520e4; DBAf4e8df9; P222365ad | Two groups pass. Opening-observation group **fails**: one PATCH returns200, incident revision0 ->1, description changes after same-account/same-role reauthentication. |
| Actual source/fake-delivery probe | P1 **48d21634f824134e8c54c736558104119af2bcd3**; DBAb05cb64; P222365ad | positive, missing, revoked, wrong_purpose all pass through actual P2 source fixtures and DBA production-adapter probe; external HTTP fake only, zero real calls/activation. |
| Source/artifact gates | Same48d2163 combination | **837 fingerprints /259 exact owner blobs /5 reviewed common-base overlays** pass; both public-artifact boundaries and staged module graph pass. New documentation pins receive their own generated manifest/count. |

[Linux CI](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41878055050). [P2 precise browser handoff](https://github.com/Butvh/barangay-connect-frontend/pull/50#issuecomment-6637872833).

## P1 changes

- Current owner pins, exact new P2 plan admission and preserved collision/path/symlink/secret guards. Eight snapshot tests pass with the additional exact fingerprint count.
- Actual photo/consent/typed-writer ports selected only in confirmed disposable profiles. No class-presence activation, production-adapter double or substitute writer.
- Real self-only purpose consent; safe photo reader fields id/mime/bytes; association-authorized private downloads and official gallery; Captain reports registration.
- Actual DBA immutable facility model/schema, full display snapshots and projection. Source/revision/history/audit/outbox/create receipt commit together. Creation/retry/edit/pin/deactivate/reactivate, rollback, retained rescue destination, legacy no-fabrication and shared read privacy are covered.
- Expired/Rejected original verification forms create a new application. Pending/correction replacements retain the original ID/revision. The original page regression failed before correction; all eight verification-page regressions now pass.
- Real image worker explicitly retains the trusted loaded parent PHP ini. Its real-image regression covers incompatible inherited configuration; all JPEG/PNG validation/re-encoding limits remain enforced.
- Combined CI retains every owner suite and adds positive original forms, the required photo/session gate, P2 photo Node tests and four actual source/fake-delivery probes.

Original browsers use real cookie sessions, CSRF, File/FormData, actual production services and genuine disposable MySQL8.4. Positive writes cover registration committed-lost-reply retry, private documents and corrected submissions/approval, profile/password/reset/revocation, consent grant/stale denial/revoke, Inactive capacity, fixed Tanod lifecycle, busy-role denial, facility map/create/edit/status/full history, shared read-only referrals and recorded Captain reports. Missing historical actors/times remain missing.

## Photo RED and remaining work

The refined test delays only the committed upload response body. route.fetch already applies its real cookies; fulfill does not replay Set-Cookie twice. That schedule confirms PATCH200/revision0 ->1 after the old form adopts the fresh observation. A separately retained header-replay schedule returned401/no mutation and is not confused with this confirmed result.

Passing original checks include actual bytes/one staged receipt, committed lost-details-reply replay, stale original form409 with retained draft, unrelated direct404, authorized official gallery, transfer old operator404/new200 and Resolved operator404/owner+admin200. The resident alert still has no photo gallery.

1. **P2:** bind createFormSubmission/createPhotoUpload to opening session_observation, including async hashing, cached receipts and response checks. Lazily preparing the shared intent after staging adopts the new observation. Publish a minimal owner correction with RED/GREEN evidence.
2. **P2:** use the existing P1 safe gallery helper in the resident alert view. P1 did not edit that view or P2 helpers.
3. Freeze the corrected owner combination and run complete final CI. Do not suppress the required failure or enable optional integration from backend-only success.
4. Strict premium static audit reports34 existing application findings, largely dynamic action/select detection. No clean accessibility certification is claimed.

Earlier lock-order corrections pass actual SQL/race/order gates in the Linux composition. This is not a universal deadlock-free claim. Existing tests remain intact.

## Reproduction and environment

Use node scripts/prepare-integration.mjs on a clean committed P1 checkout; install the shared Composer lock in the private snapshot. Configure matching explicitly disposable MySQL8.4 DB/DB_TEST names, P1_COMBINED_TESTS=1, DB_TEST_DISPOSABLE=1, MYSQL_INTEGRATION=1, GD and trusted PDFINFO_BINARY. SMS_ENABLED, MAKE_ENABLED and OUTBOX_DISPATCH_ENABLED remain false. Exact commands and dedicated browser-schema creation are in .github/workflows/pages.yml; no existing/shared schema is dropped or reset.

Required commands include full phpunit.combined.xml --display-warnings --fail-on-warning; all unchanged P2 portable48/SQL48/two HTTP/race and DBA order gates; actual producer-fixture modes and check-produced-delivery probe; original identity/operations/administration/administration-workflows/expiry-recovery-workflows/personnel-facility-workflows/photo-workflows; Node/frontend/snapshot tests; Composer validate/install/platform/locked audit; full read-only Pint; frontend/backend artifact tests and verify-integration.mjs. Browser runners must stage sequentially per snapshot.

Windows local uploads used a private PHP ini without the unrelated failing cURL extension plus the trusted-worker-ini fix; GD/native PDF remain real. No system PHP ini changed. The missing locked Chromium binary was installed privately rather than skipping the unchanged suite. Linux uses its normal configured runtime.

## Tested core fallback and sanitized backup

Retained green checkpoint: P1 **4c537189119c2b4d9a461a14de97221eeb0c66e4**, DBA8cd2740, P29fbe5d3, CI41864559971 (331/1761, no failures/errors/skips). Fresh rehearsal of its exact runtime source passes all ten original operational scenarios in bc_dba_p1_nov5_fallback_4c.

Private evidence includes Barangay-Connect-Core-Backup-Ready.webm and Core-Backup-README.md: a sanitized40-second captioned screenshot recording from that actual rehearsal, without credentials/codes/cookies or real residents. It is a backup, not a new live execution or full-administration/photo certification. SHA256:d2a9d298fac01d47052edc327eb5f57d593938d655d2fa13e297187eeff8a40b.

No main/teammate merge or retarget, deployment, shared/live migration, real mail/SMS, Make scenario or production worker was activated. Optional and production defaults remain disabled.
