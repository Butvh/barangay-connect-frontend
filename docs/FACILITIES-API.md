# Facilities: demo API and future Laravel/MySQL contract

## Boundary

This release implements frontend/browser demo workflows only. No PHP, Laravel application or MySQL database is included. Components call `Api.facilities`; replacing that adapter with authenticated same-origin fetch calls does not require replacing the UI. Web Locks serialize demo writes. The `facilities` subscription refreshes this tab and other tabs sharing this origin/browser storage. Different devices require a backend.

Demo writes resolve the current session ID against stored users, then enforce active role and management scope. Browser data remains editable and is not a production security boundary. Laravel must independently authenticate and authorize every operation using session/Sanctum middleware, CSRF protection and policies/gates. Remove demo passwords, quick sign-ins and reset from production.

## API

| Adapter | Future route | Result |
| --- | --- | --- |
| `facilities.list({type?,active_only?})` | GET /api/facilities | 200 scoped projections |
| `facilities.get(id)` | GET /api/facilities/{facility} | 200 projection |
| `facilities.create(input)` | POST /api/facilities | 201 projection |
| `facilities.update(id,{...patch,expected_revision})` | PATCH /api/facilities/{facility} | 200 projection |
| `facilities.setStatus(id,{status,expected_revision})` | PATCH /api/facilities/{facility}/status | 200 projection |
| existing `alerts.logRescue(id,input)` | POST /api/alerts/{alert}/rescues | Joined alert; active destination rechecked atomically |

No delete API. Deactivation retains the facility and relationships. List queries preserve the existing `Evacuation Center` alias; canonical type values are EvacuationCenter and Hospital.

## Database and validation

| Field | MySQL / validation |
| --- | --- |
| id | Immutable server-generated unsigned bigint PK |
| barangay_id | Nullable barangay FK: null means shared referral visibility |
| managed_by_barangay_id | Management-owner barangay FK, assigned by server independently of shared visibility |
| name | varchar(160), required trimmed nonempty text |
| type | varchar(32), required EvacuationCenter or Hospital |
| address | varchar(300), required trimmed text; independent of pin coordinates |
| capacity | Nullable unsigned integer, 1–999999 when supplied; required for evacuation centers |
| contact | varchar(50), optional trimmed text, blank default; local phone formatting allowed |
| status | varchar(16), Active or Inactive, default Active |
| notes | varchar(300), optional trimmed plain text, blank default |
| map_x/map_y | Nullable decimal(8,5), paired null or both finite 0–100 inclusive |
| revision | Unsigned integer, initial 0; increment on edits/status changes |
| created_at/updated_at | Server timestamps returned as ISO 8601 with timezone |
| created_by/updated_by | Server-set user FKs; nullable only for migrated legacy records |

Only mutable fields plus `expected_revision` are accepted for PATCH. Reject client IDs, scope, ownership, audit fields, revision/history and role flags. Update/status require the latest nonnegative integer expected revision. Stale writes return CONFLICT with no partial mutation. Saving the already-current status at its current revision is a no-op. Validate the complete resulting record for partial updates.

Both coordinates must be supplied together when changing a pin. Missing/blank coordinates remain unpinned, never zero or a fabricated map center. Reject booleans, incomplete pairs, nonfinite and out-of-range numbers. Do not geocode addresses or infer street names from clicks. The demo only has illustrated coverage for barangay 1; other barangays may retain unpinned records but cannot place pins on this illustration. Laravel must check the selected barangay/map coverage.

Suggested append-only history table: `facility_events(id,facility_id,action,actor_id,occurred_at,snapshot_json)`. Demo records keep equivalent history arrays with Created/Edited/Deactivated/Reactivated snapshots. Only managing officials receive audit/history data; public/operator projections expose operational metadata with `can_manage:false`.

## Ownership and legacy records

Missing legacy status means Active without resetting stored data. The original shared hospital ID 2 remains publicly scoped (`barangay_id:null`) but is managed by Sampaguita (1). Legacy projections recognize that documented seed owner only for ID 2. Other shared rows without an explicit owner stay read-only. New records use the signed-in manager's barangay for visibility and ownership. Future production migration must assign shared-record owners explicitly and audit that decision; never infer arbitrary ownership.

Existing IDs and rescue FKs are preserved. Optional metadata is populated on mutation, so no demo schema-version reset is required.

## Policies

| Role | Read | Create | Edit/status |
| --- | --- | --- | --- |
| Captain / Secretary | Own-barangay and public/shared referrals, including inactive | Own barangay | Only managing barangay's records |
| Responder / Rescuer | Scoped/shared operational information, including clearly inactive records | Deny | Deny |
| Resident | Scoped/shared Active public information | Deny | Deny |

Resident `active_only:false` cannot reveal inactive records; direct inactive reads return NOT_FOUND. Derive identity, current active role, barangay, ownership and can_manage from authenticated server data, not payload flags. Shared read access does not grant write access. Foreign private records stay inaccessible. An inactive/removed staff member loses management access even with a previously open page.

## Rescue preservation and races

Add nullable `facility_snapshot` JSON to rescues. Capture the original destination's ID/name/type/address/capacity/contact/notes/status/coordinates for new logs. Before changing a facility, backfill snapshots on legacy linked rescues using its pre-edit state. Never delete or replace rescue FKs.

Joined rescue data returns `facility` as the historical snapshot and `current_facility` as current metadata. Warn if the current destination becomes inactive; never silently replace it. New destinations must be Active even if a stale picker still displays them.

Laravel must authorize, lock the facility and alert in a consistent order, recheck destination availability, transition the alert, insert the rescue/snapshot and create notifications in one database transaction. Concurrent deactivation must reject a new rescue before any state/log/notification changes. Facility edits/status changes use the same lock order and optimistic revision checks.

## Errors and synchronization

Normalize Laravel 422 to ApiError VALIDATION with field errors; 401 AUTH; 403 FORBIDDEN; 404 NOT_FOUND; 409 CONFLICT or INVALID_STATE. Preserve open form drafts on errors. No failure may partially save.

Successful writes return the committed projection and refresh the facilities domain. Production may use authenticated realtime events, polling or invalidation behind `Api.subscribe`. Refresh maps, directories, public evacuation recommendations, dashboards and open destination pickers while retaining applicable filters/selection/zoom. Historical records retain original destination information.
