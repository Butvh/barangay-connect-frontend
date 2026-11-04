# Mandatory administration integration

Full account, verification, personnel and facility administration is required by the presenter. It is now mandatory scope, not a deferred enhancement. The verified core remains available at P1 `2e8161e7a9874af8bf88744066dacd9c43e5e776`, CI41806829977 (261 tests /1227 assertions, zero failures/errors/skips). This checkpoint does not certify full administration.

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
