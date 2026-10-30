import { alertsPage, incidentAssignment } from '../assets/js/pages/official-alerts-model.js';
import * as alertsModel from '../assets/js/pages/official-alerts-model.js';

export function registerAlertsModelTests({ test, equal, ok, fixture }) {
  test('Alerts workspace joins the correct barangay regardless of which API read finishes first', async () => {
    for (const first of ['alerts', 'barangays']) {
      let resolveAlerts, resolveBarangays;
      const pendingAlerts = new Promise(resolve => { resolveAlerts = resolve; });
      const pendingBarangays = new Promise(resolve => { resolveBarangays = resolve; });
      const result = alertsModel.alertWorkspace({ alerts: { list: () => pendingAlerts }, barangays: { list: () => pendingBarangays } }, { barangay_id: 1 });
      const finish = { alerts: () => resolveAlerts([{ id: 1042 }]), barangays: () => resolveBarangays([{ id: 2, name: 'Other barangay' }, { id: 1, name: 'Barangay Sampaguita' }]) };
      finish[first](); await Promise.resolve(); finish[first === 'alerts' ? 'barangays' : 'alerts']();
      equal(await result, { alerts: [{ id: 1042 }], area: 'Barangay Sampaguita' });
    }
  });
  test('Alerts search, status, disaster type and sorting compose without changing source records', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const user = f.authA.current(), rows = await f.apiA.alerts.list(), before = JSON.stringify(rows);
    equal(alertsPage(rows, user, { q: 'Riverside', status: 'Pending', alert_type: 'Flood' }).rows.map(a => a.id), [1042]);
    equal(alertsPage(rows, user, { q: 'fallen tree' }).rows.map(a => a.id), [1038]);
    equal(alertsPage(rows, user, { q: 'Maria Santos' }).total, 1);
    equal(alertsPage(rows, user, { sort: 'oldest' }).rows.map(a => a.id), [1031, 1038, 1042]);
    equal(alertsPage(rows, user, { q: 'no matches' }).total, 0); equal(JSON.stringify(rows), before);
  });
  test('Alerts pagination clamps after filtering and counts all matching assigned records', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const rows = await f.apiA.alerts.list(), user = { ...f.authA.current(), id: 2, is_secretary: false, is_responder: true };
    const data = alertsPage(rows, user, { page: 9, size: 1 }); equal(data.total, 2); equal(data.page, 2); equal(data.pages, 2); equal(data.rows.map(a => a.id), [1031]);
    const filtered = alertsPage(rows, user, { status: 'Rescue in progress', page: 2, size: 1 }); equal(filtered.page, 1); equal(filtered.total, 1);
    equal(alertsPage(rows, user, { q: 'Maria Santos' }).total, 0);
  });
  test('assignment facts retain actual personnel on resolved history and use genuine assignment times', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const a = await f.apiA.alerts.get(1031), secretary = f.authA.current();
    ok(incidentAssignment(a, secretary).person.includes('Ramon Bautista (Rescuer)'));
    equal(incidentAssignment(a, secretary).at, a.created_at);
    await f.login(f.authA, 'carlo.mendoza'); const responder = incidentAssignment(a, f.authA.current()); equal(responder.person, 'Carlo Mendoza (You)'); equal(responder.at, a.acknowledged_at); equal(responder.timeLabel, 'Assigned at:');
    await f.login(f.authA, 'ramon.bautista'); const rescuer = incidentAssignment({ ...a, responses: [{ responded_at: 'invalid' }, { responded_at: '2026-10-03T16:45:00+08:00' }, ...a.responses] }, f.authA.current()); equal(rescuer.at, null);
    equal(incidentAssignment({ ...a, responses: [] }, f.authA.current()).at, null);
    equal(incidentAssignment({ ...a, acknowledged_at: null, responder_assigned_at: null }, { ...f.authA.current(), is_rescuer: false, is_responder: true }).at, null);
  });
}
