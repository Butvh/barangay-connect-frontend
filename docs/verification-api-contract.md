# Residency verification: Laravel integration contract

This frontend currently uses `Api.verification` in `assets/js/core/api.js` and browser storage. Its role checks and revision guards demonstrate behavior only. They are not security boundaries. No Laravel application, MySQL database, binary upload service or real resident notification delivery is implemented here.

## State and adapter mapping

| Current status | Meaning | Allowed next action |
| --- | --- | --- |
| Pending | Pending review, within the seven-day review window | Secretary/Captain approve, reject or request resubmission; resident may replace their documents |
| Resubmission requested | Waiting for corrected documents, not rejected | Owner submits corrected documents on the **same application ID**, returning it to Pending |
| Approved | Final; verified-residency features unlocked | No further decisions or document replacement |
| Rejected | Final application | Existing resident reapplication creates a new application; old record stays final |
| Expired | Pending review window elapsed | Existing reapplication creates a new application |

Waiting for correction does not expire. Actual corrected submission starts a fresh seven-day review window. Only Approved unlocks SOS. Pending dashboard counts exclude requests awaiting correction. Reviewed/completed counts include only Approved and Rejected, never requests or uploads. Queues show the latest application per resident, including Resubmission requested in status filters.

Keep this display mapping in the API adapter if Laravel uses snake-case enum values (`pending`, `resubmission_requested`, `approved`, `rejected`, `expired`). Existing page components should continue using the same DTO and `Api.verification` methods.

## Proposed authenticated endpoints

All routes are examples under `/api/v1`; return JSON with the current verification DTO.

| Method and route | Demo adapter | Policy |
| --- | --- | --- |
| GET /verifications?status=… | verification.list(options) | Secretary/Captain: own barangay; resident: own latest application |
| GET /verifications/{id} | verification.get(id) | Same barangay official or owning resident, including permitted historical records |
| POST /me/verifications | verification.submit(userId, input) for a first application or reapplication | Resident only; derive resident ID from session; reject an existing Approved application |
| POST /verifications/{id}/submissions | verification.submit(userId, input) with verification_id and expected_revision | Owner only; append corrected documents to current Pending/Resubmission requested application |
| POST /verifications/{id}/decisions | verification.review(id, input) | Active Secretary/Captain of same barangay; latest unexpired Pending submission only |

Decision input: `decision`, trimmed `reason` (required for Rejected/Resubmission requested, maximum 1000 characters), `expected_revision`. Submission input: `document_type` (required, max 100), documents and `expected_revision`; `verification_id` is represented by the route ID. The demo stores only a combined `file_name` string (max 200), not document contents. Laravel should accept uploaded files and return safe display filenames instead of trusting client paths.

Responses: 200 updated record, 201 newly created application, 401 unauthenticated, 403 unauthorized, 404 inaccessible/missing record, 409 stale revision or invalid transition, 422 field validation. Return field errors as `{ errors: { reason: ["…"] } }`; map these to existing `ApiError.fields`. Never silently retry a stale decision against newer documents.

## Persistence

Suggested MySQL tables (names may follow the backend's existing conventions):

- `verifications`: id, resident_id FK, status, current_submission_id FK, revision unsigned integer, submitted_at, deadline_at, reviewed_by nullable FK to users, reviewed_at nullable, rejection_reason nullable, resubmission_reason nullable, created_at, updated_at.
- `verification_submissions`: id, verification_id FK, submission_number, submitted_by FK, document_type, submitted_at, deadline_at. Unique `(verification_id, submission_number)`.
- `verification_documents`: id, submission_id FK, document_kind (`valid_id` or `proof_of_residence`), original_name, private_storage_key, MIME, size_bytes, created_at.
- `verification_events`: id, verification_id FK, submission_id nullable FK, action, actor_id nullable FK, role_at_action nullable, reason nullable, occurred_at. Events and earlier submissions are retained. System expiry has no human actor.

The demo represents this history as a per-record `history` array with action, at, actor_id/name/role, document_type, file_name, submission_number, deadline_at and reason. Legacy rows default to revision 0. On first change, their existing file and actual submitted timestamp are preserved as the initial submission; no earlier actor, review or timestamp is fabricated. New changes increment revision. `submission_number` increments only when documents are submitted, not on decisions.

## Server enforcement and validation

Use authentication middleware, active-account checks and Laravel policies/gates for every read and write. Resolve roles and barangay from authenticated records; do not trust user IDs, role labels, actor data or barangay supplied by the browser. Captain oversight has the same verification decision permissions as Secretary. Responder, Rescuer and Tanod cannot review. Residents can only submit/view their own verification. Restrict document download authorization separately; use private storage and expiring authorized URLs.

Require a valid current pending deadline for decisions. Validate status, nonempty trimmed reason for rejection/correction, limits, current/latest application and permitted owner. Current upload UI requires a valid ID and proof of residence, each nonempty JPG/JPEG/PNG/PDF up to 10 MiB. Laravel must inspect actual MIME/content, apply malware scanning and safely generated storage names; browser extension/MIME checks are only convenience. Do not expose government identifiers or document storage paths in public DTOs.

Use a database transaction with row lock or conditional update on ID **and revision** for submissions and decisions. Require expected_revision in the backend even though the demo accepts omission for older clients. Reject duplicates/stale updates with 409; enforce one current application per resident transactionally. Append the immutable document/review event, update status/current documents, increment revision and enqueue the resident/official notification atomically. An outbox/job should deliver notifications once. A scheduled server job may expire overdue Pending records and append a system event; never expire Resubmission requested records while awaiting correction.

The correction notification includes the official's saved reason and a route to the resident verification page. Corrected upload notifies in-barangay officials and points to the same verification detail ID. Preserve event-time actor/role and document-version references for activity logs, including repeated corrections. Do not count these events as completed reviews or invent historical activity for legacy records.
