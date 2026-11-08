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
- [x] Publish P2 proposed contract and confirm ratification5428762; DBA bad5d43 integrated2911d80; P1 capability/staging agreed in PR51.
- [x] Prepare failing real-service portable, HTTP/SQL, adapter and model/UI regressions; label preparation versus acceptance honestly.
- [x] Add minimal CivicService commands, guarded reads and DTO mapping; portable13 RED/GREEN plus original52.
- [x] Consume unchanged DBA schema and run actual MySQL/HTTP and independent-process races:6 tests/169 assertions. No substitute migration/model.
- [x] Add owned communications and original selected-detail actions; new+original JS27 pass after fresh review cancellation correction. Browser acceptance still awaits P1 admission.
- [x] Run original P2 contracts/adapter/SQL/lock, complete combined PHP, existing frontend and applicable syntax/style/static checks. Existing original SQL covers both emergency branches; unsupported positive UI paths remain gated.
- [ ] Run expanded original civic and final emergency/device browser regressions on P1's exact admitted candidate; do not substitute owned-worktree or historical browser evidence.
- [x] Publish P2 branch, exact commits/dependencies and evidence in PR51; runtime c919306, comments6721011023/6721032735. No competing integration PR or integration-branch push.
- [ ] Rehearse P1's frozen candidate independently when available. Keep acceptance pending if dependency/candidate has not been published.
- [x] Verify recording-custodian identification prerequisites privately; matching private references remain outside Git. Actual final-candidate capture/private handoff/DBA restore acceptance are still pending, with no keys/paths/SQL/objects disclosed publicly.

## Execution ledger

- Ratification5428762 permits owned product work; schema bad5d43 consumed only after P1 integrated it at2911d80. Product/role starting base remains b00; original baseline fingerprints unchanged.
- Service task: portable13 RED (missing workflows) -> GREEN, original52 remain green. One receipt namespace binds action/resource/revision.
- UI task: seven feature regressions RED -> GREEN. Fresh review found unused cancelled intent retained an obsolete revision; actual reproduction RED0!=1 -> explicit discard/close recovery GREEN; JS27 pass. No deferred finding.
- SQL task: first connection attempts could not reach the stopped/recovering isolated MySQL runtime. Preserved initialized data; restart only. Test bootstrap/empty-lock-observer defects corrected without changing product gates/helper; six real service/controller/race cases now169 assertions green. Full original suites running; no final candidate claim.
- Broader owned evidence: original SQL53 and unchanged actual-service lock probe pass; all original P2 Node entries plus new contracts51 pass; original frontend and rehearsal11 pass; scoped Pint/static509 pass. Configured compatibility and actual P2 source/fake-consumer modes positive/missing/revoked/wrong_purpose pass with zero real calls. Setup refusals retained; no registration/source bypass.
- Complete combined PHP on runtime c919306: exit0,415 tests/2,432 assertions,0 failures/errors,1 Windows symlink skip,21m22s. Logs and JUnit retained privately; source/candidate/browser/DBA gates remain distinct.
- Ruling: defer the expanded original civic/device/emergency browser verdict until P1 publishes the combined admitted candidate — source verification and sole integration ownership take precedence over a locally composed browser run — cost: final browser acceptance remains pending rather than certifying mixed/unadmitted source.
