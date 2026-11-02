# Profile and password API integration contract

## Current frontend boundary

`Api.users.get(currentUser.id)` supplies profile data. `Api.users.update(id, patch)` persists authorized demo profile edits. Officials may update **only** `full_name` and `contact_number` on their own account. Residents keep the existing name/contact/household/map editing contract. Email remains a read-only sign-in identifier. Role flags, barangay, account status, personnel assignments and verification decisions are never editable through Profile. The upper-right official avatar links to `official-profile.html` for Captain, Secretary, Responder and Rescuer, without adding or redesigning sidebar navigation.

The shared `openChangePassword()` component uses `Api.account.security()` and `Api.account.changePassword(input)`. The default browser-demo adapter explicitly reports `password_change_available: false` and rejects updates with `NOT_AVAILABLE`. It does not compare against the browser's seed password, modify credentials, emit a success notification, or write credentials to localStorage, sessionStorage, history, activity logs or notifications. Typed values remain only in password inputs and transient function arguments; they are cleared on successful close, Cancel, Close, Escape, outside dismissal and pagehide. Duplicate submissions and dismissal during an in-flight update are blocked. All three visibility toggles are independent.

The existing demo login/registration still uses fictional browser-stored demo credentials; it is not secure authentication. This task does not replace it or make it suitable for real identities. Do not enter real passwords into the demo. The dialog states the backend limitation before input. Client validation and UI permissions are convenience only, not authorization.

`createApi({ accountTransport })` is the integration seam for the future authenticated server adapter. Its `changePassword` method must resolve with `{ password_changed: true }` **only after the server confirms the update**, otherwise reject an `ApiError`. Missing/malformed confirmation is an error. There is no default network request, fake success, browser hashing or demo password persistence.

## Proposed Laravel endpoints

| Endpoint | Behavior |
| --- | --- |
| GET /api/v1/me | Safe account DTO: id, full_name, email, contact_number, assigned role, barangay_id, actual account status, optional reliable last_login_at. Never return password/hash. |
| PATCH /api/v1/me | Owner-only allowlisted personal fields; return updated safe DTO. Role, barangay, status, email and administrative fields must be rejected. Use a separate verified email-change flow if introduced later. |
| GET /api/v1/me/security | Authenticated capability DTO including password_change_available. Derive server availability/policy, not a browser flag. |
| PUT /api/v1/me/password | Authenticated current_password, password, password_confirmation; perform all verification and updates on server. |
| POST /api/v1/logout | End current authenticated session and invalidate its session token; maintain the existing UI sign-out destination. |

For password updates require all three strings, current password verification using Laravel's current_password rule/Hash::check, new password confirmed, at least 8 characters with ASCII uppercase, lowercase and a digit, max 128, and different from current password. Do not trim or normalize passwords. Apply the policy on the server even if frontend validation passes. Store only a secure Laravel Hash::make result (Argon2id or the deployment's approved password hasher); never plaintext or reversible encryption. Do not return password values or log request bodies. Use HTTPS in deployment, authenticated secure HttpOnly cookies, CSRF protection, rate limits, and authorization gates. The demo's browser session ID must never be accepted as server authentication.

Return 200 `{ password_changed: true }` after committed update. Use 401 for unauthenticated, 403 for blocked account/policy, 419 for CSRF/session expiry, 422 for validation/current-password mismatch, 429 for rate limits, 503 for unavailable service. Adapt trusted field errors to existing ApiError.fields keys (`current_password`, `password`, `password_confirmation`) with static messages that never echo credentials. Do not expose raw server response bodies. Keep secrets out of console/telemetry and screenshots.

Recommended session policy: rotate the current session identifier after update and invalidate other sessions according to the agreed account policy. If forced reauthentication is required, the adapter must complete logout/redirect explicitly; do not pretend the existing demo session is a server session. The backend should send a security notification without including passwords.

## Data and truthful presentation

Existing users already have full_name, email, contact_number, barangay_id, role flags and optional personnel_status. The frontend derives Active only from current valid role access when no explicit personnel status exists. Laravel should return its actual account status. The barangay DTO may supply `municipality` or `city`, and `address`; these are official barangay facts, not the official's household address. Missing values display Not recorded. A reliable server-provided `last_login_at` may be formatted; none is fabricated from page visit time. Device/session information is omitted until the authentication backend supplies it.

Add last_login_at if required on users and update it on successful server authentication. Profile updates must preserve household, verification, role and staffing records. For new server authentication, design credentials/sessions/recovery and migration of fictional demo data separately. No Laravel application, MySQL migration, real password update or external notification is implemented in this frontend patch.
