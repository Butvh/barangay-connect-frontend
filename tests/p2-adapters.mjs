import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOperations } from '../assets/js/adapters/operations.js';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { createReports } from '../assets/js/adapters/reports.js';

const envelope = data => ({ data });
const complete = data => ({ data, meta: { complete: true, total: data.length } });
test('operations unwraps full scopes and uses the sanitized nearby endpoint', async () => {
  const calls = [];
  const api = createOperations({ request: async (...args) => { calls.push(args); return complete([{ id: 2 }]); } });
  assert.deepEqual(await api.alerts.list({ nearby: true, q: 'A-2', status: 'Pending' }), [{ id: 2 }]);
  assert.equal(calls[0][0], '/nearby-alerts?q=A-2&status=Pending');
  assert.equal(calls[0][1].method, 'GET');
});
test('a paginated first page is rejected instead of corrupting dashboard/report counts', async () => {
  const api = createOperations({ request: async () => ({ data: [{ id: 2 }], meta: { complete: false, total: 10 } }) });
  await assert.rejects(api.alerts.list(), { code: 'CONTRACT' });
});
test('SOS retries preserve caller key; no key or protected fields are silently generated', async () => {
  const calls = [];
  const api = createOperations({ request: async (...args) => { calls.push(args); return envelope({ id: 2 }); } });
  await assert.rejects(api.alerts.create({}), { code: 'VALIDATION' });
  for (let i = 0; i < 2; i++) await api.alerts.create({ victim_count: null }, { idempotencyKey: 'same-command-01' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].headers['Idempotency-Key'], calls[1][1].headers['Idempotency-Key']);
  assert.deepEqual(calls[0][1].body, { victim_count: null });
});
test('transfer uses active assignment ID and preserves observed revision', async () => {
  const calls = [];
  const api = createOperations({ request: async (path, options) => { calls.push([path, options]); return envelope(path.includes('assignment-options') ? { alert_revision: 7, current_assignment: { id: 44 } } : { id: 1 }); } });
  await api.alerts.reassign(1, { role: 'responder', personnel_id: 8, responder_id: 8, expected_revision: 7, reason: 'Coverage' });
  assert.equal(calls[1][0], '/assignments/44/transfers');
  assert.deepEqual(calls[1][1].body, { personnel_id: 8, expected_revision: 7, reason: 'Coverage' });
  await assert.rejects(api.alerts.reassign(1, { role: 'responder', personnel_id: 8, expected_revision: 6, reason: 'Old form' }), { code: 'CONFLICT' });
});
test('transport error stays an ApiError and never triggers demo persistence', async () => {
  const api = createOperations({ request: async () => { throw { code: 'FORBIDDEN', message: 'Scope changed', fields: {}, request_id: 'trace-1' }; } });
  await assert.rejects(api.alerts.get(4), e => e.name === 'ApiError' && e.code === 'FORBIDDEN' && e.request_id === 'trace-1');
});
test('communications retains typed feedback, read-state checks and revision guards', async () => {
  const calls = [];
  const api = createCommunications({ request: async (...args) => { calls.push(args); return envelope(1); } });
  await api.feedback.create('general', { rating: 4, comment: 'Useful' }, { idempotencyKey: 'feedback-command' });
  assert.equal(calls[0][1].body.type, 'general');
  await api.notifications.clearRead({ recipient_id: 4, expected_role: 'resident' });
  assert.deepEqual(calls[1][1].body, { recipient_id: 4, expected_role: 'resident' });
  await api.notifications.markUnread(5);
  assert.deepEqual(calls[2][1].body, { is_read: false });
  await assert.rejects(api.feedback.assignTanod(1, 6), { code: 'CONFLICT' });
});
test('reports snapshot retains the complete DTO and rejects malformed envelopes', async () => {
  const payload = { alerts: [{ id: 1, timeline: [], responses: [], rescues: [] }], activity_logs: [] };
  const api = createReports({ request: async () => envelope(payload) });
  assert.deepEqual(await api.snapshot(), payload);
  await assert.rejects(createReports({ request: async () => payload }).snapshot(), { code: 'CONTRACT' });
});
test('invalid identifiers never reach transport', async () => {
  let count = 0;
  const api = createOperations({ request: async () => { count++; return envelope({}); } });
  await assert.rejects(api.alerts.get('../me'), { code: 'VALIDATION' });
  assert.equal(count, 0);
});
