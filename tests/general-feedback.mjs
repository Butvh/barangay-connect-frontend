import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { feedbackPage, feedbackStats } from '../assets/js/pages/official-feedback-model.js';

for (const action of ['review', 'archive']) test(`General Feedback ${action} adapter retains the intent key and observed revision`, async () => {
  const calls = [], api = createCommunications({ request: async (...args) => { calls.push(args); return { data: { id: 4 } }; } });
  assert.equal(typeof api.feedback[action], 'function', 'Missing contracted lifecycle adapter');
  await assert.rejects(api.feedback[action](4, { expected_revision: 2 }), { code: 'VALIDATION' });
  await assert.rejects(api.feedback[action](4, {}, { idempotencyKey: 'original-key-001' }), { code: 'CONFLICT' });
  for (let i = 0; i < 2; i++) await api.feedback[action](4, { expected_revision: 2 }, { idempotencyKey: 'original-key-001' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0][0], `/feedback/4/${action}`);
  assert.deepEqual(calls[0][1].body, { expected_revision: 2 });
  assert.deepEqual(calls[0][1].headers, { 'Idempotency-Key': 'original-key-001' });
});

const rows = [
  { id: 1, type: 'general', comment: 'Archived full comment', rating: 2, archived_at: '2026-11-08T01:00:00Z', created_at: '2026-10-01T00:00:00Z', submitted_at: '2026-11-07T16:00:00Z' },
  { id: 2, type: 'general', comment: 'Visible full comment', rating: 4, archived_at: null, created_at: '2026-11-08T00:00:00Z', submitted_at: '2026-11-08T00:00:00Z' },
  { id: 3, type: 'complaint', description: 'Original operational concern', status: 'Pending', archived_at: null },
];
test('active General Feedback queue hides archived rows even for a linked reveal', () => {
  assert.equal(feedbackPage(rows, { type: 'general' }).total, 1);
  assert.equal(feedbackPage(rows, { type: 'general' }).selected.id, 2);
  const linked = feedbackPage(rows, { type: 'general', id: 1, reveal: true });
  assert.equal(linked.selected, null);
  assert.equal(linked.selectionMissing, true);
  assert.equal(linked.filtersCleared, false);
  assert.equal(feedbackPage(rows, { type: 'complaint' }).selected.id, 3);
});
test('historical rating/monthly statistics retain archived submissions and use submitted time', () => {
  const before = structuredClone(rows);
  assert.deepEqual(feedbackStats(rows, '2026-11-08T08:00:00Z').general, { average: 3, positive: 50, received: 2 });
  assert.deepEqual(rows, before);
});
