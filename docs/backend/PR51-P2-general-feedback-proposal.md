# P2 General Feedback proposal — awaiting coordinated ratification

Integration reference: https://github.com/Butvh/barangay-connect-frontend/pull/51

Base: `b00d944789dada39a356ebb6497da0aae4d74049`. P2 branch: `codex/p2-pr51-general-feedback-20261108`. P1 owns `PR51-followup-contract.md` and final integration. This proposal does not replace that contract or authorize a schema implementation before agreement.

P2 agrees with the DBA's proposed four nullable columns on `community_feedback`: `reviewed_by`, `reviewed_at`, `archived_by`, `archived_at`. Keep `kind=general`, operational `status=NULL`, `assigned_tanod_id=NULL`, rating/comment and original submission time. Reuse the existing revision, command receipt and immutable activity log. No new history table is needed. DBA owns migrations/model casts/constraints and tests; P2 owns DTO mappings and domain commands. Existing rows remain unreviewed/unarchived without fabricated historical actors.

## Proposed commands

| Route | Input | Result |
|---|---|---|
| `POST /api/v1/feedback/{id}/review` | `Idempotency-Key` plus JSON `{expected_revision: integer}` | Current authorized feedback DTO; review actor/time set once; revision +1 and one audit entry. |
| `POST /api/v1/feedback/{id}/archive` | Same intent/revision contract | Soft archive actor/time set once; revision +1 and one audit entry. |

Only current local Captain/Secretary may mutate general feedback. Archive does not require prior review and never implicitly marks it reviewed. A fresh intent against an already-reviewed/already-archived state, or a review of archived feedback, returns existing `INVALID_STATE`409 without effects. A stale revision returns `CONFLICT`409. Same-key/same-body retries use the existing receipt mechanism and do not repeat effects; changed payload, resource or action cannot reuse a receipt to perform a different command. As with the current `once()` implementation, receipt replay re-reads the currently authorized resource; it does not promise an immutable DTO response snapshot.

Guests are401, wrong effective role is403, foreign/missing source is404, wrong feedback workflow is409, malformed fields/key/revision use current validation behavior. Authority and source access must be rechecked on replay. Actor IDs, metadata/timestamps, status, rating and comment cannot be supplied by this command. No new notification, SMS purpose or outbox event: these are administrative review/archive actions, with existing typed audit only. Existing submission/operational feedback notifications remain untouched.

## Proposed reads and summary semantics

- Extend feedback query with official-only `archive=active|all|only`; omitted defaults to `active` for officials. This filters **general feedback only**, leaving complaint/suggestion semantics unchanged. `only` means archived general entries. Residents retain all their own original records/history by default and cannot use the administrative archive selector.
- Direct GET remains scoped and permits authorized historical reads of archived general feedback. Preserve all existing DTO fields, adding the four nullable metadata fields with server UTC times; no extra person lookup is required for reviewer/archive actor display.
- Original official page requests `archive=all` through P1's agreed reader, preserving historical average rating, monthly received and positive-response statistics. Its visible general queue locally excludes archived rows. Search/pagination/selected details follow the visible queue; archiving clears selection and selects the next visible row or an empty detail. Linked archived entries are not silently revealed in the active queue. No archived-list toggle or restore UI is added.
- Resident history retains full rating/comment and may display recorded review/archive metadata without allowing commands. Reports retain activity log history; these actions must not inflate resolved operational-feedback totals.

## Locking, retries and UI

Use the current actor-guarded `once()` receipt boundary, include resource ID in the canonical command payload/route identity, and declare the scoped feedback lock before access. Revalidate effective role/scope/security generation under the existing person-before-feedback protocol. Display-only resident projection stays non-locking; no late person locks, audience lock or barangay lock. Audit, metadata, revision and receipt commit or roll back together.

Use `createFormSubmission` and its original opening identity, body/key/revision, preserving the same submission object for a retry after a lost reply. Do not create a new key each time a failed confirmation is reopened. Existing confirmation UI handles explicit review/archive consent; cancellation does not send a mutation. P1 owns shared registration/readiness. Keep incomplete actions unavailable until actual dependency/bindings are admitted.

## P2 file ownership and acceptance

P2: `CivicService.php`, P2 `CivicController.php`, `routes/communications.php`, `RelationalStore.php` DTO allowlist, `assets/js/adapters/communications.js`, original `official-feedback.js`/model, and P2-owned service/HTTP/browser/model regressions. P1 retains shared global registration/reader exposure and candidate admission. DBA retains migrations/models/constraints/transports. Confirm any overlap before edits.

Acceptance covers Captain and Secretary; wrong roles/scopes/types; zero side effects on denied/stale/malformed commands; same-intent replay and mismatched-body/resource rejection; competing review/archive processes; real rollback after storage/audit failure; current-role revocation; preserved private historical reads and metrics; page selection after archive; cancel/retry/refresh; no new notifications/provider calls; and unchanged original emergency/civic regressions. Portable tests exercise the real domain service over the existing test store and are labelled unit evidence only. Genuine SQL/browser acceptance waits for DBA schema and P1 registration/admission, on one exact candidate.
