# P2 integration execution ledger — November3,2026

Spec: user-supplied p2-followup-prompt.md and shared backend development plan.

Existing isolated codex/backend-p2-modules worktree preserved. Base c902d9f; latest P1 c0a32cf; DBA 3d2b3a2. Main/teammates untouched. Preparation ledger remains historical; this ledger records the follow-up. Earlier bc2764a/f641918 runs were superseded when both owners published updates during final validation.

- [x] Actual typed interfaces, real relational persistence/field mapping, captured current/locked identity.
- [x] Real DBA guards, shared transaction, explicit provider bindings, seven in-app-only v2 producers and ORM receipt handler.
- [x] Scoped readers through P1 transport; original global registration stays gated.
- [x] Actual SQL/HTTP workflow, rollback/dispatcher/privacy/report tests and P2 independent-process races.
- [x] Fresh-context whole-change review; seven Important findings reproduced in SQL and corrected in one fix pass.
- [x] Latest-owner source/typed-context adaptation and additional regression checks.
- [x] Final functional checks and source-hash evidence; style/artifact verification completed before publication.
- Delivery target: authorized P2-only commit/push and draft #50 update. The final commit/remote status is recorded in the PR after publication; main and teammate branches remain untouched.

Ruling: reuse current owner APIs and supply review-candidate adapters without claiming owner ratification — preserves ownership and disabled defaults; if owners choose different projections only the adapter/binding changes.
Ruling: do not implement P1 registration/forms/private storage/role or facility mutation services — explicit ownership scope. Their original-browser and full workflow races remain release gates, even though P2 current-read primitives can be tested now.
Ruling (superseded): leave the earlier DBA portable-class checker unchanged and request owner correction. DBA subsequently supplied ConfiguredAdapters/SqlContractProbe; P2 adopted them unchanged. Production P2 writer/handler pass its actual SQL probe; no second dispatcher or SMS enabling was introduced.

Ruling: adopt the latest P1 SourceReferences through a captured-actor clone without breaking the original portable ReferenceData port — keeps household/approval/facility/report authority P1-owned. P2 supplies the latest-assignment IncidentReferencePolicy. Internal worker/official selection and minimal persisted-source participant names stay separate from the admin-only directory. Cost if wrong: owner review changes this adapter/policy before enabling integration.

Ruling: retain private photos as unavailable — P1's new IncidentPhotos/StagedIncidentPhoto contracts have no concrete byte-storage implementation/binding. Do not simulate bytes or implement P1 storage. Full original-form/backend UI, transfer-versus-real-role-mutation and rescue-versus-real-deactivation races remain exact P1 dependencies.

Final review: fresh reviewer, read-only whole change. Seven Important findings verified RED, then fixed: optional inactive recipients blocking dispatch; stale destination snapshot; stale history MAX sequence; timezone offset lost in SQL; >1000 fanout failure; missing historical announcement content; HTTP fallback without observed-generation support. Named sql-review.php cases provide RED-to-GREEN evidence. Additional provider-binding and current-appointment regressions also reproduced then passed.

Final: minor (deferred): ReportService uses current directory actor name over persisted audit-name snapshot; rename display attribution can change. IDs/roles remain recorded. No source change for this minor.

Latest evidence:48 portable checks (47 original + advancing clock);8 original and3 foundation adapter checks;405 original frontend assertions;33 actual MySQL/HTTP/race cases (21 base +7 review +5 latest-contract regressions);152 unchanged owner tests/704 assertions/zero skips. DBA production adapter probe passes with provider calls=0 and SMS intent not requested. Three live disabled-mode loopback transport/public-root checks pass. Composer strict/platform/locked audit and artifact/module-graph checks pass. Final formatted snapshot and manifest are rechecked before commit.

Latest-contract RED/GREEN: actor-bound and transferred-household calls first failed on missing forActor; typed audience hint was silently changed and bound feedback context was rejected. Minimal adapters now use P1 sources, exact family payloadFor and toArray-derived audience. Approval fixture was corrected for DBA's new unique current-verification constraint, and the feedback fixture removed an unsupported title; invalid fixtures are not counted as bug evidence.

Validation corrections: the initial loopback command lacked APP_ENV=testing; P1 correctly rejected production HTTP config. Explicit testing/file-session config plus generated frontend made the unchanged test pass. Initial probe inherited sqlite; explicit DB_CONNECTION=mysql made the real DBA probe pass. Sandbox DNS blocked Composer audit; the approved advisory query passed. Automatic approval review rejected a recursive broad formatter; explicit P2 file lists were checked against both owner change lists (intersection0) and formatted successfully. Owner code remains byte-for-byte unchanged.

Unattempted/blocked: authenticated original-domain form E2E with P1 global registration; full cross-owner role/facility mutation races; concrete private-photo bytes; dedicated rescuer last-slot race; P1 event families; SMS/provider/Make/deployment. No skipped/failed test is relabeled successful. No main merge is authorized.
