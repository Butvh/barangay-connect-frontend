// Shared composition unit evidence only; production acceptance uses real SQL/browser services.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackendApi } from '../assets/js/adapters/api.js';
import { createP2DomainFactories } from '../assets/js/adapters/p2-registration.js';
import { stageBackendFrontend } from '../scripts/stage-backend-frontend.mjs';

const auth = role => ({ current: () => ({ id: 10, barangay_id: 77, role }) });
function composition({ role = 'captain', available = true, enabled = false } = {}) {
  const calls = [];
  const factories = createP2DomainFactories({
    createOperations: () => ({}), createReports: () => ({}), generalFeedbackTest: enabled,
    createCommunications: () => ({ feedback: { list: filters => { calls.push(filters); return Promise.resolve([]); }, ...(available ? { review() {}, archive() {} } : {}) } }),
  });
  return { calls, api: createBackendApi({ http: { envelope() { throw new Error('No HTTP is expected in the composition unit fixture.'); } }, auth: auth(role), factories: { feedback: factories.feedback }, sources: {}, pollingFactory: () => ({}) }) };
}
test('boolean lifecycle capability stays false until explicitly selected in the reviewed composition', () => {
  assert.equal(composition().api.feedback.generalLifecycleAvailable, false);
  assert.equal(composition({ enabled: true }).api.feedback.generalLifecycleAvailable, true);
  assert.throws(() => composition({ enabled: true, available: false }), /Reviewed General Feedback/);
});
test('complete official feedback population includes archived without changing resident defaults or explicit filters', async () => {
  for (const role of ['captain', 'secretary', 'resident']) {
    const { api, calls } = composition({ role });
    await api.feedback.list({ type: 'general' });
    assert.deepEqual(calls[0], { ...(role === 'resident' ? {} : { archive: 'all' }), type: 'general' });
    await api.feedback.list({ archive: 'active' });
    assert.deepEqual(calls[1], { archive: 'active' });
  }
});
test('pre-handoff adapters never receive a new unsupported archive query or a false-positive capability', async () => {
  const { api, calls } = composition({ available: false });
  await api.feedback.list({ type: 'complaint' });
  assert.deepEqual(calls[0], { type: 'complaint' });
  assert.equal(api.feedback.generalLifecycleAvailable, false);
  await assert.rejects(api.feedback.review(10, { expected_revision: 0 }), error => error.code === 'NOT_AVAILABLE');
});
test('lifecycle staging refuses an unadmitted or non-operational composition before writing an artifact', async () => {
  await assert.rejects(stageBackendFrontend({ generalFeedbackTest: true }), /requires the isolated/);
  await assert.rejects(stageBackendFrontend({ operationalTest: true, generalFeedbackTest: true }), /requires the isolated/);
});
