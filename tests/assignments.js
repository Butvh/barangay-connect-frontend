import { assignmentWorkload } from '../assets/js/core/assignments.js';
import { assignmentCards } from '../assets/js/pages/official-assignment-model.js';
import { responderDashboardData } from '../assets/js/pages/official-responder-model.js';
import { rescuerDashboardData } from '../assets/js/pages/official-rescuer-model.js';
import { incidentAssignment } from '../assets/js/pages/official-alerts-model.js';

export function registerAssignmentTests({ test, equal, ok, rejects, fixture }) {
  test('Assignment cards use real workload, escaped names and a single selected radio', () => {
    const p = { role: 'responder', limit: 2, personnel: [{ id: 2, full_name: '<Carlo>', workload: 1, available: true, at_capacity: false }, { id: 20, full_name: 'At capacity', workload: 2, available: false, at_capacity: true }] };
    const html = assignmentCards(p, '', 2);
    ok(html.includes('&lt;Carlo&gt;')); ok(!html.includes('<Carlo>')); ok(html.includes('1 of 2 assignments')); ok(html.includes('2 of 2 assignments'));
    equal((html.match(/ checked/g) || []).length, 1); equal((html.match(/ disabled/g) || []).length, 1); ok(html.includes('Maximum simultaneous assignments reached.'));
    ok(!assignmentCards(p, '', 2, true).includes(' disabled')); ok(assignmentCards(p, 'missing', null).includes('No responders match your search.'));
    ok(assignmentCards({ role: 'rescuer', limit: 1, personnel: [] }, '', null).includes('No active rescuers are registered in this barangay.'));
  });
  const prepare = async f => {
    await f.storeA.transact(['alerts', 'users'], db => {
      for (const a of db.emergency_alerts) if (a.id !== 1042) a.status = 'Resolved';
      const base = db.emergency_alerts.find(a => a.id === 1042);
      for (const id of [2001, 2002, 2003]) db.emergency_alerts.push({ ...base, id, resident_id: null });
      db.users.push({ ...db.users.find(u => u.id === 2), id: 20, full_name: 'Second Responder', email: 'second.responder@example.com' }, { ...db.users.find(u => u.id === 3), id: 21, full_name: 'Second Rescuer', email: 'second.rescuer@example.com' });
    });
    await f.login(f.authA, 'ana.reyes');
  };
  const ack = (api, id = 1042, person = 2, revision = 0, extra = {}) => api.alerts.acknowledge(id, { responder_id: person, expected_revision: revision, ...extra });
  const rescue = (api, id = 1042, person = 3, revision = 2, extra = {}) => api.alerts.assign(id, { role: 'rescuer', personnel_id: person, expected_revision: revision, ...extra });
  const response = (api, id = 1042, status = 'Responding', required = true) => api.alerts.logResponse(id, { response_type: 'Assessment', response_status: status, rescue_required: required, notes: 'Recorded assessment.' });
  test('Manual SOS acknowledgment requires explicit eligible selection and records one atomic handoff', async () => {
    const f = fixture(); await prepare(f);
    const before = f.storeA.read(); await rejects(() => f.apiA.alerts.acknowledge(1042), 'VALIDATION'); equal(f.storeA.read(), before);
    const p = await f.apiA.alerts.assignmentOptions(1042, 'responder'); equal(p.limit, 2); equal(p.alert_revision, 0); equal(p.personnel.map(r => r.id), [2, 20]); ok(p.personnel.every(r => !('password' in r)));
    const a = await ack(f.apiA); equal([a.status, a.assigned_responder_id, a.assigned_rescuer_id, a.acknowledged_by, a.assignment_revision], ['Acknowledged', 2, null, 1, 1]);
    equal(a.assignments.filter(r => r.status === 'active').length, 1); equal(a.assignments.at(-1).assigned_by, 1); equal(a.assignments.at(-1).assigned_at, f.storeA.now());
    const notices = f.storeA.read().notifications.filter(n => n.user_id === 2 && n.link === 'official-alert.html?id=1042'); equal(notices.length, 1);
  });
  test('Malformed assignment payloads fail validation without changing records', async () => {
    const f = fixture(); await prepare(f);
    for (const input of [null, [], 'invalid']) await rejects(() => f.apiA.alerts.acknowledge(1042, input), 'VALIDATION');
    await ack(f.apiA); await f.login(f.authA, 'roberto.aquino');
    const before = f.storeA.read();
    for (const method of ['assign', 'reassign', 'cancelAssignment']) for (const input of [null, [], 'invalid']) await rejects(() => f.apiA.alerts[method](1042, input), 'VALIDATION');
    equal(f.storeA.read(), before);
  });
  test('Assignment dates use the actual handoff and do not invent legacy rescue dispatch times', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    const legacy = await f.apiA.alerts.get(1038); equal(legacy.rescuer_assigned_at, null);
    equal(incidentAssignment(legacy, { is_rescuer: true }).at, null);
    await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB);
    f.setTime('2026-10-05T09:00:00+08:00'); const a = await rescue(f.apiA);
    equal(incidentAssignment(a, { is_rescuer: true }).at, f.storeA.now());
    equal(incidentAssignment({ ...a, responder_assigned_at: f.storeA.now() }, { is_responder: true }).at, f.storeA.now());
  });
  test('Responder capacity is two and a progress log does not release a slot', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await ack(f.apiA, 2001);
    await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB);
    const p = await f.apiA.alerts.assignmentOptions(2002, 'responder'); const carlo = p.personnel.find(r => r.id === 2); equal([carlo.workload, carlo.limit, carlo.available], [2, 2, false]);
    const before = f.storeA.read(); await rejects(() => ack(f.apiA, 2002), 'CAPACITY'); equal(f.storeA.read(), before);
    await response(f.apiB, 1042, 'Completed'); equal(assignmentWorkload(f.storeA.read(), 2, 'responder'), 1); await ack(f.apiA, 2002); equal(assignmentWorkload(f.storeA.read(), 2, 'responder'), 2);
  });
  test('A response never auto assigns rescue; explicit assessment gates manual rescue dispatch', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA);
    await rejects(() => rescue(f.apiA, 1042, 3, 1), 'INVALID_STATE');
    await f.login(f.authB, 'carlo.mendoza'); const a = await response(f.apiB); equal([a.assigned_rescuer_id, a.rescue_required], [null, true]);
    await f.login(f.authB, 'ramon.bautista'); await rejects(() => f.apiB.alerts.get(1042), 'FORBIDDEN');
    const assigned = await rescue(f.apiA); equal(assigned.assigned_rescuer_id, 3); equal(assigned.assignment_revision, 3);
    equal((await f.apiB.alerts.list()).some(a => a.id === 1042), true);
  });
  test('A completed non-rescue assessment resolves without fabricating a rescue stage', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB, 1042, 'Completed', false);
    await rejects(() => rescue(f.apiA), 'INVALID_STATE'); const a = await f.apiA.alerts.resolve(1042);
    equal([a.status, a.rescues.length, a.assigned_rescuer_id], ['Resolved', 0, null]); equal(a.timeline.find(t => t.status === 'Rescue in progress').at, null);
    await rejects(() => f.apiA.alerts.assign(1042, { role: 'responder', personnel_id: 20, expected_revision: a.assignment_revision }), 'INVALID_STATE');
  });
  test('Rescuer capacity is one; completion frees it and in-progress logs retain it', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await ack(f.apiA, 2001);
    await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB); await response(f.apiB, 2001);
    await rescue(f.apiA); await rejects(() => rescue(f.apiA, 2001), 'CAPACITY');
    await f.login(f.authB, 'ramon.bautista'); await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'In progress' }); equal(assignmentWorkload(f.storeA.read(), 3, 'rescuer'), 1);
    await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed' }); equal(assignmentWorkload(f.storeA.read(), 3, 'rescuer'), 0);
    await rescue(f.apiA, 2001); equal(assignmentWorkload(f.storeA.read(), 3, 'rescuer'), 1);
  });
  test('Capacity and same-incident revision are checked against fresh cross-tab state', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'roberto.aquino');
    const p = await f.apiB.alerts.assignmentOptions(2002, 'responder'); equal(p.personnel.find(r => r.id === 2).workload, 1);
    const attempts = await Promise.allSettled([ack(f.apiA, 2001), ack(f.apiB, 2002)]); equal(attempts.filter(r => r.status === 'fulfilled').length, 1); equal(attempts.find(r => r.status === 'rejected').reason.code, 'CAPACITY');
    const before = f.storeA.read(); await rejects(() => f.apiA.alerts.reassign(1042, { role: 'responder', personnel_id: 20, expected_revision: 0, reason: 'Transfer to another member.' }), 'FORBIDDEN');
    await rejects(() => f.apiB.alerts.reassign(1042, { role: 'responder', personnel_id: 20, expected_revision: 0, reason: 'Transfer to another member.' }), 'CONFLICT'); equal(f.storeA.read(), before);
  });
  test('Only Captain can explicitly authorize and audit a reasoned capacity override', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await ack(f.apiA, 2001);
    const override = { confirmed: true, reason: 'Immediate emergency; no other available responder.' };
    await rejects(() => ack(f.apiA, 2002, 2, 0, { override }), 'FORBIDDEN'); await f.login(f.authA, 'roberto.aquino');
    await rejects(() => ack(f.apiA, 2002, 2, 0, { override: { confirmed: true, reason: '' } }), 'VALIDATION');
    await rejects(() => ack(f.apiA, 2002, 2, 0, { override: { reason: override.reason } }), 'VALIDATION');
    const a = await ack(f.apiA, 2002, 2, 0, { override }); const assignment = a.assignments.at(-1);
    equal(assignment.override_by, 7); equal(assignment.override_reason, override.reason); equal(assignmentWorkload(f.storeA.read(), 2, 'responder'), 3);
    ok(f.storeA.read().activity_logs.some(r => r.actor_id === 7 && r.record_id === 2002 && r.summary.includes(override.reason)));
  });
  test('Captain transfers preserve history, revoke former access and do not inherit old completion logs', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB);
    await f.login(f.authA, 'roberto.aquino'); const a = await f.apiA.alerts.reassign(1042, { role: 'responder', personnel_id: 20, expected_revision: 2, reason: 'Rebalance current response work.' });
    equal(a.assignments.map(r => r.status), ['reassigned', 'active']); equal(a.assignments[0].ended_by, 7); equal(a.assigned_responder_id, 20);
    equal(assignmentWorkload(f.storeA.read(), 2, 'responder'), 0); equal(assignmentWorkload(f.storeA.read(), 20, 'responder'), 1);
    await rejects(() => f.apiB.alerts.get(1042), 'FORBIDDEN'); await rejects(() => response(f.apiB, 1042, 'Completed'), 'FORBIDDEN');
    await f.login(f.authB, 'second.responder'); const updated = await response(f.apiB, 1042, 'Completed', false); equal(updated.responses.at(-1).assignment_id, a.assignments.at(-1).id);
    equal(assignmentWorkload(f.storeA.read(), 20, 'responder'), 0); equal(updated.responses.length, 2);
  });
  test('Captain cancellation and rescue replacement preserve progress and explicit reasons', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB); await rescue(f.apiA);
    await f.login(f.authB, 'ramon.bautista'); await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'In progress' });
    await f.login(f.authA, 'roberto.aquino'); await f.apiA.alerts.cancelAssignment(1042, { role: 'rescuer', reason: 'Replacement transport unit required.', expected_revision: 4 });
    const a = await rescue(f.apiA, 1042, 21, 5); equal(a.status, 'Rescue in progress'); equal(a.assignments.find(r => r.user_id === 3).status, 'cancelled');
    await f.login(f.authB, 'second.rescuer'); const completed = await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed' }); equal(completed.rescues.length, 2); equal(assignmentWorkload(f.storeA.read(), 21, 'rescuer'), 0);
  });
  test('Assignments reject wrong role, tenant, inactive people, stale duplicates and operator access', async () => {
    const f = fixture(); await prepare(f);
    await f.storeA.transact(['users'], db => { db.users.push({ ...db.users.find(u => u.id === 2), id: 40, barangay_id: 2 }, { ...db.users.find(u => u.id === 2), id: 41, personnel_status: 'Inactive' }); });
    for (const id of [3, 40, 41, 999]) await rejects(() => ack(f.apiA, 1042, id), 'VALIDATION');
    await ack(f.apiA); await rejects(() => ack(f.apiA), 'INVALID_STATE');
    await f.login(f.authB, 'maria.santos'); await rejects(() => f.apiB.alerts.assignmentOptions(1042, 'responder'), 'FORBIDDEN'); await rejects(() => rescue(f.apiB), 'FORBIDDEN');
    await f.login(f.authB, 'carlo.mendoza'); await rejects(() => f.apiB.alerts.assignmentOptions(1042, 'rescuer'), 'FORBIDDEN');
  });
  test('Legacy assignment workload retains occupied rescue and ignores another personnel completion', async () => {
    const f = fixture(); const db = f.storeA.read(); equal(assignmentWorkload(db, 3, 'rescuer'), 1); equal(assignmentWorkload(db, 2, 'responder'), 0);
    db.emergency_alerts.find(a => a.id === 1038).assigned_responder_id = 20; equal(assignmentWorkload(db, 20, 'responder'), 1);
    equal(f.storeA.read().alert_assignments, undefined);
  });
  test('Latest explicit assessment takes precedence without discarding a required active rescue', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB); await response(f.apiB, 1042, 'Completed', false);
    await rejects(() => rescue(f.apiA, 1042, 3, 3), 'INVALID_STATE'); equal((await f.apiA.alerts.resolve(1042)).status, 'Resolved');
  });
  test('A later no-rescue assessment blocks redispatch after a cancelled rescue', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB); await rescue(f.apiA);
    await f.login(f.authA, 'roberto.aquino'); await f.apiA.alerts.cancelAssignment(1042, { role: 'rescuer', reason: 'Assessment changed; operation stood down.', expected_revision: 3 });
    await response(f.apiB, 1042, 'Completed', false);
    equal((await f.apiA.alerts.get(1042)).can_assign_rescuer, false); await rejects(() => rescue(f.apiA, 1042, 3, 5), 'INVALID_STATE');
  });
  test('Legacy resolution preserves prior completion and records the closing official for active work', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); f.setTime('2026-10-04T15:00:00+08:00'); const a = await f.apiA.alerts.resolve(1038);
    const responder = a.assignments.find(r => r.role === 'responder'), rescuer = a.assignments.find(r => r.role === 'rescuer');
    equal([responder.status, responder.ended_at, responder.ended_by], ['completed', '2026-10-04T13:50:00+08:00', 2]);
    equal([rescuer.status, rescuer.ended_at, rescuer.ended_by], ['closed', f.storeA.now(), 1]);
  });
  test('Personnel and dashboards release completed responsibilities before incident resolution', async () => {
    const f = fixture(); await prepare(f); await ack(f.apiA); await f.login(f.authB, 'carlo.mendoza'); await response(f.apiB, 1042, 'Completed');
    equal(responderDashboardData(await f.apiB.alerts.list(), f.authB.current(), f.storeB.now()).active.length, 0);
    equal((await f.apiB.dashboard.officialStats()).active_alerts, 0);
    await rescue(f.apiA); await f.login(f.authB, 'ramon.bautista'); await f.apiB.alerts.logRescue(1042, { facility_id: 1, rescue_status: 'Completed' });
    equal(rescuerDashboardData(await f.apiB.alerts.list(), f.authB.current(), f.storeB.now()).active.length, 0); equal((await f.apiB.dashboard.officialStats()).active_rescues, 0);
    await f.login(f.authA, 'roberto.aquino'); const person = await f.apiA.personnel.get(3); equal(person.busy_alert_ids, []); equal([person.assignment_workload, person.assignment_limit], [0, 1]);
  });
  test('Internal assignment reasons remain administrative while operational status stays readable', async () => {
    const f = fixture(); await prepare(f); const a = await ack(f.apiA); ok(a.assignments.length > 0);
    await f.login(f.authB, 'maria.santos'); const resident = await f.apiB.alerts.get(1042); ok(!Object.hasOwn(resident, 'assignments')); equal(resident.assigned_responder_id, 2);
    await f.login(f.authB, 'carlo.mendoza'); const operator = await f.apiB.alerts.get(1042); ok(!Object.hasOwn(operator, 'assignments')); equal(operator.active_responder_assignment, true);
  });
}
