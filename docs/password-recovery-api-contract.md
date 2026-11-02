# Password recovery: frontend boundary and proposed Laravel contract

## Implemented now

Both login pages open the same `openPasswordRecovery({ portal, email })` dialog. `portal` is `resident` or `official`; closing or completing recovery leaves the user on that originating login page. No automatic authentication occurs. Resident registration remains; Official registration is replaced with Forgot password. Existing login forms, demo accounts and authentication behavior remain unchanged.

`Api.recovery` is created with `createPasswordRecovery({ transport, now })`. Configure a future server adapter through `createApi({ recoveryTransport })`; no transport is configured in the browser demo. Its request fails with `NOT_AVAILABLE`, without searching demo accounts, sending mail, generating a code, advancing the panel or pretending to change a password. The first panel explains this limitation before input. Do not enter real credentials into the demo.

The three panel implementations include neutral request feedback, six separate digit boxes with paste/Backspace/arrow navigation, a resend countdown, independent password visibility, live password requirements, validation, loading/duplicate-submit guards, static errors, responsive internal scrolling and normal dialog focus handling. All stages require explicit server confirmation. Request/code/authorization data lives only in the service closure and inputs; there is no localStorage, sessionStorage, cookie, URL, notification or log persistence. Close, Cancel, Back to sign in, Escape, outside dismissal and pagehide clear state, values and timers. A generation guard rejects late responses after clearing.

## Adapter methods and responses

All methods reject `ApiError` on failure. No raw server error text or submitted values should reach UI errors/logs.

| Method / proposed endpoint | Input | Required success response |
| --- | --- | --- |
| `requestCode` / POST `/api/v1/password-recovery/requests` | `{ email, portal }` | `{ accepted: true, challenge_id: string, expires_in: 600, retry_after: 60 }` |
| `verifyCode` / POST `/api/v1/password-recovery/verifications` | `{ challenge_id, code }` where code is exactly six ASCII digits | `{ verified: true, reset_authorization: string, expires_in: 600 }` |
| `resetPassword` / POST `/api/v1/password-recovery/resets` | `{ reset_authorization, password, password_confirmation }` | `{ password_reset: true }` only after the committed update |

Resend calls the request endpoint again with the same email and origin. The server invalidates the old challenge before issuing the replacement. The frontend accepts positive expiry up to 600 seconds and honors a server cooldown of at least 60 seconds (longer Retry-After values up to one day are supported). Malformed or partial responses never advance the workflow. Authorization/challenge strings are opaque; they are never shown or included in public service state. `state()` exposes only `stage` and remaining cooldown seconds.

The request response must be identical for known, unknown and ineligible email addresses, with equivalent timing and rate-limit behavior. Return a dummy opaque challenge for unknown addresses; never return account-existence, role or user details. Use the neutral text “If this email is registered, a verification code will be sent.” An accepted request means accepted for processing, not proof of mail delivery. The code must never be included in an API response or frontend bundle.

Use errors `INVALID_CODE`, `CODE_EXPIRED`, `AUTHORIZATION_EXPIRED`, `RATE_LIMIT`, `VALIDATION`, `NOT_AVAILABLE` or `SERVER`. Use generic invalid/expired responses for nonexistent challenges too. The adapter maps HTTP 422 validation, 429 throttling with Retry-After and 503 unavailability to these codes. Map only trusted field keys (`email`, `password`, `password_confirmation`) to static validation messages. Do not expose arbitrary provider errors, account lookup results or request bodies.

## Future server implementation (not included)

- Public recovery endpoints use HTTPS, appropriate CSRF protections for the deployed authentication model, rate limits by IP and a server-keyed email digest, and mail delivery through server-only configuration. Browser origin/portal is return-navigation metadata, never authority to change a role or select a separate user database.
- Generate each code with a cryptographically secure server RNG, uniformly across 000000–999999. Store a server-keyed digest (or a salted hash plus a server-held pepper), never plaintext. A six-digit code has low entropy; protect the server key and apply verification throttles. Set code expiry to 10 minutes; allow at most five failed verification attempts per challenge, then invalidate it. Issue replacement codes only after at least 60 seconds and invalidate all previous codes for that request/account. Apply additional request/verification limits even if JavaScript is bypassed.
- Successful verification consumes the code and creates a high-entropy, short-lived reset authorization (at most 10 minutes), stored only as a digest server-side. Bind it to the challenge and existing account. The reset endpoint must independently check eligibility, expiry, digest, consumed/superseded state and authorization. Lock/atomically consume the authorization with the password update so simultaneous attempts cannot reuse it.
- Independently validate confirmed passwords: at least 8 characters, uppercase, lowercase and a number; support spaces and longer passphrases up to the documented 128-character limit. Never trim, normalize or silently truncate passwords. Prefer a password hasher configured to handle the entire accepted password (for example Argon2id), and apply a compromised-password check where practical. Do not pass an overlong password to a hasher that truncates it.
- Store only a Laravel-supported secure password hash. Invalidate reset authorizations and existing authenticated sessions/remember tokens as supported by the eventual authentication implementation. Do not log passwords/codes/authorization tokens or send them to analytics. Return success only after commit; never automatically sign the user in.
- Update only the existing account's password and required session/security records. Preserve role flags, barangay, verification, personnel appointments, household and operational records. Real authorization is server-side; client progression and cooldown are UX safeguards only.

Laravel's built-in [password recovery documentation](https://laravel.com/framework/docs/passwords) describes reset links; the requested six-digit code plus verified authorization flow needs a custom server orchestration rather than assuming the default broker implements this UI protocol. Use the framework's [password rules](https://api.laravel.com/docs/12.x/Illuminate/Validation/Rules/Password.html), [hashing](https://laravel.com/framework/docs/hashing) and [rate limiting](https://laravel.com/framework/docs/rate-limiting) facilities in that implementation.

## Suggested future persistence

One recovery challenge record can hold: `id` (opaque UUID), `user_id` (nullable for uniform unknown-email handling), `email_digest`, `code_digest`, `attempts`, `max_attempts`, `expires_at`, `resend_available_at`, `verified_at`, `superseded_at`, `consumed_at`, `authorization_digest`, `authorization_expires_at`, `created_at`, `updated_at`. Keep the request email only as needed for server mail delivery, protected according to the application's data policy. Clean up expired records. No migrations, database, mail provider or Laravel backend are implemented in this patch.
