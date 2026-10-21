import { responderDashboardData } from '../assets/js/pages/official-responder-model.js';

export function registerResponderDashboardTests({ test, equal, ok, fixture }) {
  const user = { id: 3, barangay_id: 1, full_name: 'Carlo Mendoza' }, now = '2026-10-04T14:00:00+08:00';
  const alert = (id, patch = {}) => ({ id, barangay_id: 1, assigned_responder_id: 3, status: 'Acknowledged', created_at: '2026-10-04T13:00:00+08:00', acknowledged_at: '2026-10-04T13:05:00+08:00', responses: [], ...patch });
  const response = (id, patch = {}) => ({ id, responder_id: 3, response_type: 'First aid', response_status: 'Completed', responded_at: now, ...patch });
  test('Responder data remains scoped to assigned alerts in the current barangay', () => {
    const data = responderDashboardData([alert(1), alert(2, { assigned_responder_id: 4 }), alert(3, { barangay_id: 2 })], user, now);
    equal(data.active.map(a => a.id), [1]); equal(data.assignedToday, 1); ok(data.activity.every(a => a.alert.id === 1)); equal(data.recent.map(a => a.id), [1]);
  });
  test('Responder current assignment preserves API order without mutating records', () => {
    const rows = [alert(9, { status: 'Resolved' }), alert(7), alert(8)], before = JSON.stringify(rows), data = responderDashboardData(rows, user, now);
    equal(data.current.id, 7); equal(data.recent.map(a => a.id), [9, 7, 8]); equal(JSON.stringify(rows), before);
  });
  test('Responder today counts use the Manila calendar boundary', () => {
    const rows = [alert(1, { acknowledged_at: '2026-10-03T16:01:00Z', responses: [response(1, { responded_at: '2026-10-03T16:30:00Z' })] }), alert(2, { acknowledged_at: '2026-10-03T15:59:00Z', responses: [response(2, { responded_at: '2026-10-03T15:59:00Z' })] })];
    const data = responderDashboardData(rows, user, now); equal(data.assignedToday, 1); equal(data.completedToday, 1); equal(data.finishedToday, 1); equal(data.inProgressToday, 0);
  });
  test('Responder metrics exclude other staff responses and distinguish assignment completion', () => {
    const data = responderDashboardData([alert(1), alert(2, { responses: [response(1, { responder_id: 4 })] }), alert(3, { status: 'Resolved' }), alert(4, { responses: [response(2)] })], user, now);
    equal(data.assignedToday, 4); equal(data.finishedToday, 2); equal(data.inProgressToday, 2); equal(data.completedToday, 1); equal(data.completedResponses.map(r => r.id), [2]);
  });
  test('Responder activity uses recorded timestamps without inventing travel or priority', () => {
    const data = responderDashboardData([alert(1, { responses: [response(2)] })], user, now);
    equal(data.activity.map(a => a.title), ['First aid · Completed', 'Assigned to incident', 'Incident reported']); equal(data.activity[0].actor, 'Carlo Mendoza · Responder'); equal(data.activity[0].at, now); ok(!Object.hasOwn(data, 'priority')); ok(!Object.hasOwn(data, 'pendingCheckIns'));
  });
  test('Responder missing timestamps do not become fabricated activities or today counts', () => {
    const data = responderDashboardData([alert(1, { acknowledged_at: null, created_at: 'invalid' })], user, now);
    equal(data.assignedToday, 0); equal(data.completedToday, 0); equal(data.activity, []); equal(data.current.id, 1);
  });
  test('Responder empty projection has no active assignment', () => {
    const data = responderDashboardData([], user, now); equal(data.current, null); equal(data.assignedToday, 0); equal(data.completedToday, 0); equal(data.activity, []); equal(data.recent, []);
  });
  test('Responder projection follows real assignment and response API writes', async () => {
    const f = fixture(); await f.login(f.authB, 'ana.reyes'); await f.apiB.alerts.acknowledge(1042); await f.login(f.authB, 'carlo.mendoza'); const currentUser = f.authB.current();
    let data = responderDashboardData(await f.apiB.alerts.list(), currentUser, f.storeB.now()); ok(data.active.some(a => a.id === 1042)); const before = data.completedToday;
    await f.apiB.alerts.logResponse(1042, { response_type: 'First aid', response_status: 'Completed', notes: 'Fictional dashboard verification.' });
    data = responderDashboardData(await f.apiB.alerts.list(), currentUser, f.storeB.now()); equal(data.completedToday, before + 1); ok(data.activity.some(a => a.alert.id === 1042 && a.title === 'First aid · Completed'));
  });
}
