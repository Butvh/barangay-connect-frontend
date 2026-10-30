import { createSeed } from '../assets/js/data/seed.js';
import { personnelList, personnelGet, addExternalPersonnel, appointPersonnel, reassignPersonnel, removePersonnel } from '../assets/js/core/personnel.js';
import { personnelPage } from '../assets/js/pages/captain-personnel-model.js';
import { personnelDetails } from '../assets/js/pages/captain-personnel-details.js';

export function registerCaptainPersonnelTests({ test, equal, ok, rejects, fixture }) {
  const at = '2026-10-04T14:20:00+08:00';
  const seed = () => { const db = createSeed(); return { db, captain: db.users.find(u => u.id === 7) }; };
  const input = patch => ({ full_name: 'New Staff', role: 'secretary', contact_number: '09171234567', email: 'staff@example.com', address: '1 Mabini Street', emergency_contact: 'Alex, 09181234567', effective_date: '2026-10-04', status: 'Active', notes: '', requirements: [], ...patch });
  test('Personnel Details preserves legacy unknowns without inventing source or appointment metadata', () => {
    const { db, captain } = seed(), row = personnelGet(db, captain, 1), before = JSON.stringify(row);
    const html = personnelDetails(row, 'Barangay Sampaguita');
    ok(html.includes('Ana Reyes')); ok(html.includes('ana.reyes@example.com')); ok(html.includes('Existing personnel'));
    equal((html.match(/Barangay Sampaguita/g) || []).length, 2);
    ok(html.includes('<dt>Source</dt><dd>Not recorded</dd>')); ok(html.includes('No appointment history recorded yet.'));
    ok(!html.includes('External</')); ok(!html.includes('Effective Oct'));
    ok(html.indexOf('data-done') < html.indexOf('data-detail-reassign')); ok(html.indexOf('data-detail-reassign') < html.indexOf('data-detail-remove'));
    equal(JSON.stringify(row), before);
  });
  test('Personnel Details retains actual appointment changes, actor, contacts, requirements and escaped notes', () => {
    const { db, captain } = seed();
    const added = addExternalPersonnel(db, captain, input({ full_name: 'Alex <Staff>', notes: 'Keep <private>', requirements: [{ name: 'proof.png', type: 'image/png', size: 2048 }] }), at);
    const row = reassignPersonnel(db, captain, added.id, { role: 'rescuer', effective_date: '2026-10-04', notes: 'New <duty>', expected_revision: added.revision }, '2026-10-04T15:00:00+08:00');
    const html = personnelDetails(row, 'Barangay <Demo>');
    for (const value of ['Alex &lt;Staff&gt;', 'Barangay &lt;Demo&gt;', '1 Mabini Street', '09171234567', 'Alex, 09181234567', 'proof.png', 'New &lt;duty&gt;', 'Roberto Aquino', 'Secretary to Rescuer', 'Oct 4, 2026']) ok(html.includes(value), `missing ${value}`);
    ok(html.indexOf('Reassigned') < html.indexOf('Added')); ok(!html.includes('No appointment history'));
    ok(!html.includes('<Staff>')); ok(!html.includes('<duty>'));
    const inactive = personnelDetails({ ...row, status: 'Inactive', role: null }, 'Barangay Sampaguita');
    ok(inactive.includes('Inactive')); ok(!inactive.includes('data-detail-reassign')); ok(!inactive.includes('data-detail-remove'));
  });
  test('Personnel Details keeps busy-incident warnings and links without changing their records', () => {
    const { db, captain } = seed(), row = personnelGet(db, captain, 3), before = JSON.stringify(row);
    const html = personnelDetails(row, 'Barangay Sampaguita');
    ok(html.includes('assigned to unresolved incidents')); ok(html.includes('official-alert.html?id=1038')); equal(JSON.stringify(row), before);
  });
  test('Personnel projects the actual same-barangay roster without credentials or invented appointment dates', () => {
    const { db, captain } = seed(); db.users.push({ ...db.users[0], id: 99, barangay_id: 2 });
    const before = JSON.stringify(db), data = personnelList(db, captain);
    equal(data.records.map(r => r.id), [1, 2, 3]); equal(data.tanods.map(r => r.id), [6]);
    equal(data.capacities, { secretary: { used: 1, limit: 3, available: 2 }, responder: { used: 1, limit: 6, available: 5 }, rescuer: { used: 1, limit: 6, available: 5 } });
    equal(data.records[0].appointed_at, null); equal(data.records[0].history, []); equal(JSON.stringify(db), before);
    ok(!JSON.stringify(data).includes('demo1234')); equal(personnelGet(db, captain, 6).role, null);
  });
  test('Personnel guards every domain entry against non-Captains and foreign records', async () => {
    const { db, captain } = seed(); db.users.push({ ...db.users[0], id: 99, barangay_id: 2 });
    const actions = u => [() => personnelList(db, u), () => personnelGet(db, u, 1), () => addExternalPersonnel(db, u, input(), at), () => appointPersonnel(db, u, 6, input(), at), () => reassignPersonnel(db, u, 1, input({ role: 'rescuer' }), at), () => removePersonnel(db, u, 1, input(), at)];
    for (const u of [null, db.users[0], db.users[1], db.users[2], db.users[3], db.users[5]]) for (const run of actions(u)) await rejects(run, u ? 'FORBIDDEN' : 'AUTH');
    for (const run of [() => personnelGet(db, captain, 99), () => reassignPersonnel(db, captain, 99, input(), at), () => removePersonnel(db, captain, 99, input(), at), () => appointPersonnel(db, captain, 99, input(), at)]) await rejects(run, 'FORBIDDEN');
  });
  test('External addition persists validated personal details and metadata while synchronizing one role', () => {
    const { db, captain } = seed(); const row = addExternalPersonnel(db, captain, input({ full_name: ' New Staff ', email: ' STAFF@Example.Com ', requirements: [{ name: 'appointment.pdf', type: 'application/pdf', size: 1024, contents: 'must not persist' }], source: 'tanod', barangay_id: 2, is_captain: true }), at);
    equal([row.full_name, row.email, row.source, row.status, row.role, row.barangay_id, row.appointed_at, row.revision], ['New Staff', 'staff@example.com', 'external', 'Active', 'secretary', 1, '2026-10-04', 1]);
    equal(row.requirements, [{ name: 'appointment.pdf', type: 'application/pdf', size: 1024 }]);
    const u = db.users.find(u => u.id === row.id); equal([u.is_secretary, u.is_responder, u.is_rescuer, u.is_captain, u.is_tanod, u.personnel_status, u.password], [true, false, false, false, false, 'Active', 'demo1234']);
    equal([row.history[0].action, row.history[0].by, row.history[0].effective_date, row.history[0].to_role], ['Added', 7, '2026-10-04', 'secretary']); ok(!Object.hasOwn(row, 'password'));
  });
  test('External addition rejects duplicate email across barangays before changing any collection', async () => {
    const { db, captain } = seed();
    for (const email of [' ANA.REYES@example.com ', 'maria.santos@example.com']) { const before = JSON.stringify(db); await rejects(() => addExternalPersonnel(db, captain, input({ email }), at), 'VALIDATION'); equal(JSON.stringify(db), before); }
    const one = addExternalPersonnel(db, captain, input(), at), two = addExternalPersonnel(db, captain, input({ email: 'different@example.com' }), at); ok(one.id !== two.id);
  });
  test('External addition validates required fields, lengths, phone, email, status and role atomically', async () => {
    const { db, captain } = seed();
    for (const patch of [{ full_name: '' }, { full_name: 'x'.repeat(101) }, { email: 'wrong' }, { contact_number: '' }, { contact_number: 'abcdefg' }, { address: '' }, { emergency_contact: '' }, { role: 'captain' }, { role: 'tanod' }, { status: 'Unassigned' }, { notes: 'x'.repeat(501) }]) { const before = JSON.stringify(db); await rejects(() => addExternalPersonnel(db, captain, input(patch), at), 'VALIDATION'); equal(JSON.stringify(db), before); }
  });
  test('Personnel dates reject impossible, malformed or future days using the Manila demo clock', async () => {
    const { db, captain } = seed();
    for (const effective_date of ['', '2026-02-30', '2026-10-05', '10/04/2026', '2026-10-04T00:00:00Z']) await rejects(() => addExternalPersonnel(db, captain, input({ effective_date }), at), 'VALIDATION');
    const row = addExternalPersonnel(db, captain, input({ effective_date: '2026-10-05' }), '2026-10-04T16:01:00Z'); equal(row.appointed_at, '2026-10-05');
  });
  test('Requirements only accept bounded PDF JPG PNG metadata and do not mutate on failure', async () => {
    const { db, captain } = seed();
    for (const requirements of [[{ name: 'virus.exe', type: 'application/pdf', size: 12 }], [{ name: 'a.pdf', type: 'text/plain', size: 12 }], [{ name: 'a.png', type: 'image/png', size: 5242881 }], [{ name: 'a.jpg', type: 'image/jpeg', size: 0 }], 'not an array']) { const before = JSON.stringify(db); await rejects(() => addExternalPersonnel(db, captain, input({ requirements }), at), 'VALIDATION'); equal(JSON.stringify(db), before); }
    equal(addExternalPersonnel(db, captain, input({ requirements: [{ name: 'proof.JPG', type: 'image/jpeg', size: 5242880 }] }), at).requirements[0].size, 5242880);
  });
  test('Inactive appointments still occupy capacity and cannot create a fourth Secretary', async () => {
    const { db, captain } = seed(); addExternalPersonnel(db, captain, input({ status: 'Inactive' }), at); addExternalPersonnel(db, captain, input({ email: 'third@example.com' }), at);
    equal(personnelList(db, captain).capacities.secretary, { used: 3, limit: 3, available: 0 }); const before = JSON.stringify(db);
    await rejects(() => addExternalPersonnel(db, captain, input({ email: 'fourth@example.com' }), at), 'CAPACITY'); await rejects(() => appointPersonnel(db, captain, 6, input(), at), 'CAPACITY'); equal(JSON.stringify(db), before);
  });
  test('Tanod appointment and removal preserve pool membership, identity, personal data and role history', () => {
    const { db, captain } = seed(); const original = { ...db.users.find(u => u.id === 6) }, users = db.users.length;
    let row = appointPersonnel(db, captain, 6, { role: 'responder', effective_date: '2026-10-03', notes: 'Disaster training', expected_revision: 0 }, at);
    equal([row.role, row.source, row.status, row.revision], ['responder', 'tanod', 'Active', 1]);
    row = removePersonnel(db, captain, 6, { effective_date: '2026-10-04', notes: 'Rotation complete', expected_revision: 1 }, at);
    equal([row.role, row.status, row.source, row.revision], [null, 'Unassigned', 'tanod', 2]); equal(row.history.map(h => [h.action, h.from_role, h.to_role]), [['Appointed', null, 'responder'], ['Removed', 'responder', null]]);
    equal(personnelList(db, captain).tanods.map(r => r.id), [6]); equal(db.users.length, users); const u = db.users.find(u => u.id === 6); equal([u.is_tanod, u.is_responder, u.email, u.personnel_status], [true, false, original.email, 'Unassigned']);
    row = appointPersonnel(db, captain, 6, { role: 'rescuer', effective_date: '2026-10-04', expected_revision: 2 }, at); equal(row.history.length, 3); equal(row.source, 'tanod');
  });
  test('Only unassigned Tanods can use appointment and existing assignments reject duplicate effective roles', async () => {
    const { db, captain } = seed(); await rejects(() => appointPersonnel(db, captain, 1, input(), at), 'INVALID_STATE');
    appointPersonnel(db, captain, 6, input(), at); const before = JSON.stringify(db);
    await rejects(() => appointPersonnel(db, captain, 6, input({ role: 'rescuer' }), at), 'INVALID_STATE'); await rejects(() => reassignPersonnel(db, captain, 6, input(), at), 'VALIDATION'); equal(JSON.stringify(db), before);
  });
  test('Reassignment changes access flags together and preserves source, old details and actor history', () => {
    const { db, captain } = seed(); const row = addExternalPersonnel(db, captain, input(), at);
    const moved = reassignPersonnel(db, captain, row.id, { role: 'rescuer', effective_date: '2026-10-04', notes: 'New duty', expected_revision: row.revision }, at);
    equal([moved.role, moved.email, moved.source, moved.history.length, moved.history.at(-1).by_name], ['rescuer', 'staff@example.com', 'external', 2, 'Roberto Aquino']);
    const u = db.users.find(u => u.id === row.id); equal([u.is_secretary, u.is_responder, u.is_rescuer], [false, false, true]); equal(personnelList(db, captain).capacities.secretary.used, 1);
  });
  test('Removing external personnel preserves the user, history and metadata as Unassigned', () => {
    const { db, captain } = seed(); const row = addExternalPersonnel(db, captain, input(), at), count = db.users.length;
    const removed = removePersonnel(db, captain, row.id, { effective_date: '2026-10-04', expected_revision: row.revision }, at);
    equal([removed.role, removed.status, removed.source], [null, 'Unassigned', 'external']); equal(db.users.length, count); equal(personnelGet(db, captain, row.id).history.length, 2); ok(personnelList(db, captain).records.some(r => r.id === row.id));
  });
  test('Personnel history retains the recorded actor name when an account name later changes', () => {
    const { db, captain } = seed(); const row = addExternalPersonnel(db, captain, input(), at);
    captain.full_name = 'Renamed Captain';
    equal(personnelGet(db, captain, row.id).history[0].by_name, 'Roberto Aquino');
    equal(personnelList(db, captain).activity[0].by_name, 'Roberto Aquino');
  });
  test('Stale writes, backdated changes and repeat removals leave assignments and history unchanged', async () => {
    const { db, captain } = seed(); const row = appointPersonnel(db, captain, 6, input(), at);
    for (const [run, code] of [[() => reassignPersonnel(db, captain, 6, input({ role: 'rescuer', expected_revision: 0 }), at), 'CONFLICT'], [() => removePersonnel(db, captain, 6, input({ expected_revision: 0 }), at), 'CONFLICT'], [() => reassignPersonnel(db, captain, 6, input({ role: 'rescuer', effective_date: '2026-10-03', expected_revision: row.revision }), at), 'VALIDATION'], [() => removePersonnel(db, captain, 6, input({ effective_date: '2026-10-03', expected_revision: row.revision }), at), 'VALIDATION']]) { const before = JSON.stringify(db); await rejects(run, code); equal(JSON.stringify(db), before); }
    removePersonnel(db, captain, 6, input({ expected_revision: row.revision }), at); await rejects(() => removePersonnel(db, captain, 6, input(), at), 'INVALID_STATE');
  });
  test('Personnel role changes cannot strand assigned unresolved SOS incidents and do not erase alert history', async () => {
    const { db, captain } = seed();
    db.alert_responses.find(row => row.alert_id === 1038).response_status = 'Responding';
    for (const id of [2, 3]) { const before = JSON.stringify(db); await rejects(() => reassignPersonnel(db, captain, id, input(), at), 'BUSY'); await rejects(() => removePersonnel(db, captain, id, input(), at), 'BUSY'); equal(JSON.stringify(db), before); equal(personnelGet(db, captain, id).busy_alert_ids, [1038]); }
    db.emergency_alerts.find(a => a.id === 1038).status = 'Resolved'; const alerts = JSON.stringify(db.emergency_alerts);
    removePersonnel(db, captain, 2, input(), at); equal(JSON.stringify(db.emergency_alerts), alerts); equal(db.alert_responses.length, 2);
  });
  test('Reassignment checks the target capacity before releasing the old position', async () => {
    const { db, captain } = seed(); for (let i = 0; i < 5; i++) addExternalPersonnel(db, captain, input({ role: 'rescuer', email: `rescuer${i}@example.com` }), at);
    const before = JSON.stringify(db); await rejects(() => reassignPersonnel(db, captain, 1, input({ role: 'rescuer' }), at), 'CAPACITY'); equal(JSON.stringify(db), before); equal(personnelList(db, captain).capacities.secretary.used, 1);
  });
  test('Personnel filtering combines role, status, source and search and paginates eight rows immutably', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, full_name: `Person ${i}`, email: `p${i}@example.com`, role: i === 0 ? 'rescuer' : 'secretary', status: i === 0 ? 'Inactive' : 'Active', source: i === 0 ? 'tanod' : 'external' })), before = JSON.stringify(rows);
    equal(personnelPage(rows, { page: 2 }).rows.map(r => r.id), [9, 10, 11]); equal(personnelPage(rows, { q: ' p0@ ', role: 'rescuer', status: 'Inactive', source: 'tanod' }).rows.map(r => r.id), [1]); equal(personnelPage(rows, { role: 'responder', page: 99 }).page, 1); equal(JSON.stringify(rows), before);
  });
  test('Two Captain API clients cannot overfill the final role position or persist a duplicate email', async () => {
    const f = fixture(); await f.login(f.authA, 'roberto.aquino'); await f.login(f.authB, 'roberto.aquino');
    await f.apiA.personnel.addExternal(input());
    const attempts = await Promise.allSettled([f.apiA.personnel.addExternal(input({ full_name: 'First race candidate', email: 'first-race@example.com' })), f.apiB.personnel.addExternal(input({ full_name: 'Second race candidate', email: 'second-race@example.com' }))]);
    equal(attempts.filter(row => row.status === 'fulfilled').length, 1); equal(attempts.find(row => row.status === 'rejected').reason.code, 'CAPACITY'); equal((await f.apiA.personnel.list()).capacities.secretary.used, 3);
    const duplicates = await Promise.allSettled([f.apiA.personnel.addExternal(input({ role: 'responder', email: 'race-email@example.com' })), f.apiB.personnel.addExternal(input({ role: 'rescuer', email: 'RACE-EMAIL@example.com' }))]);
    equal(duplicates.filter(row => row.status === 'fulfilled').length, 1); equal(duplicates.find(row => row.status === 'rejected').reason.code, 'VALIDATION'); equal(f.storeA.read().users.filter(u => u.email === 'race-email@example.com').length, 1);
  });
  test('Live Personnel mutations notify the other client and reject stale dialogs without duplicate audit events', async () => {
    const f = fixture(); await f.login(f.authA, 'roberto.aquino'); await f.login(f.authB, 'roberto.aquino'); let changes = 0;
    const off = f.apiA.subscribe('users', () => changes++); const original = await f.apiA.personnel.get(6);
    const row = await f.apiB.personnel.appoint(6, { role: 'secretary', effective_date: '2026-10-04', expected_revision: original.revision }); ok(changes > 0);
    const before = f.storeA.read(); await rejects(() => f.apiA.personnel.remove(6, { effective_date: '2026-10-04', expected_revision: original.revision }), 'CONFLICT'); equal(f.storeA.read(), before);
    await f.apiB.personnel.remove(6, { effective_date: '2026-10-04', expected_revision: row.revision });
    equal(f.storeA.read().activity_logs.filter(a => a.entity === 'personnel' && a.record_id === 6).map(a => a.action), ['Appointed', 'Removed']); off();
  });
  test('Inactive external appointments occupy a position while denying sign-in and direct operational API access', async () => {
    const f = fixture(); await f.login(f.authA, 'roberto.aquino');
    const row = await f.apiA.personnel.addExternal(input({ status: 'Inactive', email: 'inactive-staff@example.com', role: 'responder' }));
    equal((await f.apiA.personnel.list()).capacities.responder.used, 2); await rejects(() => f.authB.login('inactive-staff@example.com', 'demo1234'), 'AUTH');
    await f.login(f.authB, 'carlo.mendoza'); await f.storeA.transact(['users'], db => { db.users.find(u => u.id === 2).personnel_status = 'Inactive'; });
    equal(f.authB.current(), null); await rejects(() => f.apiB.alerts.list(), 'AUTH'); equal(row.status, 'Inactive');
  });
}
