import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
const bridge = await import('../assets/js/adapters/p2-form-intent.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
let actor = { id: 1, barangay_id: 1, role: 'secretary', session_observation: 'opening-session' };
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
test('account switch invalidates the old form even after discard; only a reopened form can submit', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false });
  const keys = [];
  const lost = async (_, intent) => { keys.push(intent.idempotencyKey); throw Error('lost'); };
  await assert.rejects(form.submit({}, lost));
  actor = { ...actor, id: 9 };
  await assert.rejects(form.submit({}, lost), { code: 'AUTH' });
  form.discard();
  await assert.rejects(form.submit({}, lost), { code: 'AUTH' });
  assert.equal(keys.length, 1);
  const reopened = bridge.createFormSubmission({ auth, demo: false });
  await assert.rejects(reopened.submit({}, lost), /lost/);
  assert.notEqual(keys[0], keys[1]);
});

test('same-account reauthentication before first submit cannot be adopted by an old form', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false });
  actor = { ...actor, session_observation: 'reauthenticated-before-click' };
  let writes = 0;
  await assert.rejects(form.submit({}, async () => writes++), { code: 'AUTH' });
  assert.equal(writes, 0);
});

test('a late details reply cannot complete under a new observation or silently rebind on retry', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false, revision: 3 });
  let release, writes = 0;
  const reply = new Promise(resolve => { release = resolve; });
  const pending = form.submit({ description: 'original' }, async () => { writes++; return reply; });
  actor = { ...actor, session_observation: 'reauthenticated-during-write' };
  release({ id: 1 });
  await assert.rejects(pending, { code: 'AUTH' });
  form.discard();
  await assert.rejects(form.submit({ description: 'original' }, async () => writes++), { code: 'AUTH' });
  assert.equal(writes, 1, 'The first write may have committed; rejecting its late reply must not issue another write.');
});
test('demo handoff preserves demo payloads without inventing server keys', async () => {
  const form = bridge.createFormSubmission({ auth, demo: true, revision: 9 });
  const input = { photo_name: 'fictional.jpg' };
  assert.equal(await form.submit(input, async (body, intent) => { assert.deepEqual(body, input); assert.equal(intent, undefined); return 4; }), 4);
});

test('normal completion does not rebind an old form after same-account reauthentication', async () => {
  const form = bridge.createFormSubmission({ auth, demo: false });
  await form.submit({}, async () => ({ id: 1 }));
  actor = { ...actor, session_observation: 'new-login-after-completion' };
  let writes = 0;
  await assert.rejects(form.submit({}, async () => writes++), { code: 'AUTH' });
  await bridge.createFormSubmission({ auth, demo: false }).submit({}, async () => writes++);
  assert.equal(writes, 1, 'Only a deliberately reopened form uses the new session.');
});
