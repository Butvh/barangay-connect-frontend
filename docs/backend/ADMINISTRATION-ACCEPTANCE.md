# Mandatory administration integration

Full account, verification, personnel and facility administration is required by the presenter. It is now mandatory scope, not a deferred enhancement. The verified core remains available at P1 `2e8161e7a9874af8bf88744066dacd9c43e5e776`, CI41806829977 (261 tests /1227 assertions, zero failures/errors/skips). This checkpoint does not certify full administration.

## Current measured source and remaining blockers

Published P1 **ba06fbb99218a0d9c56faec820430b62644390d9**, tree **73b4888b95dd47e5fc220651ad8c0bbe25c1ffa6**, local equivalent d01dd64eeb71a5a03433bd242619f4ae3112ae3e. Reviewed exact owner pins: DBA **8cd2740d19e311c186b261c14a5c1ac69290ae98**, P2 **b477a7c6c259f9d981380f9a2c62320b7e080329**, P2 common base ef9a57a2ea0feeb99829e7928595cc925c25bcc7. Main stays3014ad60ca41a9a5aa4d5a0152faed09d0dfdaf0. CI synthetic merge45c1952671ce2568bc0447a6075aaef27c4c2c72 has the identical tree; owner sources were not edited.

[CI41851494952](https://github.com/Butvh/barangay-connect-frontend/actions/runs/41851494952) is **failing**, with check/backend jobs passing and combined failing its genuine MySQL suite: **314 tests /1580 assertions /6 errors /0 assertion failures /0 skips**. All six errors are actual TypedOutboxWriter.php:33, `Source projection is awaiting owner integration`: profile/security, registration, facility mutation, password reset, personnel lifecycle and verification lifecycle. They remain required tests. The earlier shared-facility fixture leak is fixed in P1's fixture cleanup; the original directory test and its assertions are unchanged.

Other gates in this same CI passed: Composer strict/install/platform/locked audit; full read-only Pint; frontend/transport and19 P2 Node entries;48 portable P2 contracts; unchanged48 SQL cases plus2 original-controller branches; configured actual typed SQL/receipt probe with provider calls0 and SMS not requested; DBA actual-service order probe;5 identity and10 operational browser scenarios;5 additional administration read/form-readiness scenarios with15 responsive screenshots; artifact/private-root tests; **801 source fingerprints /237 exact owner blobs /5 explicitly reviewed overlays**. CI keeps executing these independent gates after a failing SQL suite without changing its failed conclusion.

The registration/facility create forms now retain original command keys across ambiguous retries. Public registration is guest-only; a named MySQL command lock is acquired outside source SQL, and user/household/source event/frozen safe outcome commit together. Its receipt stores no password. Facility creates use the existing ordered actor transaction and CommandReceipt; edits still require original revisions. Confirmed atomic422 validation failures release the browser intent for corrected input; network ambiguity retains it. Identical personal profile patches do not generate duplicate events. Private-document orphan traversal now has a scan cap in addition to its eligible-object limit.

New actual encrypted-job/loopback SMTP and historical private-download tests are included in the314. They use fictional recipients and real persisted associations; no external mail, carrier, worker activation or substitute production authority is involved. Private download links use the existing44px token-derived target. Normal production and administration flags remain false.

**Owner dependencies:** P2 must extend its actual writer, in-app handler and notification access for the previously specified P1 in-app-only families/recipients (latest exact handoff: PR50 comment6633821092). DBA must publish the additive facility160/300/50 field widths and immutable full-history schema (PR48 comment6632174458). Current facility action audit is not a full before/after history. Original positive photo selection and SMS producers/joint acceptance remain separate gates. No source event bypass, schema alteration in P1, test exclusion, merge or production enablement resolves these dependencies.

Reproduce in a clean snapshot from `node scripts/prepare-integration.mjs`, install the shared Composer lock, configure only matching confirmed disposable MySQL8.4 DB/DB_TEST settings and P1_COMBINED_TESTS=1, MYSQL_INTEGRATION=1, DB_TEST_DISPOSABLE=1. Supply GD and a trusted native PDFINFO_BINARY; CI uses poppler-utils. Commands:

```text
php vendor/phpunit/phpunit/phpunit -c phpunit.combined.xml --display-warnings --fail-on-warning --log-junit combined-junit.xml
php backend/tests/P2/run.php
node --experimental-vm-modules --experimental-default-type=module --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs tests/p2-form-intents.mjs tests/p2-report-forms.mjs tests/p2-official-forms.mjs tests/p2-location-forms.mjs
node scripts/run-tests.mjs
node tests/frontend-artifact.mjs
node tests/backend-artifact.mjs
P1_BROWSER_MODULE=<private locked playwright/index.mjs> node tests/browser/identity.mjs
P1_BROWSER_MODULE=<private locked playwright/index.mjs> node tests/browser/operations.mjs
P1_BROWSER_MODULE=<private locked playwright/index.mjs> node tests/browser/administration.mjs
node scripts/verify-integration.mjs
```

The PHPUnit command runs in snapshot/backend; other commands run in the snapshot root. The remaining configured probe, fresh P2 database migrations/SQL/order commands and dependency checks are recorded verbatim in .github/workflows/pages.yml. No shared database is migrated. A read/form browser pass does not certify a successful administration mutation. Linux CI reports no missing dependency or skipped test; the separate local Windows photo symlink limitation remains explicit in its own report.

## First actual-source handoff

The P1 account/profile/password/registration and facility services use the actual shared Store, AuditRecorder and OutboxWriter. They do not create substitute writers or adapter doubles. `CombinedAdministrativeTest` exercises production paths. Initial local execution against P1 dirty work based on2e816, DBA3e632f3 and P25e61893: five cases,21 assertions; two authorization/read cases passed with missing-local-env warnings; three positive writes failed at P2 TypedOutboxWriter's explicit unsupported-source guard. This is a blocker, not positive acceptance. Clean first handoff04b9773 (tree c38470fb790933347364d01b0873ea035cedb110), DBA4b4d215/P25e61893:9 tests/40 assertions,5 pass and4 errors, zero skips; all4 errors are that actual P2 unsupported-source guard. Follow-up personnel/recovery dirty snapshot based on04b9773:8 tests/61 assertions,6 pass and2 errors at the same guard. These results are not full positive acceptance. Current-pin full rerun remains required.

New HTTP administration selection requires `P1_ADMIN_TEST_BINDINGS=true` AND the existing confirmed disposable integration profile. It is false by default. Private Laravel public-root and frontend artifact isolation rules remain unchanged. No production selection, shared migration, real message or merge is authorized.

P2 owns extending its actual writer, handler and notification access to the agreed P1 event families. The exact source/recipient request is in PR50 comment6627417892. Events remain in-app only with SMSfalse. DBA owns additive facility column widening and full history persistence; see PR48 comment6627521686. Current facility columns cannot safely accept all160/300/50-character frontend limits. Do not truncate input or fake history.

## Verification persistence mapping

P1 verification submissions use the existing application revision as their immutable source version. Ordered submission rows supply display ordinals. Existing typed audit events persist the exact application revision, actor/role, action and actual timestamp. Submitted/Resubmitted events store the document type in the allowed reason field (maximum100); review events retain the actual review reason (maximum1000). Each event maps to the most recent submission version at or before its own source revision. This preserves source evidence without a competing audit writer or invented legacy events. Private document associations, filenames, MIME and sizes come from actual persisted documents. Missing historical evidence remains missing.

Private byte inspection is bounded JPEG/PNG re-encoding or a bounded native PDF structural parser. This is not an antivirus service; no malware-scanning completion is claimed. PDF selection requires a trusted configured `PDFINFO_BINARY`. Document bytes and cleanup happen outside SQL, with shared file leases spanning attachment transactions and exclusive orphan-cleanup leases. Windows retains leased orphan objects rather than deleting after an unsafe lease release.

## Mandatory follow-up now implemented, acceptance pending

P1 now has Captain personnel services (capacity including Inactive, fixed Tanod membership, busy checks, private requirements, history and identity-generation revocation), actual recovery authority and encrypted local-only mail jobs, and original form factories/readers with real File/FormData handoff. All existing frontend suites pass; added adapter checks cover shared CSRF, exact original bytes, stable retry keys, changed-byte conflict, account switching and original facility/password signatures. The standalone P1 checkout explicitly skips absent P2 factory files; the combined build must execute them unchanged.

Recovery supports only an explicitly configured loopback SMTP sink and fictional example.invalid mailboxes. No worker is activated implicitly, and no real email or SMS is sent. The configured database recovery queue inserts encrypted jobs in the same named source transaction. Wrong-portal requests do not supersede a valid other-portal challenge. Actual failed-attempt counters commit before error responses.

The latest reviewed DBA83f4fa0 adds actual current-consent worker enforcement and an eleventh additive authorization-evidence migration. Shared MySQL connections now explicitly select+00:00, as required by the worker and all stored instants. This does not enable producers, delivery or Make.

The design skills were applied to original-form integration without a redesign. DESIGN.md/UX-CONTRACT.md record existing owners and runtime tokens. A static skill audit found existing template/handler and shared-select findings; it is not a clean accessibility/browser certification. Original UI/runtime checks and a scoped finding review remain necessary.

## Still required

- Actual owner writer/handler acceptance and rollback/concurrency coverage for every new event family.
- Verification private uploads, current revision/review/correction/reapplication/expiry and authorized historical downloads through original forms.
- Captain personnel capacity, role changes, fixed Tanod membership, busy checks, private requirements and session revocation.
- Recovery with neutral challenges, bounded attempts, one-use authorization and a separately configured safe local mail boundary.
- Original frontend factories/readers, real byte handoff, responsive browser checks, full current-pin combined CI and accurate feature matrix.

These entries remain pending until their real implementation and tests pass. No hidden success flags or substitute production adapters certify them.
