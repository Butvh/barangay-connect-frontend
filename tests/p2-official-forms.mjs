import assert from 'node:assert/strict';
import { load } from './p2-form-harness.mjs';
const event = { preventDefault() {} }, settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
let failed = 0;
async function check(name, work) { try { await work(); console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); } }
for (const kind of ['response', 'rescue']) await check(`original ${kind} dialog retries the exact P1 intent and observed revision`, async () => {
  const calls = [];
  const { module, dialogs } = await load('official-alert-actions.js', { role: kind === 'rescue' ? 'rescuer' : 'responder', request: async (_, options) => { calls.push(options); if (calls.length === 1) throw Object.assign(Error('lost reply'), { code: 'NETWORK' }); return { data: { id: 1 } }; } });
  const el = await module.logAlert({ id: 1, assignment_revision: 4 }, kind), form = el.querySelector('form');
  for (const [name, value] of Object.entries({ response_type: 'Assessment', response_status: 'Completed', rescue_status: 'Completed', rescue_required: 'No', notes: 'Original notes' })) form.elements[name] = { value };
  if (kind === 'rescue') { await settle(); el.querySelector('form').querySelector('#choose-destination').events.click(); dialogs.at(-1).choice.events.click(); }
  await form.events.submit(event); await form.events.submit(event);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(calls[0].body.expected_revision, 4);
  assert.equal(calls[0].body.rescue_required ?? false, false);
  if (kind === 'rescue') assert.equal(calls[0].body.facility_id, 17);
});
await check('original resolution sends the revision shown before confirmation', async () => {
  const calls = [];
  const { module } = await load('official-alert-actions.js', { role: 'secretary', request: async (_, options) => { calls.push(options); return { data: { id: 1 } }; } });
  await module.resolveAlert({ id: 1, assignment_revision: 6 });
  assert.equal(calls.length, 1); assert.equal(calls[0].body.expected_revision, 6);
});
await check('original cancellation cannot refresh a stale revision and silently retry', async () => {
  const calls = [];
  const { module } = await load('official-assignment.js', { role: 'captain', request: async (path, options) => {
    if (path.includes('assignment-options')) return { data: { alert_revision: calls.length ? 8 : 7, current_assignment: { id: 12 } } };
    calls.push(options); throw Object.assign(Error('changed'), { code: 'CONFLICT' });
  } });
  const el = module.cancelAlertAssignment({ id: 1, assignment_revision: 7, assignments: [{ role: 'responder', status: 'active', id: 12 }] }, 'responder'), form = el.querySelector('form');
  form.elements.reason = { value: 'Fixture cancellation' };
  await form.events.submit({ ...event, target: form }); await form.events.submit({ ...event, target: form });
  assert.equal(calls.every(call => call.body.expected_revision === 7), true, 'A stale form sent a refreshed revision');
  assert.equal(calls.length, 1, 'Stale cancellation should require close/review/reopen');
});
await check('original assignment retains its opening revision when availability refreshes', async () => {
  const calls = [];
  const { module } = await load('official-assignment.js', { role: 'secretary', request: async (path, options) => {
    if (path.includes('assignment-options')) return { data: { alert_revision: calls.length ? 8 : 7, personnel: [{ id: 3, full_name: 'Fixture', available: true, workload: 0 }], limit: 2 } };
    calls.push(options); throw Object.assign(Error('lost reply'), { code: 'NETWORK' });
  } });
  const el = module.assignAlert({ id: 1, assignment_revision: 7 }, { mode: 'acknowledge' }), form = el.querySelector('form');
  await settle();
  el.querySelector('[data-people]').events.change({ target: { value: '3' } });
  await form.events.submit(event); await form.events.submit(event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.expected_revision, 7);
});
if (failed) process.exitCode = 1;
