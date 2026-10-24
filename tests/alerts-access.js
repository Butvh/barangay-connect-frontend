export function registerAlertsAccessTests({ test, equal, ok, rejects, fixture }) {
  const prepare = async f => f.storeA.transact(['users', 'alerts'], db => {
    db.users.push({ ...db.users.find(u => u.id === 2), id: 20, email: 'other.responder@example.com' }, { ...db.users.find(u => u.id === 3), id: 21, email: 'other.rescuer@example.com' });
    const a = db.emergency_alerts.find(a => a.id === 1042);
    a.assigned_responder_id = 20; a.assigned_rescuer_id = 21;
    db.emergency_alerts.push({ ...a, id: 2000, barangay_id: 2, assigned_responder_id: 2, assigned_rescuer_id: 3 });
  });
  test('operators private alert list and direct reads enforce exact assignments and barangay', async () => {
    const f = fixture(); await prepare(f);
    for (const name of ['carlo.mendoza', 'ramon.bautista']) {
      await f.login(f.authA, name);
      const rows = await f.apiA.alerts.list(); ok(rows.every(a => a.id !== 1042 && a.id !== 2000));
      for (const id of [1042, 2000]) await rejects(() => f.apiA.alerts.get(id), 'FORBIDDEN');
      for (const options of [{ q: '1042' }, { resident_id: 4, status: 'Pending' }, { assigned_responder_id: 20 }, { assigned_rescuer_id: 21 }]) ok((await f.apiA.alerts.list(options)).every(a => a.id !== 1042 && a.id !== 2000));
    }
    await f.login(f.authA, 'other.responder'); equal((await f.apiA.alerts.list()).map(a => a.id), [1042]);
    await f.login(f.authA, 'other.rescuer'); equal((await f.apiA.alerts.get(1042)).id, 1042);
    await f.login(f.authA, 'ana.reyes'); equal((await f.apiA.alerts.list()).length, 3);
  });
  test('existing SOS assignments appear live, persist through resolution and revoke on reassignment', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'carlo.mendoza');
    ok(!(await f.apiB.alerts.list()).some(a => a.id === 1042));
    let changes = 0; const off = f.apiB.subscribe('alerts', () => changes++);
    await f.apiA.alerts.acknowledge(1042); ok(changes > 0); equal((await f.apiB.alerts.get(1042)).status, 'Acknowledged');
    await f.login(f.authB, 'ramon.bautista'); await rejects(() => f.apiB.alerts.get(1042), 'FORBIDDEN');
    await f.login(f.authB, 'carlo.mendoza'); await f.apiB.alerts.logResponse(1042, { response_type: 'Assessment', response_status: 'Responding', notes: 'Coordinate extraction.' });
    await f.login(f.authB, 'ramon.bautista'); equal((await f.apiB.alerts.get(1042)).status, 'Responding');
    await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed', notes: 'Transported safely.' }); await f.apiA.alerts.resolve(1042);
    equal((await f.apiB.alerts.get(1042)).status, 'Resolved');
    await f.login(f.authB, 'carlo.mendoza'); equal((await f.apiB.alerts.get(1042)).status, 'Resolved');
    await f.storeA.transact(['alerts'], db => { db.emergency_alerts.find(a => a.id === 1042).assigned_responder_id = null; });
    await rejects(() => f.apiB.alerts.get(1042), 'FORBIDDEN'); ok(!(await f.apiB.alerts.list()).some(a => a.id === 1042)); off();
  });
  test('effective operator role cannot use a resident flag to broaden private incident reads', async () => {
    const f = fixture(); await f.login(f.authA, 'maria.santos');
    await f.storeA.transact(['users'], db => { db.users.find(u => u.id === 4).is_responder = true; });
    equal(await f.apiA.alerts.list(), []); await rejects(() => f.apiA.alerts.get(1042), 'FORBIDDEN');
  });
}
