import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
const bridge = await import('../assets/js/adapters/p2-form-intent.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
let actor = { id: 1, barangay_id: 1, role: 'secretary' };
const auth = { current: () => actor, roleOf: value => value.role };

test('unregistered backend forms fail closed before an HTTP mutation', async () => {
  assert.equal(typeof bridge.createFormSubmission, 'function', 'P2 form handoff is missing');
  const form = bridge.createFormSubmission({ auth, demo: false });
  let writes = 0;
  await assert.rejects(form.submit({}, () => writes++), { code: 'NOT_AVAILABLE' });
  assert.equal(writes, 0);
  bridge.configureOperationalSubmissions({ createSubmissionIntent });
});
test('lost response retry retains the P1 key, exact body and original revision', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false, revision: 7 });
  const calls = [];
  const write = async (...args) => { calls.push(args); if (calls.length === 1) throw Error('response lost'); return { id: 2 }; };
  await assert.rejects(form.submit({ personnel_id: 3 }, write), /response lost/);
  await form.submit({ personnel_id: 3 }, write);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1][0].expected_revision, 7);
  assert.match(calls[1][1].idempotencyKey, /^[A-Za-z0-9_-]{8,128}$/);
});
test('editing a failed intent or replacing its revision never starts a silent new attempt', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false, revision: 2 });
  let writes = 0;
  await assert.rejects(form.submit({ notes: 'original' }, async () => { writes++; throw Error('lost'); }));
  await assert.rejects(form.submit({ notes: 'changed' }, async () => writes++), { code: 'CONFLICT' });
  await assert.rejects(form.submit({ notes: 'original', expected_revision: 3 }, async () => writes++), { code: 'CONFLICT' });
  assert.equal(writes, 1);
});
test('account switch refuses the old form and deliberate discard creates a new key', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false });
  const keys = [];
  const lost = async (_, intent) => { keys.push(intent.idempotencyKey); throw Error('lost'); };
  await assert.rejects(form.submit({}, lost));
  actor = { ...actor, id: 9 };
  await assert.rejects(form.submit({}, lost), { code: 'CONFLICT' });
  form.discard();
  await assert.rejects(form.submit({}, lost));
  assert.notEqual(keys[0], keys[1]);
});
test('demo handoff preserves demo payloads without inventing server keys', async () => {
  const form = bridge.createFormSubmission({ auth, demo: true, revision: 9 });
  const input = { photo_name: 'fictional.jpg' };
  assert.equal(await form.submit(input, async (body, intent) => { assert.deepEqual(body, input); assert.equal(intent, undefined); return 4; }), 4);
});
