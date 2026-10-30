# Manual emergency dispatch verification

October 30, 2026. Branch `codex/manual-alert-assignments`, based on `8f40ce4`.

## Automated checks

- `node scripts/run-tests.mjs`: 328 tests plus four facility page regression tests passed.
- `node scripts/check.mjs`: offline references, file ownership-neutral assets and size checks passed.
- `git diff --check`: passed.
- Independent final code review: no remaining P1/P2 findings. Review fixes cover latest explicit rescue assessment, legacy completion/closure provenance and cancellation conflict recovery.

The new regression cases were observed failing before their implementations were added. Coverage includes workload 0/1/2, rescuer limit 1, progress versus completion, no-rescue resolution, atomic last-slot races, same-incident revisions, current assignment IDs, former access revocation, tenant/role/inactive selection, Captain override reasons/confirmation, cancellation/replacement history, malformed bodies, unknown legacy timestamps and administrative history privacy.

## Browser checks

Used the isolated fictional demo origin `http://127.0.0.1:8802`; existing user data at other origins was preserved. Separate Secretary, Captain, Responder, Rescuer and Resident sessions exercised the actual UI.

- Secretary Acknowledge opened the shared responder picker. Search/empty state, single radio selection and disabled save behaved correctly; no placeholder roster members were added.
- Acknowledgment explicitly assigned Carlo and recorded Ana as the official. No rescuer was assigned.
- Carlo's response required an explicit rescue-needed choice. A missing choice failed validation; an Assessment with Yes enabled Secretary rescue dispatch.
- Ramon appeared disabled at capacity 1/1 because of his existing active rescue. Secretary had no override control.
- Captain's Map Monitoring reused the same picker. Override required a reason and a separate confirmation. Cancelling confirmation made no assignment.
- Captain closed the other legacy rescue. Secretary's already-open picker updated to Available 0/1 and allowed explicit Ramon selection.
- Ramon logged In progress then Completed with the chosen evacuation center; both records remained visible. Completion released responsibility while leaving official incident resolution separate.
- Captain cancellation opened before rescue progress rejected its stale revision, preserved the reason and required a fresh confirmation of the same active responsibility. Reconfirmation succeeded; incident/history remained intact.
- Captain resolved the incident. A new Resident SOS started Pending with both personnel unassigned.
- Desktop, tablet and mobile picker checks confirmed centered presentation, no horizontal overflow, native radio accessibility, readable wrapping and reachable footer controls. The list uses actual roster size rather than copying fictional reference names.

Full capacity race/override commit and transfer scenarios use isolated automated fixtures; browser checks do not modify the production demo roster or role access.

## Production boundary

This remains a browser demo. Laravel authentication, policies, durable audit, database locking and multi-device concurrency enforcement are future work, specified in `docs/ASSIGNMENTS-API.md`. No Laravel/MySQL backend or database migration was introduced.
