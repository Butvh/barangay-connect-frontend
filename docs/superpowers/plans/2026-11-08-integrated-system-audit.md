# Integrated System Audit Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Combine the reviewed DBA, P1 and P2 sources on a dedicated branch, reproduce the reported defects, fix their root causes, and publish current integration and security evidence without touching main or the retained recording dataset.

**Architecture:** Preserve the existing vanilla JavaScript UI and shared HTTP/session/submission-intent adapters. Combine the exact owner sources through the existing allowlisted composer before making focused integration patches. Exercise Laravel and MySQL with unique disposable schemas and fake external delivery only.

**Tech Stack:** Vanilla JavaScript, PHP 8.5.12, Laravel 13, MySQL 8.4, PHPUnit and Playwright.

**Spec:** User request at `C:/Users/Lanz/.codex/attachments/f2eab96a-6a3a-42e8-be03-f0b74ff42d35/Pasted text.txt`.

## Global constraints

- Main and the owner branches remain unchanged; integration branch is `codex/backend-integration-audit-20261108`.
- Source pins: P1 `7369fe93f81a09e4ba490b684d8fa35f0bfd8a1a`, DBA `bf2c5e800bbd9bb996e3070554bbcfdcc4d4169e`, P2 `429490a8da8a0b25d6ee95f018833a1646c1def9`.
- Retain the recording schema, private key, configuration, photos and earlier failed evidence. No reset, migration or test fixture writes against retained data.
- No real SMS, mail, Make, provider calls, spending or deployment. Test in-app delivery independently from external channels.
- Preserve frontend design, server authorization, stable command intents, observed revisions, immutable history and original regression suites.
- Responders have at most 2 active alerts; Rescuers at most 1, including concurrent writes.
- Merge requires current combined checks and required team review, including the outstanding DBA acceptance; no self-approved or forced merge.

## Review focus

- Wrong-portal sign-in must fail generically on Laravel and must not leave an authenticated session; valid current roles still work.
- Optional blank contact and invalid supplied contact must produce consistent precise field errors, without weakening capacity or coordinate validation.
- Pinned active facilities must survive API projection and marker filtering; inactive facilities must not become new rescue destinations.
- Committed in-app events must reach only currently authorized recipients, without requiring activation of SMS or Make.
- Fix corrupted authored UTF-8 text, not arbitrary resident content; retain legitimate non-ASCII names and input.

## Tasks

### 1 Exact PR review and integration baseline
- [x] Inspect each PR metadata, changed filenames, commit history, dependencies and current pins.
- [x] Fetch owners and create the dedicated branch in the existing clean isolated worktree.
- [x] Compose a clean independent baseline with 855 source fingerprints using existing tooling.
- [ ] Preserve baseline manifest and run baseline static, contract and actual MySQL checks.
- [ ] Integrate exact sources and document the ten common-base overlays and runtime gates.

### 2 Reproduce visible defects and security boundary
- [ ] Add failing tests for authored encoding, field-error visibility, facility/map projection, wrong-portal session rejection and unprocessed in-app events.
- [ ] Record each root cause and distinguish invalid input from application defects.
- [ ] Confirm original forms on desktop and mobile with safe fictional accounts.

### 3 Focused fixes
- [ ] Repair authored text and add a guard against recurrence.
- [ ] Make facility field validation and errors consistent, preserving scope, revisions and historical destinations.
- [ ] Correct facility and incident map projection only where reproduction proves a defect.
- [ ] Add explicit portal intent to the shared login request and enforce allowed effective roles server-side.
- [ ] Provide bounded in-app processing and its operational setup without activating external delivery.

### 4 Combined regression and audit
- [ ] Run original PHP, P2 contract/SQL/concurrency, frontend and browser suites on disposable schemas.
- [ ] Test both emergency branches, explicit resolution, capacity release, unauthorized/cross-barangay reads, documents, notifications, civic and personnel flows.
- [ ] Run format, syntax, dependency and artifact/security checks; report real failures and unverified limits.

### 5 Reviewable delivery
- [ ] Publish severity-ranked findings, ownership/dependencies, exact commands/results and reproducible local startup instructions.
- [ ] Commit the integration and focused patches with source provenance. Request required owner reviews through the authorized PR workflow when ready.
- [ ] Keep merging pending if any technical or review/backup acceptance gate is incomplete.
