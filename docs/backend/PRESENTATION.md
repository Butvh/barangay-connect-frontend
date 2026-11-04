# Local presentation baseline — November 4/5, 2026

Target: November5 5PM Asia/Manila. Preserve the passing current-pin core by November4 8PM. Photos/SMS enter the November5 8AM candidate only after actual joint tests. Freeze source/data noon, checks by2PM, rehearsal3PM, restart/restore4PM. No new features after freeze. The current review-and-schedule supersedes the older Friday target.

This is the **reviewed isolated disposable profile**, not a public production release. GitHub Pages cannot execute Laravel. Use original frontend, real Laravel session/CSRF, same-origin API and genuine MySQL8.4. No localStorage data/DOM/readers are substituted. Production/worker/SMS/Make remain disabled. Use a private snapshot only, never an ordinary/public checkout or shared database.

## Prepare on the presentation machine

Prerequisites: PHP8.5 with Composer-lock requirements, MySQL8.4 server/clients, Node22, Composer2. For later photo tests also GD. Keep credentials and APP_KEY private. Commands are repository-relative; provide actual local paths via environment, never teammate-specific paths.

1. In the clean reviewed P1 checkout run `node scripts/prepare-integration.mjs`. Enter its returned private directory. Record integration-manifest.json and exact P1/DBA/P2 pins; never change its hashes to make a check pass.
2. Copy backend/.env.example to backend/.env **only if absent**, generate a private APP_KEY, install backend/composer.lock using Composer, check platform/locked audit. Do not overwrite existing private config. Configure a loopback-only disposable MySQL8.4 instance and user allowed to create its new presentation schema. No live/shared migrations.
3. In PowerShell set these session-only values (replace credentials/key privately):

```powershell
$env:APP_ENV='testing'
$env:APP_KEY='<private generated Laravel key>'
$env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='<disposable instance port>'
$env:DB_USERNAME='<local test account>'
$env:DB_PASSWORD='<local test password>'
$env:DB_DATABASE='bc_dba_p1_presentation_20261104_a'
$env:DB_TEST_DATABASE=$env:DB_DATABASE
$env:DB_TEST_DISPOSABLE='1'
$env:P1_PRESENTATION_DISPOSABLE='1'
$env:DB_TEST_HOST=$env:DB_HOST
$env:DB_TEST_PORT=$env:DB_PORT
$env:DB_TEST_USERNAME=$env:DB_USERNAME
$env:DB_TEST_PASSWORD=$env:DB_PASSWORD
$env:SMS_ENABLED='false'
$env:MAKE_ENABLED='false'
$env:OUTBOX_DISPATCH_ENABLED='false'
node scripts/presentation-demo.mjs prepare
node scripts/presentation-demo.mjs serve
```

`prepare` refuses an existing schema, uses the unchanged owner migrations and P1's existing fictional operational fixture. `serve` uses the guarded loopback router/private Laravel public root and actual configured production adapters. Stop with Ctrl+C; restart `serve` with the same environment/dataset. For reset, preserve the old evidence and create a NEW clean snapshot and unique database suffix; no automatic DROP/migrate:fresh/truncation. The old database and private objects remain untouched.

Fictional QA account credentials are generated per preparation and stored only at backend/storage/app/private/presentation-credentials.json. Open that private file locally; choose people.resident/residentRescue/captain/secretary/responder/replacement/rescuer. Never publish it, show passwords in presentation screenshots or copy it into frontend. Official login is /frontend/login.html; resident login is /frontend/resident-login.html. No invented preapproved SMS consent is seeded.

## Rehearsal walkthrough

Use separate browser profiles/private contexts per person. Sign in with each account's real generated email/password. Resident: SOS, location then details; save actual ID. Secretary: Alerts -> that ID -> Acknowledge -> manually select responder. Responder: assigned alert -> Assessment; choose whether rescue is required. No-rescue Completed still requires Secretary/Captain Resolve. Rescue-required: Captain manually assigns rescuer; rescuer logs the visible active destination and completes rescue; official resolves explicitly. Reopen history and Captain reports; show persisted recorded counts rather than static sample totals.

Repeat using residentRescue for the other branch. Demonstrate a stale tab409 without refreshing its original revision, a lost-reply retry with one effect (automated original-browser evidence), and denial for unrelated/unassigned identity. Notifications are in-app only; the automated fixture invokes the actual handler for its own in-app event receipts with external channels disabled. Automatic background workers are not enabled here; do not promise live production notifications/SMS.

Run the full committed CI workflow gates and retain both original browser reports/screenshots at these **current** owner pins. A passing harness is local integration evidence, not hosting/security/external delivery acceptance. [Feature matrix](FEATURE-MATRIX.md) names missing administration and stretch functions.
