# Exact incident-photo authorization — candidate 1

Status: **unratified and unbound**. No photo route, upload control, byte service, metadata migration or attachment write is enabled by this change. This port supplements P1's `Contracts/Photos/IncidentPhotos` / `StagedIncidentPhoto`; it does not replace them. Reviewed current owner heads: P1 `96632bfe320997b3e239be6dbe9444f7ff18b151`, DBA `9d6c699250078a54551944fe4e109bde0cb4fb7c`; previous P2 `acc9f56`.

## Port and implementation

`App\Contracts\P2\IncidentPhotoAuthorization`, implemented by the unbound candidate `App\Services\P2\Persistence\IncidentPhotoPolicy`:

```php
public function assertAttach(EffectiveIdentity $observed, int $incidentId, int $expectedRevision): void;
public function assertDownload(EffectiveIdentity $observed, int $incidentId): void;
```

The identity is the original P1 session-observed identity, including security generation. Never replace it with a freshly constructed identity to recover a failed authorization. The incident ID must come from the persisted attachment's incident relationship on download, or the exact source command on attach. A household ID, nearby incident, filename, supplied token or client photo metadata is not source authority.

## Candidate access decisions requiring ratification

| Operation | Required authority |
| --- | --- |
| Attach | Current active owner resident, same barangay, current Approved residency, Pending/Acknowledged exact incident and unchanged original `assignment_revision`. |
| Download: resident | Current active owner of the exact incident, including resolved history. Current residency approval is required for attaching, not for reading one's existing historical incident. |
| Download: Captain/Secretary | Current active same-barangay administrator, including resolved history. |
| Download: responder/rescuer | Current eligible role and the latest assignment for that exact incident and role belongs to this person, with `active` status on an unresolved incident. Completed/closed assignments and resolved incidents do not authorize operator photo access. |
| Download: replaced/cancelled/unassigned/removed/inactive | Denied. Do not search for any older matching assignment before selecting the latest role assignment. |
| Other resident/household member, nearby, cross-scope, unknown authority | Denied; household membership is not an incident-photo grant. |

P2 accepts P1's November4 narrower photo-purpose proposal: historical operator access is denied even where the operational incident remains readable. P1/DBA must ratify the concrete port/transaction boundary before binding. `closed` here is an assignment state; it does not create a new incident state. Photo access is deliberately narrower than operational incident access. No actor is implicitly allowed to attach for another resident.

## Locking and caller obligations

Attach joins the caller's existing **same-connection** relational `Store::transaction`. Declare the original actor's `person:<id>` and exact `incident:<id>` in its lock plan before calling the policy. All mutable people must be predeclared and locked in sorted order before source locks, following the existing P2/DBA lock protocol. `GuardedStore::assertPersonLocked` and the new `assertIncidentLocked` prove that the caller still holds the declared scope; an arbitrary outer `DB::transaction` is insufficient. Incident-lock bookkeeping is restored on callback exit and exceptions.

Within that boundary the policy uses current locking reads to check P1 identity, source scope, latest approval and original revision. Do not call it after acquiring photo locks. P1's future metadata/token consumption locks come **after** the established person/incident/assignment boundary. Identity revocation raises P1's 401 `ApiProblem`; inaccessible source raises P2 `NOT_FOUND` before disclosing revision; revoked residency is `FORBIDDEN`; stale revision is `CONFLICT`; attach after response begins is `INVALID_STATE`; missing lock scope is a programming `LogicException`.

Download must start outside an existing transaction. It owns a short actor/incident guard transaction and current assignment reads, then releases it. This avoids adding a lower-ranked user lock after unknown caller source/photo locks and avoids a stale repeatable-read identity/assignment decision. It returns no source or file DTO. This is request-time authorization, not a guarantee that revocation interrupts a byte stream already being served.

P1 must still load the real persisted photo association, enforce exact photo scope, token ownership/expiry/replay rules, validate and privately store bytes, and enforce its own cleanup/download protections. The source policy alone does not authorize arbitrary storage paths or staged bytes. Future attach must stay inside the original details command's transaction and idempotent result, preserving the original key/body/revision and source/history/audit/outbox/metadata rollback on one connection. Do not move/delete bytes or call external services inside a retried domain transaction.

P2 accepts the DBA/P1 reporter-owned scoped-FK mapping and people -> incident/assignments -> photo-row ordering. Proposed attach-versus-cleanup rule: after those earlier locks, P1 locks the exact upload metadata and consumes only its own ready, unexpired, unclaimed token; a failed/removing/removed/expired or different-incident token cannot attach. A cleanup claim that wins first causes attachment to fail without changing source/history/outbox; an attachment that wins first makes later cleanup ineligible. Same-command success must replay through the original command outcome, not consume the token twice. Cleanup never waits on incident/user locks after acquiring metadata. P1/DBA own fenced leases, byte operations and the precise token error mapping; no claimed concurrency proof exists before their services/schema are published. P2 has no objection to P1's documented 24h unattached lifetime, private immutable object/input-output digest policy, bounded decode and five-minute fenced cleanup lease; these byte decisions remain P1/DBA implementation scope.

## Integration gate and evidence

No DBA photo metadata migration/model or actual P1 byte service exists on the reviewed heads. The metadata proposal remains a proposal. P1 should ratify the two operations and historical access; DBA should ratify the declared lock protocol and publish reviewed additive schema/models. Only then can P2 integrate actual attach/replay/concurrent-consumption/cleanup tests. Until then all backend photo controls stay unavailable.

The genuine MySQL cases in `backend/tests/P2/sql-photo-policy.php` exercise the actual P1 identity/approval boundary, DBA schema and P2 services. They cover declared locks, own/other residents, both administrators, assigned/unassigned/replaced staff, rescuer assignment and history denial, cancelled assignments, inactive/unassigned appointments, inactive accounts, generation revocation, cross-scope access, original revision, resolved attach, current approval after an earlier snapshot, and sanitized nearby projections. Existing notification projections still contain no photo/token/object-key fields; they use the existing recipient/source-authorization tests. These are source-policy tests, not proof of the still-missing byte integration.
