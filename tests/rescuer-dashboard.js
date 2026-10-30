import { rescuerDashboardData } from '../assets/js/pages/official-rescuer-model.js';

export function registerRescuerDashboardTests({ test, equal, ok, rejects, fixture }) {
  const user = { id: 3, barangay_id: 1, full_name: 'Ramon Bautista' }, now = '2026-10-04T14:00:00+08:00';
  const alert = (id, patch = {}) => ({ id, barangay_id: 1, assigned_rescuer_id: 3, status: 'Responding', created_at: '2026-10-04T13:00:00+08:00', acknowledged_at: '2026-10-04T13:05:00+08:00', responses: [{ responded_at: '2026-10-04T13:06:00+08:00' }], rescues: [], ...patch });
  const rescue = (id, patch = {}) => ({ id, rescuer_id: 3, rescue_status: 'Completed', rescued_at: now, ...patch });
  test('Rescuer projection scopes every count and activity to the assigned user and barangay', () => {
    const data = rescuerDashboardData([alert(1), alert(2, { assigned_rescuer_id: 4 }), alert(3, { barangay_id: 2 })], user, now);
    equal(data.assigned.map(a => a.id), [1]); equal(data.assignedToday, 1); ok(data.activity.every(a => a.alert.id === 1));
  });
  test('Rescuer current assignment uses API order instead of a hardcoded demonstration alert', () => {
    const rows = [alert(9, { status: 'Resolved' }), alert(1038), alert(1042)], before = JSON.stringify(rows);
    const data = rescuerDashboardData(rows, user, now); equal(data.current.id, 1038); equal(data.recent.map(a => a.id), [9, 1038, 1042]); equal(JSON.stringify(rows), before);
  });
  test('Rescuer assignment and completion counts use actual timestamps and Manila dates', () => {
    const rows = [alert(1, { responses: [{ responded_at: '2026-10-03T16:01:00Z' }], rescues: [rescue(1, { rescued_at: '2026-10-03T16:30:00Z' })] }), alert(2, { responses: [{ responded_at: '2026-10-03T15:59:00Z' }], rescues: [rescue(2, { rescued_at: '2026-10-03T15:59:00Z' })] })];
    const data = rescuerDashboardData(rows, user, now); equal(data.assignedToday, 1); equal(data.completedToday, 1); equal(data.finishedToday, 1); equal(data.completedRecords.map(r => r.id), [1]);
  });
  test('Rescuer metrics exclude other rescuers and never infer pickup or transport check-ins', () => {
    const data = rescuerDashboardData([alert(1), alert(2, { rescues: [rescue(1, { rescuer_id: 4 })] }), alert(3, { status: 'Resolved' }), alert(4, { rescues: [rescue(2)] })], user, now);
    equal(data.inProgressToday, 2); equal(data.finishedToday, 2); equal(data.completedToday, 1); equal(data.records.map(r => r.id), [2]);
    for (const field of ['priority', 'pendingCheckIns', 'pickedUpAt', 'transportStage']) ok(!Object.hasOwn(data, field));
  });
  test('Rescuer activity is chronological, read-only and derived from recorded rescue events', () => {
    const data = rescuerDashboardData([alert(1, { rescues: [rescue(4)] })], user, now);
    equal(data.activity.map(a => a.title), ['Rescue · Completed', 'Assigned to rescue', 'Incident reported']); equal(data.activity[0].actor, 'Ramon Bautista · Rescuer'); equal(data.activity[0].at, now);
  });
  test('Rescuer missing and invalid dates do not fabricate activity or today counts', () => {
    const data = rescuerDashboardData([alert(1, { created_at: 'invalid', acknowledged_at: null, responses: [{ responded_at: 'invalid' }], rescues: [rescue(1, { rescued_at: 'invalid' })] })], user, now);
    equal(data.activity, []); equal(data.completedToday, 0); equal(data.assignedToday, 0); equal(data.current.id, 1);
  });
  test('Rescuer empty state has no assignment, activity or completion', () => {
    const data = rescuerDashboardData([], user, now); equal(data.current, null); equal(data.activity, []); equal(data.recent, []); equal(data.completedToday, 0);
  });
  test('Rescuer assignment follows the first response transaction rather than acknowledgement', () => {
    const data = rescuerDashboardData([alert(1, { acknowledged_at: '2026-10-03T12:00:00+08:00', responses: [{ responded_at: '2026-10-04T13:10:00+08:00' }, { responded_at: '2026-10-04T13:06:00+08:00' }] })], user, now);
    equal(data.assignedToday, 1); equal(data.currentAssignedAt, '2026-10-04T13:06:00+08:00'); equal(data.activity.find(a => a.key === 'assigned-1').at, data.currentAssignedAt);
    equal(rescuerDashboardData([alert(1, { responses: [] })], user, now).currentAssignedAt, null);
  });
  test('Rescuer projection follows real logging without loosening the existing forward-only guard', async () => {
    const f = fixture(); await f.login(f.authB, 'ana.reyes'); await f.apiB.alerts.acknowledge(1042, { responder_id: 2, expected_revision: 0 });
    await f.login(f.authB, 'carlo.mendoza'); await f.apiB.alerts.logResponse(1042, { rescue_required: true,  response_type: 'Assessment', response_status: 'Completed', notes: '' });
    await f.login(f.authB, 'ana.reyes'); await f.apiB.alerts.resolve(1038); await f.apiB.alerts.assign(1042, { role: 'rescuer', personnel_id: 3, expected_revision: 2 });
    await f.login(f.authB, 'ramon.bautista'); const currentUser = f.authB.current(); let data = rescuerDashboardData(await f.apiB.alerts.list(), currentUser, f.storeB.now()), before = data.completedToday;
    equal(data.currentAssignedAt, data.current.responses[0].responded_at);
    await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed', notes: 'Fictional rescue dashboard check.' });
    data = rescuerDashboardData(await f.apiB.alerts.list(), currentUser, f.storeB.now()); equal(data.completedToday, before + 1); ok(data.activity.some(a => a.key === `rescue-${data.completedRecords.at(-1).id}`));
    equal(data.assigned.find(a => a.id === 1042).status, 'Rescue in progress');
    await rejects(() => f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed', notes: '' }), 'INVALID_STATE');
  });
}
