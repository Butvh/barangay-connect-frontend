# Verification Resubmission Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with a fresh whole-branch review before merge.

**Goal:** Restore Request resubmission for Secretary/Captain and complete the resident correction cycle without duplicating the application or discarding earlier documents.

**Architecture:** Extend the existing demo verification API with a distinct status, revision checks and a per-record submission/review history. Reuse the current official notes field, centered confirmation dialog, resident verification/register upload interface, notifications and activity projection. Keep Pending as the existing internal pending-review status.

**Tech Stack:** Existing offline HTML/CSS/ES modules, browser demo store and future Laravel API adapter.

**Spec:** User request and APP-DEV-Final O-08 Verification Detail (261:21407). Figma action 4458:99918 validates the reason, sets Resubmission requested and opens shared overlay 2063:34634. No separate resubmission screen was found.

## Constraints and design

- Reuse Inter, existing colors/buttons/notes field. Three equally balanced 48px actions with 10px gaps: blue Approve, outlined Request resubmission, red Reject. Stack when narrow. No redesign of the document preview or shell.
- Request requires trimmed nonempty reason (max 1000), confirmation, authorized in-barangay official and current unexpired Pending submission.
- Approved/Rejected stay final. Awaiting corrections is read-only for officials and remains distinct until resident submission.
- Resubmission requested does not expire while awaiting documents; actual corrected submission starts the existing seven-day review window.
- Reuse the same record ID for requested corrections. Preserve previous filenames/type/actor/date/reason in history; do not invent historical actors/timestamps.
- Existing rejected/expired reapplication behavior remains supported without reopening a final historical record.
- No backend implementation, binary document storage or new runtime dependencies. Document Laravel authorization, validation, persistence and concurrency contract.

## Review focus

1. Competing review/submission must not approve a stale document revision or create duplicate correction requests.
2. Empty/oversized reasons, unauthorized/cross-barangay actions and final statuses must leave storage unchanged.
3. Original filenames, correction reasons and submission timestamps must survive repeated correction cycles.
4. Resubmission requests must not count as Approved/Rejected or unlock SOS.
5. Notifications, queue filters, profile badges, activity and actual uploaded filename display must agree after reload.

## Task 1: Domain and integration

- [x] Write failing API/model tests for request, same-ID correction/history, stale revisions, final/permission/deadline gates, notification reason, metrics/SOS and repeated cycles.
- [x] Extend the existing API with minimal focused verification helpers; add status projection and relevant activity/queue handling.
- [x] Run the focused tests and complete suite.

## Task 2: Official and resident UI

- [x] Write page regressions for missing reason, cancelled/confirmed modal, finalized/awaiting-correction controls, uploads and stale input.
- [x] Add the third action and reason copy; reuse existing confirmation and register uploads; show correction instructions/history and status consistently.
- [x] Document the future Laravel/MySQL contract and demo-only authorization boundary.

## Task 3: Verify and integrate

- [x] Compare the three-button area with Figma; check desktop/tablet/mobile and keyboard/dialog behavior.
- [x] Exercise Secretary and Captain request, resident notification/corrected files and return to queue, then approval/rejection/final-state behavior.
- [x] Run all supported tests/static/syntax checks, obtain whole-diff review, fix material findings, and prepare the checked branch for the authorized main merge after CI passes.

## Validation evidence

- 349 core and 22 page tests pass (371 total); static/offline reference validation passes.
- Read-only whole-diff review found no material defects, including same-time activity deduplication and preserved final reapplications.
- Local demo at port 8810: Secretary empty-reason validation, Cancel preserving notes, confirmed correction request, distinct queue status and read-only waiting state verified.
- Resident notification retained the exact reason and opened the existing verification/upload interface. Fictional corrected-id.pdf and corrected-proof.pdf returned application #2 to Pending with original files and reason retained in history.
- Captain saw corrected files on #2, opened/cancelled the correction confirmation, then approved it. Final buttons were disabled and the resident profile showed Approved/Household verified.
- Compared the three-action area with the supplied Figma reference at 1917px (equal 225.6px-wide, 48px-high buttons, 10px gaps); checked 1280px, 1024px and 390px without horizontal clipping. Container-based stacking keeps narrow review actions readable. Temporary viewport override reset.
- Future backend boundary and API/persistence/authorization/concurrency requirements documented in docs/verification-api-contract.md. No backend or real identity-document uploads added.