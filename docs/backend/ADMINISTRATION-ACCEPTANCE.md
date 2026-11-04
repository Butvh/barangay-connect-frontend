# Mandatory administration integration

Full account, verification, personnel and facility administration is required by the presenter. It is now mandatory scope, not a deferred enhancement. The verified core remains available at P1 `2e8161e7a9874af8bf88744066dacd9c43e5e776`, CI41806829977 (261 tests /1227 assertions, zero failures/errors/skips). This checkpoint does not certify full administration.

## First actual-source handoff

The P1 account/profile/password/registration and facility services use the actual shared Store, AuditRecorder and OutboxWriter. They do not create substitute writers or adapter doubles. `CombinedAdministrativeTest` exercises production paths. Initial local execution against P1 dirty work based on2e816, DBA3e632f3 and P25e61893: five cases,21 assertions; two authorization/read cases passed with missing-local-env warnings; three positive writes failed at P2 TypedOutboxWriter's explicit unsupported-source guard. This is a blocker, not positive acceptance. A clean rerun and current owner pins are required.

New HTTP administration selection requires `P1_ADMIN_TEST_BINDINGS=true` AND the existing confirmed disposable integration profile. It is false by default. Private Laravel public-root and frontend artifact isolation rules remain unchanged. No production selection, shared migration, real message or merge is authorized.

P2 owns extending its actual writer, handler and notification access to the agreed P1 event families. The exact source/recipient request is in PR50 comment6627417892. Events remain in-app only with SMSfalse. DBA owns additive facility column widening and full history persistence; see PR48 comment6627521686. Current facility columns cannot safely accept all160/300/50-character frontend limits. Do not truncate input or fake history.

## Verification persistence mapping

P1 verification submissions use the existing application revision as their immutable source version. Ordered submission rows supply display ordinals. Existing typed audit events persist the exact application revision, actor/role, action and actual timestamp. Submitted/Resubmitted events store the document type in the allowed reason field (maximum100); review events retain the actual review reason (maximum1000). Each event maps to the most recent submission version at or before its own source revision. This preserves source evidence without a competing audit writer or invented legacy events. Private document associations, filenames, MIME and sizes come from actual persisted documents. Missing historical evidence remains missing.

Private byte inspection is bounded JPEG/PNG re-encoding or a bounded native PDF structural parser. This is not an antivirus service; no malware-scanning completion is claimed. PDF selection requires a trusted configured `PDFINFO_BINARY`. Document bytes and cleanup happen outside SQL, with shared file leases spanning attachment transactions and exclusive orphan-cleanup leases. Windows retains leased orphan objects rather than deleting after an unsafe lease release.

## Still required

- Actual owner writer/handler acceptance and rollback/concurrency coverage for every new event family.
- Verification private uploads, current revision/review/correction/reapplication/expiry and authorized historical downloads through original forms.
- Captain personnel capacity, role changes, fixed Tanod membership, busy checks, private requirements and session revocation.
- Recovery with neutral challenges, bounded attempts, one-use authorization and a separately configured safe local mail boundary.
- Original frontend factories/readers, real byte handoff, responsive browser checks, full current-pin combined CI and accurate feature matrix.

These entries remain pending until their real implementation and tests pass. No hidden success flags or substitute production adapters certify them.
