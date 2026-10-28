import { createApi } from '../assets/js/core/api.js';

export function registerFacilityTests({ test, equal, ok, rejects, fixture }) {
  const input = patch => ({ name: 'Community evacuation center', type: 'EvacuationCenter', address: 'Demo School Road', capacity: 120, contact: '', status: 'Active', notes: '', map_x: 41.25, map_y: 62.5, ...patch });
  const manager = async (person = 'ana.reyes') => { const f = fixture(); await f.login(f.authA, person); return f; };
  const hasWrites = f => ok(typeof f.apiA.facilities.create === 'function', 'Facility management API is missing');
  test('Legacy facilities project Active, zero revision and management ownership without resetting storage', async () => {
    const f = await manager(), before = f.storeA.read(); const rows = await f.apiA.facilities.list();
    equal(rows.map(r => [r.id, r.status, r.revision, r.can_manage]), [[1, 'Active', 0, true], [2, 'Active', 0, true]]);
    equal(f.storeA.read(), before); equal(rows[1].barangay_id, null); equal(rows[1].managed_by_barangay_id, 1);
  });
  for (const person of ['ana.reyes', 'roberto.aquino']) test(`${person} creates, edits and changes facility availability while retaining its ID`, async () => {
    const f = await manager(person); hasWrites(f); const row = await f.apiA.facilities.create(input());
    equal([row.status, row.barangay_id, row.managed_by_barangay_id, row.revision], ['Active', 1, 1, 0]);
    const edited = await f.apiA.facilities.update(row.id, { name: 'Updated center', map_x: 0, map_y: 100, expected_revision: 0 });
    equal([edited.id, edited.name, edited.map_x, edited.map_y, edited.revision], [row.id, 'Updated center', 0, 100, 1]);
    const inactive = await f.apiA.facilities.setStatus(row.id, { status: 'Inactive', expected_revision: 1 }); equal(inactive.status, 'Inactive');
    const active = await f.apiA.facilities.setStatus(row.id, { status: 'Active', expected_revision: 2 }); equal(active.status, 'Active');
    equal(f.storeA.read().facilities.length, 3); equal((await f.apiA.facilities.get(row.id)).history.length, 4);
  });
  test('Hospital capacity and map location may remain explicitly unrecorded', async () => {
    const f = await manager(); hasWrites(f); const row = await f.apiA.facilities.create(input({ type: 'Hospital', capacity: '', map_x: null, map_y: null }));
    equal([row.capacity, row.map_x, row.map_y], [null, null, null]);
  });
  test('Facility fields reject invalid text, enums, capacities and coordinate pairs atomically', async () => {
    const f = await manager(); hasWrites(f);
    for (const patch of [{ name: '  ' }, { address: '' }, { name: 'x'.repeat(161) }, { notes: 'x'.repeat(301) }, { contact: 'x'.repeat(51) }, { type: 'Clinic' }, { status: 'Deleted' }, { capacity: '' }, { capacity: -1 }, { capacity: 1.5 }, { capacity: Infinity }, { map_x: null }, { map_y: 101 }, { map_x: -1 }, { map_x: true }, { map_x: 'invalid' }]) {
      const before = f.storeA.read(); await rejects(() => f.apiA.facilities.create(input(patch)), 'VALIDATION'); equal(f.storeA.read(), before);
    }
  });
  test('Client payloads cannot alter facility identifiers, scope, ownership or audit metadata', async () => {
    const f = await manager(); hasWrites(f);
    for (const patch of [{ id: 20 }, { barangay_id: 2 }, { managed_by_barangay_id: 2 }, { created_by: 4 }, { revision: 99 }, { history: [] }]) await rejects(() => f.apiA.facilities.create(input(patch)), 'VALIDATION');
    await rejects(() => f.apiA.facilities.update(1, { barangay_id: 2, expected_revision: 0 }), 'VALIDATION');
    ok(!('delete' in f.apiA.facilities));
  });
  test('Facility updates require the latest revision and do not overwrite another editor', async () => {
    const f = await manager(); hasWrites(f); await f.login(f.authB, 'roberto.aquino');
    await f.apiA.facilities.update(1, { name: 'Secretary edit', expected_revision: 0 }); const before = f.storeA.read();
    await rejects(() => f.apiB.facilities.update(1, { name: 'Stale Captain edit', expected_revision: 0 }), 'CONFLICT'); equal(f.storeA.read(), before);
    await rejects(() => f.apiB.facilities.setStatus(1, { status: 'Inactive', expected_revision: 0 }), 'CONFLICT');
    await rejects(() => f.apiA.facilities.update(1, { name: 'Missing version' }), 'VALIDATION');
  });
  test('Repeat facility status saves are idempotent', async () => {
    const f = await manager(); hasWrites(f); const row = await f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: 0 }); const before = f.storeA.read();
    equal((await f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: row.revision })).revision, row.revision); equal(f.storeA.read(), before);
  });
  for (const person of ['carlo.mendoza', 'ramon.bautista', 'maria.santos']) test(`${person} cannot create, edit or toggle facilities through the demo API`, async () => {
    const f = await manager(person); hasWrites(f); const before = f.storeA.read();
    await rejects(() => f.apiA.facilities.create(input()), 'FORBIDDEN');
    await rejects(() => f.apiA.facilities.update(1, { name: 'Unauthorized', expected_revision: 0 }), 'FORBIDDEN');
    await rejects(() => f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: 0 }), 'FORBIDDEN'); equal(f.storeA.read(), before);
  });
  test('Facility mutations require a session and re-resolve canonical stored roles', async () => {
    const f = fixture(); hasWrites(f); await rejects(() => f.apiA.facilities.create(input()), 'AUTH');
    const spoofed = createApi({ store: f.storeA, auth: { current: () => ({ id: 2, is_captain: true, barangay_id: 1 }) }, wait: () => Promise.resolve() });
    await rejects(() => spoofed.facilities.create(input()), 'FORBIDDEN');
  });
  test('Shared referrals are readable but only their owning barangay can manage them', async () => {
    const f = await manager(); hasWrites(f);
    await f.storeA.transact(['facilities', 'users'], db => { db.facilities.push({ ...db.facilities[0], id: 10, barangay_id: 2 }); db.facilities.push({ ...db.facilities[1], id: 11, managed_by_barangay_id: 2 }); });
    ok(!(await f.apiA.facilities.list()).some(r => r.id === 10));
    equal((await f.apiA.facilities.get(11)).can_manage, false);
    await rejects(() => f.apiA.facilities.update(10, { name: 'Foreign', expected_revision: 0 }), 'FORBIDDEN');
    await rejects(() => f.apiA.facilities.setStatus(11, { status: 'Inactive', expected_revision: 0 }), 'FORBIDDEN');
    await f.storeA.transact(['users'], db => { db.users.find(u => u.id === 1).barangay_id = 2; });
    await rejects(() => f.apiA.facilities.setStatus(2, { status: 'Inactive', expected_revision: 0 }), 'FORBIDDEN');
  });
  test('Residents cannot opt into inactive listings or read an inactive facility directly', async () => {
    const f = await manager('maria.santos'); await f.storeA.transact(['facilities'], db => { db.facilities[0].status = 'Inactive'; });
    equal((await f.apiA.facilities.list({ active_only: false })).map(r => r.id), [2]); await rejects(() => f.apiA.facilities.get(1), 'NOT_FOUND');
  });
  test('Staff read inactive information but public projections omit management history', async () => {
    const f = await manager(); hasWrites(f); await f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: 0 });
    await f.login(f.authA, 'ramon.bautista'); equal((await f.apiA.facilities.get(1)).status, 'Inactive'); equal((await f.apiA.facilities.get(1)).can_manage, false);
    equal((await f.apiA.facilities.list({ active_only: true })).map(r => r.id), [2]);
    await f.login(f.authA, 'maria.santos'); const row = await f.apiA.facilities.get(2); ok(!('history' in row)); ok(!('created_by' in row));
  });
  test('Facility writes persist across stores and emit same-tab and cross-tab refreshes', async () => {
    const f = await manager(); hasWrites(f); let local = 0, remote = 0;
    const offA = f.apiA.subscribe('facilities', () => local++), offB = f.apiB.subscribe('facilities', () => remote++);
    const row = await f.apiA.facilities.create(input()); await f.login(f.authB, 'carlo.mendoza'); equal((await f.apiB.facilities.get(row.id)).name, row.name);
    equal([local, remote], [1, 1]); offA(); offB();
  });
  test('Edits preserve original legacy rescue snapshots and expose current facility availability separately', async () => {
    const f = await manager(); hasWrites(f); const original = f.storeA.read().facilities[0].name;
    await f.apiA.facilities.update(1, { name: 'Renamed destination', expected_revision: 0 }); await f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: 1 });
    await f.login(f.authA, 'ramon.bautista'); const log = (await f.apiA.alerts.get(1038)).rescues[0];
    equal([log.facility_id, log.facility.name, log.current_facility.name, log.current_facility.status], [1, original, 'Renamed destination', 'Inactive']);
    equal(f.storeA.read().rescues.length, 2);
  });
  test('Inactive rescue destinations are rejected at save time without advancing the alert', async () => {
    const f = await manager(); hasWrites(f); await f.apiA.alerts.acknowledge(1042);
    await f.login(f.authA, 'carlo.mendoza'); await f.apiA.alerts.logResponse(1042, { response_type: 'Assessment', response_status: 'Completed' });
    await f.login(f.authA, 'ana.reyes'); await f.apiA.facilities.setStatus(1, { status: 'Inactive', expected_revision: 0 });
    await f.login(f.authA, 'ramon.bautista'); const before = f.storeA.read();
    await rejects(() => f.apiA.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'In progress' }), 'INVALID_STATE'); equal(f.storeA.read(), before);
    const result = await f.apiA.alerts.logRescue(1042, { facility_id: 2, rescue_status: 'In progress' });
    equal(result.rescues[0].facility.name, 'Dalisay District Hospital'); ok(f.storeA.read().rescues.at(-1).facility_snapshot);
  });
}
