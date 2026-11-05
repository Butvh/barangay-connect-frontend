# P2 opening-session and resident photo correction

> Execute inline with executing-plans and test-driven-development. Reuse the isolated P2 worktree; P1 remains unavailable. Do not edit P1-owned implementation or CI.

**Goal:** reject old operational forms after session-observation changes and show authorized resident photo history using the existing P1 helper.
**Architecture:** capture immutable opening identity/opaque session observation before async preparation. Retain shared original intent/File/body/revision; reject stale async results and cached receipts. Reuse existing safe reader/gallery and preserve default-disabled capability.
**Spec:** attached P2-Start-Now-P1-Unavailable.txt. Frozen P1 9bc1a04b2005602de25879221042511f07a3ffa8 / DBA f4e8df958234e0bd2b09fd1b10d749fc22c746c3 / P2 baseline22365ad10f05bba4d16ba1d84a8e9c9049e2aa0a.

- [x] Reproduce actual unchanged browser RED and meaningful helper RED before edits.
- [x] Fix P2 opening identity and async details construction; test first-submit/hash/pending/cache/reply/discard/reopen and retained original replay.
- [x] Integrate safe resident gallery; test authorized/empty/denied/gated states without redesign.
- [x] Publish focused correction early, exact path list and common-baseline reconciliation handoff to P1/DBA.
- [x] Verify actual browser/private-byte/privacy, full combined backend, SQL/HTTP/order, Node/frontend/dependencies/style/artifacts on exact frozen sources. Experimental P2 overlays are not clean P1-composer acceptance.
- [x] One fresh review, one RED/GREEN fix pass if needed, final evidence/manifest/PR update. Leave final owner admission/CI pending if P1 remains unavailable.
- [ ] P1-only remaining gates: narrow admission/common-baseline reconciliation, final repin, required resident gallery assertion, dependency-audit review/remediation and clean full Linux CI. Candidate remains draft/disabled.

Measured:384/2108 backend (one Windows symlink skip),33 original non-photo browser scenarios,3 original photo groups plus added reopen/gallery browser,32 Node entries,48 SQL+2 HTTP/order and composed frontend/artifacts pass. Canonical299-file PHP style passes; raw P1 CRLF Pint and standalone missing P1 helper are explicitly documented. Current unchanged-lock audit fails7 advisories/4 packages; handoff preserves owner boundaries.

Review: never rebind an old form on discard/complete; validate before cached receipt use and post-response acceptance. A rejected late response may already have committed. Keep key/body/File/revision stable on ambiguous failures. No new transport/key generator, private path/token leakage, SQL lock/schema rewrite, default activation, live sends or merge.
