# PR51 P1 map and shared-reference handoff

**P1 role implementation ready for integration; final combined acceptance is pending.**

Product/role base: `b00d944789dada39a356ebb6497da0aae4d74049`. Ratified contract: `542876273b513fb7a7c23ccb9e22af27407d4043`. Runtime/test checkpoint: `724abcc57aa21dccca3583b18686be0be56ebca1` on `codex/p1-pr51-map-scope`. This document and its evidence publication are documentation-only additions. PR51's integration branch currently contains the schema dependency at `2911d8075c6cf18b9a99ef3b9d464a54ba387679`; it does not yet contain this P1 role or a handed-off P2 runtime implementation.

## Changes and boundaries

| Boundary | Before | After |
| --- | --- | --- |
| Map renderer | ID1 selected Sampaguita artwork; invalid coordinates could become clamped pins. | Exact declared `sampaguita` key selects the existing artwork; invalid/absent pins are excluded, 0/100 remain valid percentages. |
| Shared map consumers | Assumed ID1/default map, no authoritative current reference. | One scoped-map boundary resolves current identity/reference, rejects foreign tenant options and wrong-artwork/foreign-owner markers, fails closed on API errors and watches coverage changes. Unchanged polling preserves zoom, draft pins and keyboard focus. |
| Facility form and server | Picker gated on ID1; Laravel accepted any nonempty map key. | Picker uses resolved coverage with visible unavailable text. Laravel recognizes the artwork, derives scope/owner itself, rejects forged fields and preserves unchanged legacy pins/history without relabelling. |
| Active reference directory | Reference `is_active=false` could appear Active; resident source list included inactive entries. | Availability handles the real reference field; resident directory/list/detail is active-only. Internal scoped single-facility history resolution and shared referral reads remain available. |
| Demo compatibility | Existing fictional v1 records have artwork declarations but predate new metadata; no barangay subscription entity. | Demo-only read projection recognizes the exact already-declared artwork path, preserves fixed legacy referral ownership and existing edited content/coordinates. Explicit NULL/unknown scope is never overridden. No reset/read-time persistence; backend mode never invokes the projection or imports the seed template. |
| General Feedback shared seam | Missing lifecycle facade/admission; complete historical summary population not selected. | P1 exposes the agreed methods/capability seam, preserves false booleans, and selects complete official reads only when the P2 adapter supports the contract. Capability defaults false. Opt-in isolated staging requires exact reviewed schema/domain fingerprints. No admission file is fabricated before the P2 handoff. |

The illustrated design, colors, components, percentage-coordinate contract, original form intents/revisions, historical snapshots and private Laravel public root are retained. No P2 domain service, DBA migration/model, retained dataset or token was edited on this P1 branch. New role files/tests and intentional shared edits are covered by the candidate manifest and explicit before/after declarations. Original owner baseline and composer/verifier are unchanged.

## Evidence, with source boundaries

See `PR51-P1-map-evidence.json` for sanitized report digests and runtime fingerprints. Results from different revisions are deliberately separated; these do not constitute final three-owner acceptance.

| Execution | Exact source | Result |
| --- | --- | --- |
| Existing frontend runner, appended map9 and composition4 | Clean `724abcc` | Pass, including original core354 and every original page/transport suite. |
| Repository static check | `724abcc` | Pass: 510 intended files and original asset/reference/size gates. |
| Original P2 ten-file Node command | `3ebae0d` | 43 passed; no assertion removed. |
| Genuine MySQL8.4.13 focused PHP/HTTP | `3ebae0d` | 18 tests /202 assertions /0 failures or skips. All PHP app and focused-test bytes match `724abcc` (verified with Git diff). |
| Actual original-page map browser | `15e68cb` | 7 scenarios /13 screenshots. Current `724abcc` runtime bytes are identical; only a demo-test selector changed afterward. Captain/Secretary create/edit/keyboard pin to0/100/deactivate/reactivate/history, unsupported ID1, supported non1, Resident/Responder/Rescuer reads, 1920/768/390 layouts. |
| Actual explicit static-demo browser | `724abcc` | 3 scenarios /3 screenshots. Legacy data preserved; NULL/unknown stays unavailable; no backend API request. |
| Artifact/source-boundary suite | `15e68cb` | 13 passed. Includes actual staged backend module graph with zero seed/browser-storage fallback; runtime bytes match `724abcc`. |
| Original operational browser | `0651cd7` | 10 scenarios /4 screenshots. Earlier role regression evidence, not current final acceptance. |
| Original personnel/facility/report browser | `3ebae0d` | 7 scenarios; actual staff commands, shared referral permissions and immutable facility history. Earlier role regression evidence, not current final acceptance. |
| Locked Composer runtime | Initial clean role export `fe2ba07` | Strict validation/install/platform/audit passed, no advisory. Current composer.lock is unchanged; final combined candidate must rerun these gates. |
| Scoped Pint | PHP additions and final reference correction | Passed; final all-owner Pint remains required after integration. |
| Original baseline/candidate verifier | Current clean role export | 879 fingerprints /279 original upstream owner files /54 explicit candidate patches. No original baseline or verifier edits. |

Commands (repository commands shown; machine-local launchers only select private runtime/configuration and create new disposable schemas):

```text
node scripts/run-tests.mjs
node scripts/check.mjs
node --experimental-vm-modules --experimental-default-type=module --test tests/p2-adapters.mjs tests/p2-foundation-adapters.mjs tests/p2-form-intents.mjs tests/p2-report-forms.mjs tests/p2-official-forms.mjs tests/p2-location-forms.mjs tests/p2-photo-upload.mjs tests/p2-photo-form.mjs tests/p2-resident-photos.mjs tests/p2-communications-forms.mjs
node --test tests/backend-artifact.mjs tests/frontend-artifact.mjs tests/integration-snapshot.mjs
php backend/vendor/phpunit/phpunit/phpunit -c backend/phpunit.combined.xml --filter "Pr51MapScopeTest|CombinedFacilityHistoryTest|IntegratedAuditTest" --display-warnings --fail-on-warning --log-junit <private-report>
node tests/browser/pr51-map-scope.mjs
node tests/browser/pr51-demo-map.mjs
node tests/browser/operations.mjs
node tests/browser/personnel-facility-workflows.mjs
node scripts/prepare-integration.mjs
node scripts/verify-integration.mjs
```

The fresh MySQL schemas were positively named disposable `bc_dba_p1_*` targets on the dedicated loopback8.4 instance, with private per-run storage and disabled external channels. Existing/failed/retained schemas were not reset or dropped. Static-demo compatibility is explicitly fictional evidence, never a substitute for production-adapter SQL/browser acceptance.

## Nonpasses retained

- New baseline HTTP regressions: 5 tests /54 assertions /2 RED failures (missing reference scope and unknown-artwork pin accepted). These were genuine product failures before correction.
- A dirty exploratory snapshot was correctly refused by operational staging; it is not browser acceptance.
- First clean browser run exposed a premature new archive query against the old P2 adapter and an immediate readiness assertion. Query compatibility/readiness were corrected; no backend error became demo data.
- Expanded test first acted on stale list controls after dialog closure; it now waits for the persisted updated card. A later repeated keyboard run exposed real focus loss during scope/marker refresh, fixed in the shared renderer/boundary. Failed reports remain private.
- Static-demo first test matched an unrelated dropdown's `data-menu=2`; its assertion now scopes to the actual facility card. No product assertion was removed.
- Restricted temporary Git fixture creation failed; rerunning the unchanged artifact suite with appropriate filesystem access passed13. Composer/socket setup diagnostics are separate from test verdicts.
- Supplemental broad `audit_project.py --mode strict --config scripts/premium-ui.json --no-write` did **not** pass: 103 flags from a scan including generated artifacts, vendor code and dynamic templates. This was not triaged into a general UI-compliance verdict or used to redesign unrelated screens. Repository-required static gates and actual scoped browser results are reported separately.

## Retained recording data correction proposal — NOT EXECUTED

The baseline audit describes undeclared coverage and unlocated facilities. Those historical observations do not identify the current Lanz recording dataset. Current custodian/private source verification remains required.

| Field | Current recording before | Proposed after, only if separately authorized |
| --- | --- | --- |
| `barangays.map_scope` | Unknown until custodian verification; baseline audit reported NULL. | Exact `sampaguita` only after custodian/DBA confirm that this artwork represents the intended barangay; otherwise preserve unknown/unavailable. |
| Facility `map_x/map_y/map_scope` | Unknown for current source; baseline audit reported unlocated records. | Only independently verified percentage coordinates through the scoped facility form/service, preserving paired0/100 values and immutable history. Never copy seed coordinates or infer a midpoint. |

No SQL/data change against a retained source is prepared or authorized by this proposal. Any later correction needs controlled before/after capture and its own custodian/DBA approval. A fictional test schema or demo screenshot cannot certify the actual recording backup/restore.

## Remaining integration order

1. Schema dependency **bad5d430ee4ed1efee3809028a6870e4555ab01e** has been reviewed and integrated into PR51 at **2911d8075c6cf18b9a99ef3b9d464a54ba387679**. Required [CI42465432478](https://github.com/Butvh/barangay-connect-frontend/actions/runs/42465432478) passed check/backend/combined; deployment skipped. This is the schema checkpoint's verdict only.
2. P2 must publish the explicitly reviewed runtime/UI handoff. At this report, its published role head is still proposal **e8fc119b48838b7f55c25d63f43fc9790613fc08**. P1 does not implement those services or integrate unhanded work.
3. P1 reviews/integrates P2, then this P1 role, preserves all authorship, reconciles explicit patch declarations and writes the exact dependency-admission file. Until then, General Feedback lifecycle activation is unavailable.
4. Run the entire original combined PHP/SQL/race/lock/browser/fake-delivery/format/Composer/artifact/source suite plus new map/general tests on one clean candidate; publish exact head/manifest and independent P2/DBA verdicts. No concatenation of earlier role passes into final acceptance.
5. Actual current recording capture/transfer and different-new-target restore remain DBA/custodian gates. PR51 stays draft/unmerged; main, provider activation and production remain unchanged.
