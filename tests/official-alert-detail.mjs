import assert from 'node:assert/strict';

// The presentation must preserve dispatch authorization and evidence, not just card markup.
const view = await import('../assets/js/pages/official-alert-view.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
assert.equal(typeof view.alertDetail, 'function', 'Alert Detail needs a shared presentation for all official roles');
const { alertDetail, primaryAction } = view;
const staff = role => ({ id: 1, full_name: 'Demo Official', is_captain: role === 'captain', is_secretary: role === 'secretary', is_responder: role === 'responder', is_rescuer: role === 'rescuer' });
const base = {
  id: 42, barangay_id: 1, status: 'Pending', alert_type: 'Flood',
  created_at: '2026-10-04T06:10:00Z', location_label: 'Riverside Street',
  household: { address: '14 Riverside Street' }, resident: { full_name: 'Maria Santos' },
  responses: [], rescues: [], timeline: [], assignments: [],
};
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
check('One header action follows the manual workflow and existing role/ownership rules', () => {
  for (const role of ['captain', 'secretary']) {
    assert.deepEqual(primaryAction(base, staff(role)), { workflow: 'acknowledge', label: 'Acknowledge' });
    const rescue = { ...base, status: 'Responding', can_assign_rescuer: true, rescue_required: true };
    assert.deepEqual(primaryAction(rescue, staff(role)), { assign: 'rescuer', label: 'Assign a rescuer' });
    assert.equal(primaryAction({ ...base, status: 'Acknowledged', assigned_responder_id: 2 }, staff(role)), null);
    assert.deepEqual(primaryAction({ ...base, status: 'Responding', rescue_required: false, response_completed: true }, staff(role)), { workflow: 'resolve', label: 'Resolve' });
    assert.equal(primaryAction({ ...base, status: 'Resolved', can_assign_rescuer: false }, staff(role)), null);
  }
  const response = { ...base, status: 'Acknowledged', active_responder_assignment: true, assigned_responder_id: 1 };
  assert.deepEqual(primaryAction(response, staff('responder')), { workflow: 'logResponse', label: 'Log response' });
  assert.equal(primaryAction({ ...response, assigned_responder_id: 2 }, staff('responder')), null);
  assert.equal(primaryAction({ ...response, active_responder_assignment: false }, staff('responder')), null);
  const rescue = { ...base, status: 'Responding', active_rescuer_assignment: true, assigned_rescuer_id: 1 };
  assert.deepEqual(primaryAction(rescue, staff('rescuer')), { workflow: 'logRescue', label: 'Log rescue' });
  assert.equal(primaryAction({ ...rescue, assigned_rescuer_id: 2 }, staff('rescuer')), null);
  for (const role of ['responder', 'rescuer']) assert.equal(primaryAction(base, staff(role)), null);
});
check('Closed assignments stay historical; only the Captain can modify an eligible assignment', () => {
  const a = { ...base, status: 'Acknowledged', assigned_responder: { full_name: 'Carlo' }, active_responder_assignment: true, responder_assignment_status: 'active', responder_assigned_by_name: 'Captain Demo', assignments: [{ personnel_name: 'Carlo', role: 'responder', status: 'active' }] };
  assert.match(alertDetail(a, staff('captain')), /data-reassign="responder"/);
  assert.match(alertDetail(a, staff('captain')), /data-cancel-assignment="responder"/);
  for (const role of ['secretary', 'responder', 'rescuer']) assert.doesNotMatch(alertDetail(a, staff(role)), /data-reassign|data-cancel-assignment/);
  for (const role of ['responder', 'rescuer']) assert.doesNotMatch(alertDetail(a, staff(role)), /Assignment history/);
  const closed = alertDetail({ ...a, status: 'Resolved', active_responder_assignment: false, responder_assignment_status: 'closed' }, staff('captain'));
  assert.doesNotMatch(closed, /data-reassign|data-cancel-assignment/);
  assert.match(closed, /Carlo/); assert.match(closed, /closed/); assert.match(closed, /Assignment history/);
});
check('Timeline preserves all five stages in reverse order without completing a skipped rescue', () => {
  const html = alertDetail({ ...base, status: 'Resolved', acknowledged_at: '2026-10-04T06:12:00Z', resolved_at: '2026-10-04T06:40:00Z', rescue_required: false, responses: [{ responded_at: '2026-10-04T06:16:00Z' }] }, staff('captain'));
  assert.ok(html.indexOf('data-stage="Resolved"') < html.indexOf('data-stage="Pending"'));
  assert.match(html, /data-stage="Rescue in progress" data-phase="skipped"/);
  assert.match(html, /Not required/);
  assert.match(html, /datetime="2026-10-04T06:12:00Z"/);
  assert.equal((html.match(/data-stage=/g) || []).length, 5);
  const pending = alertDetail(base, staff('captain'));
  assert.match(pending, /data-stage="Responding" data-phase="upcoming"/);
  assert.match(pending, /Not reached/);
});
check('Reporter fallbacks and zero victims are truthful; verification is absent from the summary', () => {
  const html = alertDetail({ ...base, victim_count: 0, resident: { full_name: 'Maria', verification: { review_status: 'Approved' } } }, staff('secretary'));
  assert.match(html, /0 victims/); assert.match(html, /Reporting channel/); assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /Phone call|Approved|Verification/);
  const missing = alertDetail({ ...base, resident: null, household: null, victim_count: null }, staff('responder'));
  assert.match(missing, /Not provided/); assert.match(missing, /Not confirmed/); assert.match(missing, /No photo provided\./);
});
check('Complete logs, filenames and unsafe text are preserved and escaped', () => {
  const a = { ...base, description: '<script>bad</script>', photo_name: '<photo>.jpg', responses: [{ responder: { full_name: 'Carlo' }, response_type: 'Assessment', rescue_required: false, response_status: 'Completed', responded_at: base.created_at, notes: 'Full response note' }], rescues: [{ rescuer: { full_name: 'Ramon' }, facility: { name: 'School' }, rescue_status: 'Completed', rescued_at: base.created_at, notes: 'Full rescue note' }] };
  const html = alertDetail(a, staff('captain'));
  for (const value of ['Carlo', 'Assessment', 'Rescue needed: No', 'Completed', 'Full response note', 'Ramon', 'School', 'Full rescue note', '&lt;photo&gt;.jpg', '&lt;script&gt;bad&lt;/script&gt;']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /<script>|<img[^>]+src="&lt;photo/);
  assert.match(html, /file name/);
});
check('Back navigation and the incident map link retain the actual record ID', () => {
  const html = alertDetail(base, staff('rescuer'));
  assert.match(html, /href="official-alerts.html"/);
  assert.match(html, /href="official-map.html\?alert=42"/);
  assert.match(html, /id="alert-map"/);
});
console.log(`${passed} official Alert Detail presentation tests passed.`);
