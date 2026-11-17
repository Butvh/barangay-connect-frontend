# P0 Release Admission Implementation Plan

> For agentic workers: use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Register reviewed existing operational/profile/consent services on a separate disabled-by-default release profile.
**Architecture:** Existing IntegrationServiceProvider selects actual ports, scoped current consent and opt-in typed outbox. Original profile UI uses admitted release capabilities, retaining cookie/CSRF and observed revisions. P2 producers and DBA production code remain unchanged.
**Tech Stack:** PHP 8.5, Laravel 13, MySQL 8.4, vanilla JS, Node22+, Playwright.
**Spec:** Approved November17 review, local evidence p0-review-20261117/P0-P1-P2-Review-And-Patch-Plan.md; approval recorded in this conversation November17.

## Global Constraints
- Start b60c0dddeff1a765c08cdec73ce45e4afdf26b43; new branch; preserve frozen candidate.
- No DBA production files, new SMS families, stale-SOS policy or wake-up changes.
- Fresh disposable MySQL; HTTP fakes; default dispatch/SMS/Make false; no deployment/merge/live data.
- Reuse unchanged preparation/verifier; immutable baseline plus explicit patch declarations.

## Review Focus
- Release/test mixing must fail before exposing routes.
- Resident profile must not need unadmitted verification detail.
- Runtime edits cannot authorize server operations.
- Container-resolved producers must use the actual consent ports.
- Artifact admission must bind every capability dependency, not trust flags.

### Task 1: Backend release admission
Files: integration config/provider/env, new ReleaseIntegrationTest, existing gate suites.
Interfaces: release_enabled + sms_intent_enabled -> validated release_admitted/p2_enabled, actual Store/Reference/audit/outbox/handler and consent aliases.
- [ ] Add failing release boot and actual container/consent producer tests; run targeted PHPUnit, expect failure absent binding.
- [ ] Implement explicit reviewed release selection, reject mixed/unsafe config; scoped opt-in constructors; preserve legacy isolated path.
- [ ] Run targeted suites, expect green; commit backend selection.

### Task 2: Self-profile and consent UI/API
Files: AdministrationController, administrative-registration, domains, notification-preferences, existing adapter tests.
Interfaces: admitted release selfProfile/consent -> existing self APIs/factories, no full administration exposure.
- [ ] Add failing limited-profile adapter and self-API tests.
- [ ] Admit existing self profile actions only; limited factory uses existing own-verification summary; exact consent versions/revisions.
- [ ] Run adapters + actual HTTP tests, expect green; commit UI/API selection.

### Task 3: Admitted release artifact
Files: stage-backend-frontend, backend-artifact tests, new P0 admission JSON.
Interfaces: releaseProfile=p0-v1 plus clean integrated manifest and matching source hashes -> release Runtime, all TEST flags false.
- [ ] Add failing valid/mutated/mixed-profile artifact tests.
- [ ] Verify existing manifest plus complete exact P0 admission before writing artifact; preserve demo and isolated paths.
- [ ] Run artifact/admission tests, expect green; declare reviewed patches and commit.

### Task 4: Candidate verification
Files: focused browser release test, test evidence, dated runbook/handoff.
- [ ] Exercise original resident/official consent profiles through actual HTTP without TEST selection; record screenshots/checks.
- [ ] Run full frontend/static/artifact and original ordinary/combined MySQL/SQL/portable/browser suites on new schemas; Composer/Pint/platform/audit.
- [ ] Compose clean replacement exact head and manifest using original scripts; run verifier; record all results/skips and unchanged DBA hashes.

### Task 5: Review and technical handoff
- [ ] Fresh whole-branch review, fix important findings with failing regression then green affected/full suites.
- [ ] Record commits/files/commands/results/limitations and exact candidate; leave main and PR51 frozen; independent DBA acceptance pending.
