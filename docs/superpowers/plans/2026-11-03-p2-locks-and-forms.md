# P2 lock protocol and operational form execution

Spec: user's immediate P2 task (lock correction before form integration), shared November2 backend plan. Base `3d23092883e0f24aa89b4c86ce93862e35880e3e`; P1 `c0a32cf`; DBA `3d2b3a2`. Existing clean P2 worktree reused; owner heads fetched. No applicable repository AGENTS.md found.

1. Reproduce assignment versus resident details with actual services on independent MySQL processes/connections, deterministic lock barriers. Watch RED. Separate mutable guarded eligibility from display/recipient reads; retain current authorization/generation/capacity and rollback. Review other P2 paths, then GREEN plus existing SQL checks.
2. Test and wire P1 submission intents into owned operational forms using unchanged shared transport/factory interfaces. Freeze key/body/original revision across retries; deliberate reopen starts a new intent. Preserve demo design and data; incomplete registration/uploads stay disabled. Verify both original operational branches, retry/stale/privacy.
3. One final whole-change review, fix important findings with regressions, execute owner/frontend/static/artifact/style checks. Publish P2 commit and focused draft PR update; give P1/DBA exact protocol/registration handoffs. Never merge main/teammates or enable real providers.

Pre-flight: task1 defines eligibility/lock semantics consumed by task2 server writes; frontend intents must preserve the revision checked by IncidentService. P1 helper and global registration remain P1-owned; test composition may select candidate bindings without changing production defaults.

Root-cause hypothesis: transaction-sensitive person() converts display/reference reads into new user/appointment locks after incident locks. Assignment then waits for its resident, while that resident's details update waits for the incident. Current eligibility reads are necessary, but display reads must not expand the write lock set.

Task1: implementation complete. Actual assignment/details regression observed MySQL1213 RED (independent worker and real resident service under a caller-held identity row), then GREEN. Early harness barriers exposed guard insert gap-lock interference and were corrected before the valid RED. Mutable eligibility guard-boundary regression also RED→GREEN. Existing current-appointment, generation, capacity, transfer/rescue/destination/rollback/privacy checks retained; final formatted run passed.

Task2: implementation complete for the original SOS/details, acknowledgment/assignment/transfer/cancellation, response/rescue and explicit-resolution controllers. P1's existing helper is injected through configureOperationalSubmissions; missing registration returns NOT_AVAILABLE, not demo persistence. Original SOS handoff, response/rescue retries, cancellation stale revision and resolution tests observed RED→GREEN. Actual original controllers over P1 cookie/CSRF HTTP and MySQL pass both rescue/no-rescue branches, dropped-reply retries, stale revisions and cross-recipient privacy. DOM/navigation and missing P1 reference-page reads remain test boundaries, explicitly not full registered-browser acceptance.

Ruling: require observed revisions at the HTTP details/response/rescue boundary, while retaining old internal service callers — preserves original portable/service checks and rejects incomplete public commands. If wrong: P1/client owners must adapt a documented HTTP contract before registration.

Ruling: map P2 Problem through its own Laravel render method — the real HTTP regression proved route-pipeline rendering bypassed the outer middleware catch and returned500 for a revision conflict. P1's global renderer is unchanged. If wrong: joint exception integration may need to remove the redundant P2 middleware before activation.

Ruling: keep global domain registration, missing P1 source-page readers and private photo bytes disabled — ownership constraints prohibit implementing P1 services. P1 must supply reviewed registration/readers for full browser acceptance; the cost is that this candidate remains draft and cannot be enabled as a complete production integration.

Task3 final review: one whole-change reviewer completed; no second review loop. Four Important findings were fixed with failing regressions followed by GREEN: authorization before private revision comparisons; revision advancement/idempotent replay for details; preserve unknown map coordinates; reject current inactive Tanod membership/account. Existing tests were retained; the existing current-appointment test now calls the explicit mutable eligibility seam instead of display person().

Owner heads advanced during execution. Final frozen composition: P1 aec4e78dab6557a41053d5a76c6ee217db73a16e; DBA b9f7a7e106fe7fe699abad1afd900c6141c38756. Owner source was copied exactly, not patched. P1's new required lock gate and DBA's manual actual-service gate are both green on this correction.

Final verification, November4:

- Genuine MySQL8.4.13, PHP8.5.12/Laravel13.39.0/Testbench11.3.0/PHPUnit12.5.43/Node24.15.0.
- 41 P2 SQL/HTTP/concurrency cases plus two nested original-controller workflow branches pass; isolated evidence DB p2_test_1793723845529. The deterministic regression disables automatic retry at its caller-owned outer transaction.
- Unchanged owner suites:181 tests,795 assertions, zero failures/errors/skips; evidence DB bc_dba_p1_p2final_1793724981841. P1 CombinedP2LockOrderTest passes without edits or skips.
- Unchanged DBA manual order review: late_user_ids=[], lock_order_accepted=true, both workers committed, one response, victim_count0. Isolated InnoDB deadlock counter unchanged. Actual P1-selected production-adapter probe passes with provider calls0; evidence DB bc_dba_p2_finalprobe_1793725715100.
- Original405 frontend checks; portable48;19 Node entries (including original controller scripts); actual P2 factory/shared HTTP8; shared transport16; read-only Pint214 PHP files; Composer strict/platform/locked audit; both artifact and staged-graph suites; scanner471 files: pass.
- Manifest verifies exact owner Git blobs for127 P1 and116 DBA files, plus75 composed P2 sources including page controllers. No migrations/models/shared transports/bootstrap/CI or owner tests changed.
- Harness issues were corrected before these green runs: explicit disposable env required by newer P1; MYSQL_TEST_BIN directory rather than executable; artifact Node realpath blocked in sandbox (unchanged tests rerun escalated). No failure was suppressed. Uncommitted private quick-* diagnostics were excluded from the published-source Pint allowlist.

Remaining gated work: P1 shared helper/factory/reader registration and source-page readers; private photo bytes; actual P1 staffing/deactivation workflow races; full registered-browser five-role release acceptance. Production remains off and PR50 remains draft. Publish this focused P2 correction and request DBA/P1 retest/pin updates; no merge/main update or real messaging is authorized.
