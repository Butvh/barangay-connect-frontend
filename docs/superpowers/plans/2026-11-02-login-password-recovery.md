# Login consistency and password recovery implementation plan

> Execute inline with superpowers:executing-plans; use test-first changes and a final fresh review before the authorized main merge.

**Goal:** Preserve both login pages, standardize their text navigation, and add one shared, reference-based recovery dialog ready for secure Laravel integration.

**Architecture:** A transient recovery service owns request/verify/reset progression and server confirmation; the dialog renders that service's state. The browser demo has no transport and fails closed. No credential/code/token storage, email simulation or automatic authentication.

**Tech stack:** Existing native JavaScript modules, dialog/focus helpers, Inter typography and CSS tokens. No runtime dependencies.

**Spec:** User attachment 97d622fb-e37e-4872-8135-7a9dee16122f/Pasted text.txt and three supplied reference images.

## Design and constraints

- Preserve login images, layout, type scale, forms and sign-in behavior. Add a shared text-action class to both portal links; replace Official registration with Forgot password, retain Resident registration.
- Palette follows current navy #172033, blue #1E5AA8, pale blue #EEF4FC, white #FFFFFF and border #D5DBE3. Keep Inter and 48px form actions.
- Single centered white rounded dialog, branded header/close, centered icon/title/subtitle, left-aligned fields; six equally sized code inputs; live shared password requirements. Mobile width stays within viewport and scrolls internally.
- Request accepts normalized email and origin portal, verify accepts six digits, reset accepts unmodified password/confirmation. Only explicit valid server responses advance. Server enforces 10-minute code expiry, single use, hash storage, attempt/rate limits and session invalidation. Browser cooldown supports at least 60 seconds, without claiming server enforcement.

## Review focus

- Malformed server confirmations must not advance or report success.
- Closing/pagehide must invalidate late responses and clear all transient values/timers.
- Invalid/expired codes, expired authorization, rate limits and resend failures retain a usable panel with static non-enumerating errors.
- Six-digit paste, deletion, keyboard movement and long passwords must not truncate or bypass validation.
- Portal links and existing sign-in remain functional; no recovery action changes roles, household or authentication state.

## Tasks

1. **Service and shared password policy** — add tests first in tests/password-recovery.mjs; implement assets/js/core/password-recovery.js, expose Api.recovery, reuse password policy. Cover default unavailable, no persistence, guarded transitions, malformed confirmations, cooldown/expiry, duplicate actions, invalidation, strict success and unmodified long passwords.
2. **Shared UI and login links** — test actual dialog handlers with controlled transport and DOM boundaries; implement assets/js/core/forgot-password.js and assets/css/login-recovery.css. Wire both existing login controllers/HTML without altering authentication handlers. Exercise all stages, code keyboard/paste, visibility, validation, pending/error/cancel/success and origin retention.
3. **Contract and verification** — document Laravel endpoints/data/validation/authorization and explicit backend dependencies. Run full suite/static/syntax checks, compare all three panels in a clearly labeled isolated UI test harness, test real login navigation and unavailable mode at desktop/tablet/mobile, review, PR and merge after checks pass.

## Progress

- Baseline from main: 388 tests passed. Existing linked workspace reused with dedicated branch.
- Service/API and dialog tests were written first (missing modules failed), then passed after implementation. Default API recovery has no account/session/store access and identical unavailable responses for known and unknown emails.
- Final review findings fixed with RED-to-GREEN regressions: cancellation between response resolution and each state mutation; disabled inputs losing focus during stage replacement/error handling. Browser-found stale email field errors also received a failing regression and correction.
- Added the missing envelope symbol to the existing icon set; preserved original sprite bytes/line endings outside the new symbol.
- Browser verified identical portal link font/color/height/padding, both real demo sign-ins, shared unavailable mode, email validation/clearing, Escape and origin retention. An isolated, explicitly fictional test harness outside the repository exercised all three stages, code paste, invalid codes, focus, policy, independent toggles, cancellation and confirmed-response completion. No actual email or account password changed.
- Desktop, 1024px tablet and 320px mobile checked. Six code boxes fit; reset content scrolls internally and keyboard focus reaches Cancel. Browser viewport overrides restored.
- Backend/server enforcement remains pending as documented; no deferred review findings.
- Final full suite: 405 passed, 0 failed. Static/offline check: 390 files passed. Changed JavaScript syntax and diff whitespace checks passed.
