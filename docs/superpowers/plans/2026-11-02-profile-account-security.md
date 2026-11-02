# Profile and account security plan

- Preserve Resident Profile structure; add an icon-free outlined Change password action immediately below Save changes (including the existing mobile save placement).
- Build the Official Profile content with the existing official shell: left identity/edit form and sign out, right account status, barangay facts and account/security. Keep role, barangay, email and account status read-only. Missing city/address/login data says Not recorded.
- Use current Inter tokens: navy #172033, blue #1E5AA8/#164785, surface white, background #F4F6F9, border #D5DBE3. Keep compact 24px card padding and 48px primary actions; two columns stack on narrower screens.
- Share one centered password dialog with 3 visibility toggles, live requirement checks, field errors, duplicate-submit guard and clearing on every close. Reuse dialog/focus conventions. No new runtime dependencies.
- Authentication is a browser demo with no secure backend. Default password API fails closed, never writes credentials or simulates success. Show that limitation before entry. Injectable future transport is the single integration boundary; document Laravel validation, hashing, authorization, CSRF, rate limits and session policy.
- Protect owner-only profile updates and reject protected/household changes from officials. Resident editing remains unchanged.
- Write API/model and controller regressions first; verify all roles, validation, cancellation/visibility/clearing, pending/failure/success transport behavior, unchanged demo persistence and protected fields.
- Browser compare with the supplied references, exercise resident and official flows and responsive sizing, obtain fresh read-only review, run all checks and merge through PR after CI passes.

## Verification

- Full suite: 388 passed, 0 failed. Static/offline checks: 383 files passed.
- Real controller regressions cover supported subscriptions, owner edits and both deferred refresh/save response orderings. Read-only review reports no remaining actionable findings.
- Browser checks cover Captain, Secretary, Responder and Rescuer avatar navigation; Secretary contact editing; protected fields; unsaved-change cancellation/discard; Resident button order, equal width and no icon; shared dialog validation, independent visibility, live requirements, honest unavailable feedback, clearing and Escape/Close/Cancel.
- Desktop, 1024px tablet and 320px mobile checked. The mobile dialog fits within the viewport and scrolls internally; the official avatar remains accessible.
- Secure password updates remain pending Laravel integration. No actual credential update or fabricated success is included.
