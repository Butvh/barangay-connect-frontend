# Messaging, Make and recovery operations

November 3 contract update: see [INTEGRATION-CONTRACT-V2.md](INTEGRATION-CONTRACT-V2.md). V1 remains explicit legacy; the Make import candidate now defaults to announcement.published.v2 / announcement-published.v2. The stateless command accepts either explicitly registered v1 or v2 pair and rechecks the persisted matching event. No prototype aliasing or SMS permission for P1-domain events is added.

## Current integration status

Code and offline fakes are supplied; no live Semaphore key, sender approval, Make workspace/scenario or hosting/worker access was provided. The Make blueprint is an unconfigured, redacted import candidate; importing/configuring it in the real workspace and capturing a controlled end-to-end trace remain external work. No real SMS or credit purchase is authorized or performed.

Official references rechecked November 2, 2026: [Semaphore API](https://api.semaphore.co/docs), [Make webhook API-key authentication](https://apps.make.com/gateway), [Make webhook behavior](https://help.make.com/webhooks), [incomplete executions](https://help.make.com/incomplete-executions). The implementation uses the standard HTTPS messages endpoint. Its POST/GET limits are 120/30 requests per minute, tracked across workers in MySQL, with Retry-After respected on sending. Provider Queued/Pending/Sent/Failed/Refunded are retained; Sent means delivery to the network. A TEST-prefixed message is never used.

## Environment placeholders

Keep secrets in managed server configuration, outside Git, browser, public storage, issue comments and CI artifacts. P1 copies these names into its environment example and shared config; blank defaults disable external sends.

```dotenv
SMS_ENABLED=false
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
SMS_TEST_RECIPIENT_ALLOWLIST=
SMS_DAILY_SEGMENT_BUDGET=0
SMS_MAX_SEGMENTS=1
SMS_DESTINATION_PEPPER=
MAKE_ENABLED=false
MAKE_WEBHOOK_URL=
MAKE_WEBHOOK_API_KEY=
MAKE_CREDENTIAL_ID=announcement-v1
MAKE_COMMAND_TOKEN=
MAKE_BARANGAY_ID=0
```

Generate independent high-entropy secrets for destination HMAC pepper, Make webhook API key and Make callback token (at least 32 characters). APP_KEY encrypts destination numbers at rest; preserve/rotate it with an appropriate decryption plan. Keep runtime/migration database accounts separate; grant only required table privileges and connect privately. Database/session/application keys, hosting document root and same-origin HTTPS/cookie topology are P1 dependencies.

Normalize allowlist mobile numbers to 639xxxxxxxxx. An empty list or zero budget blocks all sends. The budget reserves estimated segments per logical delivery on the Manila day of first send and remains conservatively reserved after definite rejection; it never automatically refunds an uncertain request. Carry-over retries retain their original reservation. Reconcile the ledger and provider balance before increasing/releasing budget. This is a staging segment guard, not a billing estimate or authorization to spend. Only fixed ASCII templates are emitted; extension characters count two GSM units, multipart uses 153-unit segments and unsupported Unicode is rejected. Confirm the actual provider charge in the controlled trace. Do not enable premium priority/OTP endpoints: the urgent **Laravel queue** remains on the ordinary messages endpoint.

## Queue and scheduler setup for P1/host operator

After the registration handoff and migrations, set QUEUE_CONNECTION=database and retry_after=180. Supervise independent processes, restart them on deploy and retain private logs:

```sh
php artisan queue:work database --queue=sms-urgent --sleep=1 --tries=1 --timeout=30
php artisan queue:work database --queue=sms-default --sleep=2 --tries=1 --timeout=30
php artisan queue:work database --queue=sms-reconcile --sleep=2 --tries=1 --timeout=30
php artisan queue:work database --queue=automation --sleep=2 --tries=1 --timeout=30
php artisan queue:work database --queue=messaging-control --sleep=1 --tries=1 --timeout=60
php artisan schedule:run
php artisan queue:failed
php artisan queue:restart
```

Run schedule:run from private host cron every minute. DispatchOutbox belongs on messaging-control every minute; its durable scan queues SMS and reconciliation as needed. For urgent latency, P1/P2 enqueue it after domain commit as well. Never use synchronous queues with live domain transactions. Monitor the oldest undispatched event/lease, exhausted outbox attempts, blocked/uncertain sends, failed_jobs, default-vs-urgent depth, unconfirmed Make dispatches, budget reservations and queue worker heartbeats. Host alerts are an operational dependency; no notification destination was supplied. Alert on outbox attempts >=10 or Make attempts >=5 with no callback, not just failed_jobs (safe provider rejections are ledger states).

## One nonurgent Make scenario

1. Import [make-announcement.blueprint.json](make-announcement.blueprint.json) into the authorized team. Keep the scenario OFF until all placeholders are replaced/reviewed. Module IDs/export schema can vary by Make app version; if import validation needs adjustment, build the same two modules manually using these instructions and export the resulting redacted blueprint. No import has been claimed tested.
2. Create Webhooks > Custom webhook. Enable API Key authentication, store the independent webhook API key in its keychain, and configure Laravel's MAKE_WEBHOOK_URL/MAKE_WEBHOOK_API_KEY. Outbound requests use `x-make-apikey`, supported by Make's documented custom webhook authentication. Enable explicit data-structure validation: event_id UUID, barangay_id integer, type/template_key strings, timestamp integer. Only the five minimal fields are mapped. The webhook URL alone is insufficient authentication.
3. Add a filter allowing canonical type announcement.published.v2, event template announcement-published.v2 and the one configured barangay. Do not allow SOS/incident events into this scenario. Deliberate legacy support uses its separate registered v1 pair.
4. Add HTTP > Make a request to the team's HTTPS Laravel `/api/v1/integrations/make/sms-commands`. Store the scoped bearer token in an HTTP credential/keychain, not in an exported mapper. Supply X-Credential-Id: announcement-v1. JSON body contains event_id/barangay_id/type/template_key from the webhook plus current Unix seconds (`formatDate(now; "X")`). Never map recipient numbers, user-selected text or provider keys. Laravel rechecks committed event scope and template, then uses only server-persisted recipients.
5. Enable Store incomplete executions (off by default), keep data-loss behavior off and configure a Retry/Break error handler plus operator alert. Replays may retry **only this idempotent Laravel command**. A 202 with duplicate=true is success. On 401 stop and rotate/fix the credential; on 403/409/422 inspect the contract/scope/timestamp rather than substituting recipients. Generate a fresh timestamp when manually replaying an old command. Handle 429/5xx within bounded scenario retries; inspect incomplete executions instead of silently discarding them.
6. Run immediately; sequential processing may aid inspection, but Laravel deduplication is still required. Put a Webhook response module last if one is added. Default webhook acceptance means queued receipt, not completed command/SMS. Laravel retries an unconfirmed webhook at most five times; repeated callbacks cannot duplicate a logical send. Watch Make's queue and execution limits and unconfirmed make_dispatches.
7. Keep credentials in the live connection only. Export a redacted final blueprint, record scenario ID/owner and configuration evidence privately, then run the approved nonurgent trace. The committed blueprint deliberately contains placeholder hook, URL and credential references.

The callback requires enabled Make config, a scoped bearer token/credential ID, a timestamp within 300 seconds, a committed matching event and an existing automation dispatch. Unknown fields are rejected. Scope is fixed by MAKE_BARANGAY_ID; use separate scoped credentials/deployments before extending to multiple barangays. No arbitrary SMS relay is provided. Captured commands replay as accepted duplicates only for the same semantic event.

During canonical v2 setup, use type `announcement.published.v2` and event template `announcement-published.v2` in the scenario filter. The SMS receipt still uses `announcement-review.v1`: transport template versions are independent from event-envelope versions. Retain v1 filters only for deliberately supported legacy rows; do not rewrite queued events or send an event by both routes.

## Failure/reconciliation procedure

Inspect only IDs, state, provider status and safe error class; do not log request bodies, GET query strings, provider raw responses, destinations, full contact records or webhook URLs. Restrict HTTP tracing and APM request capture for provider endpoints (GET authentication is a provider query parameter). Job payloads contain internal ledger IDs only.

- Queued/Pending: provider accepted; the reconciliation worker polls the known message ID, at the shared GET limit. Do not POST again.
- Sent: network_sent, never label handset delivered without independent evidence. Failed awaits refund; Refunded is terminal. Neither causes an automatic resend.
- Rate limit: definite rejection; bounded exponential delay/jitter waits at least Retry-After. The scheduler later requeues the pending row. Normal job retries are disabled to keep the ledger authoritative.
- Low balance, disabled provider, unapproved recipient/sender, exhausted budget/attempts: blocked with safe error class. Fix the underlying setup with authorized budget, then review a specific never-accepted row before returning it to pending. Do not bulk reset accepted/failed/uncertain rows.
- Timeout, malformed success, POST 5xx/redirect or lost sending worker: uncertain. A lost response may have accepted/charged the message. Hold it, inspect the attempt window/provider account and obtain independent evidence. Without a provider ID, matching a destination/time/body is not proof of identity or nonacceptance; require operator review. Do not automatically resend. If an exact provider ID is established, record the evidence privately, attach only that ID through an approved administrative procedure, and use GET reconciliation. No public endpoint performs this override.
- Outbox lease expired: safe to reclaim; channel receipts prevent repeating a completed in-app channel. Valid durable SMS intent remains independent from an in-app failure. Review the static diagnostic before a targeted requeue; do not delete receipts.

For the current dispatcher, an **unbound handler** is a terminal `in_app_handler_unbound` contract diagnostic, and a void handler that creates no notification is `in_app_result_missing`. Unknown types, wrong versions/templates/payloads, missing v2 audience or unauthorized SMS flags block the event once with blocked_at/last_error; invalid envelopes create no successful receipts. Generic transient failures still retry at most10 claims before `dispatch_attempts_exhausted`. Current-source revocation produces an explicitly failed in-app receipt with diagnostic_code/failed_at, never false completion. Restore the owner-supplied handler or correct the producer contract first, then authorize a targeted requeue. Clear blocked_at and reset the affected failed receipt to pending only after reviewing event/recipient/template; preserve completed receipts and all SMS attempt/uncertainty history. Never erase ledger rows to make a replay succeed.

Pause SMS/Make flags during a credential incident; restart workers after config cache refresh. Rotate Semaphore key with the provider, update server secret, verify with a fake/safe read and preserve ledger history. Rotate Make webhook key and callback bearer independently; disable the scenario while switching, then resume/replay the existing event IDs with fresh timestamps. No migration is needed for rotation. APP_KEY rotation must retain access to already encrypted destinations; do not overwrite it without a tested re-encryption/previous-key plan.

## Backup, migration and controlled acceptance

Before shared/staging migrations, back up MySQL consistently and private object bytes plus their manifest to encrypted storage outside checkout/web root. Use protected client option files, not passwords in process arguments. Preserve recovery keys separately. Restore into an isolated database and private storage location; verify schema FK definitions, counts, orphan joins and file hashes. The automated test rehearses encrypted fictional SQL/file restore on the real MySQL engine; an actual hosting backup/restore and measured storage/worker recovery still require access.

Migration rollback removes tables and is only tested on disposable data. Production uses additive expand/contract and reviewed forward fixes after backups. Document root is backend/public, never the repository. No SQL dumps, logs, private uploads, vendor, secrets or docs may appear in Pages artifacts; P1 owns that gate before merge.

For a specifically authorized staging send, record: commit, event ID, channel/route, scope and consented recipient evidence privately, approved sender/segment budget, outbox/receipt/attempt IDs, provider message ID and exact provider status, Make execution ID for nonurgent, and actual recipient confirmation separately. Do not claim API acceptance or network-sent as handset receipt. This runbook contains no live evidence or authorization.
