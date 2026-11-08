# PR51 P2 General Feedback Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task; do not delegate or take over the other owners' work.

**Goal:** Add actual authorized review/archive commands to General Feedback while preserving original data, UI and operational behavior.

**Architecture:** Extend the existing CivicService, relational DTO mapping and communications adapter. Use the current actor/receipt transaction and existing submission-intent helper; DBA supplies agreed persistent metadata and P1 admits shared registration and the final candidate.

**Tech Stack:** PHP/Laravel, MySQL8.4, vanilla JavaScript, PHPUnit, existing portable P2 runner and Playwright.

**Spec:** User-supplied P2 prompt/execution order and `docs/backend/PR51-P2-general-feedback-proposal.md`; dependent implementation waits for P1's ratified `docs/backend/PR51-followup-contract.md`.

## Constraints and review focus

- PR51 only; base b00d944789dada39a356ebb6497da0aae4d74049; separate P2 role branch. P1 alone updates the integration branch.
- Do not edit DBA migrations/models/transports or P1 shared registration. Do not alter baseline fingerprints or fake candidate admission.
- Preserve original keys/body/revisions, current identity checks, person-before-resource locks, scope privacy and atomic audit/receipt behavior.
- Keep general metadata independent from operational status; retain comment/rating, historical reads and summary population.
- No shared/retained DB mutation, main merge, real providers, Make or deployment. Tests use disposable data.

## Tasks

- [x] Inspect verified PR51 head, existing source, DBA proposal and repository instructions; preserve work and create isolated P2 branch.
- [ ] Publish P2 proposed contract and confirm P1/DBA ratification; record schema/registration dependency checkpoints.
- [ ] Prepare failing real-service portable, HTTP/SQL, adapter and model/UI regressions; label preparation versus acceptance honestly.
- [ ] After ratification, add minimal CivicService commands, guarded reads and DTO mapping. Verify portable RED/GREEN, rollback, receipt/source checks and locks.
- [ ] After DBA schema handoff, run actual MySQL/HTTP and independent-process races without creating substitute columns or temporary application migrations.
- [ ] Add owned communications methods and original selected-detail actions using P1's agreed interfaces; maintain retries/cancel/selection and archived-summary semantics.
- [ ] Run original P2 contracts/adapter/SQL/lock/civic and emergency regressions, syntax/style/static checks. Keep unsupported paths disabled until genuine integration succeeds.
- [ ] Publish P2 branch, exact commits/dependencies and evidence in PR51; no competing integration PR or integration-branch push.
- [ ] Rehearse P1's frozen candidate independently when available. Keep acceptance pending if dependency/candidate has not been published.
- [ ] Verify recording-custodian handoff prerequisites privately and report access dependency without disclosing keys/paths/SQL/objects.
