import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import { createOperations } from '../assets/js/adapters/operations.js';
const photoModule = await import('../assets/js/adapters/p2-photo-intent.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
configureOperationalSubmissions({ createSubmissionIntent });
const receipt = { upload_id: '11111111-1111-4111-8111-111111111111', mime: 'image/png', bytes: 42, expires_at: '2026-11-05T00:00:00Z' };

test('actual shared multipart handoff keeps a frozen upload key/file across a lost response', async () => {
  assert.equal(typeof photoModule.createPhotoUpload, 'function');
  const actor = { id: 1, barangay_id: 1, role: 'resident' };
  const form = photoModule.createPhotoUpload({ auth: { current: () => actor } });
  const file = new File(['fictional bytes'], 'fictional.png', { type: 'image/png' });
  const calls = [];
  const api = createOperations({ privatePhotos: true, request: async (path, options) => {
    calls.push({ path, options });
    if (calls.length === 1) throw Object.assign(Error('Lost reply'), { code: 'NETWORK' });
    return { data: receipt };
  } });
  await assert.rejects(form.stage(file, api.alerts.stagePhoto), { code: 'NETWORK' });
  assert.deepEqual(await form.stage(file, api.alerts.stagePhoto), receipt);
  assert.equal(calls[0].path, '/incident-photos');
  assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
  assert.equal(calls[0].options.body.get('photo'), file);
  assert.equal(calls[1].options.body.get('photo'), file);
  assert.deepEqual([...calls[0].options.body.keys()], ['photo']);
  assert.deepEqual(await form.stage(file, api.alerts.stagePhoto), receipt);
  assert.equal(calls.length, 2, 'A retained receipt must not restage for a details retry.');
});

test('pending photo cannot silently change file/account or accept a path-bearing receipt', async () => {
  let actor = { id: 1, barangay_id: 1, role: 'resident' };
  const form = photoModule.createPhotoUpload({ auth: { current: () => actor } });
  const file = new File(['fictional bytes'], 'fixture.png', { type: 'image/png' });
  const write = async () => { throw Error('Lost reply'); };
  await assert.rejects(form.stage(file, write));
  await assert.rejects(form.stage(new File(['changed'], 'fixture.png', { type: 'image/png' }), write), { code: 'CONFLICT' });
  actor = { ...actor, id: 2 };
  await assert.rejects(form.stage(file, write), error => ['AUTH', 'CONFLICT'].includes(error.code));
  const invalid = photoModule.createPhotoUpload({ auth: { current: () => actor } });
  await assert.rejects(invalid.stage(file, async () => ({ ...receipt, object_key: 'private/path' })), { code: 'CONTRACT' });
});

test('account change during actual async file preparation denies before an upload starts', async () => {
  let actor = { id: 1, barangay_id: 1, role: 'resident' }, release;
  const pause = new Promise(resolve => { release = resolve; });
  const file = new class extends File { async arrayBuffer() { await pause; return super.arrayBuffer(); } }(['fictional bytes'], 'fixture.png', { type: 'image/png' });
  const upload = photoModule.createPhotoUpload({ auth: { current: () => actor } });
  let writes = 0;
  const pending = upload.stage(file, async () => { writes++; return receipt; });
  actor = { ...actor, id: 2 }; release();
  await assert.rejects(pending, { code: 'AUTH' });
  assert.equal(writes, 0);
});

test('account change while an upload reply is pending cannot accept another account receipt', async () => {
  let actor = { id: 1, barangay_id: 1, role: 'resident' }, release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const reply = new Promise(resolve => { release = resolve; });
  const file = new File(['fictional bytes'], 'fixture.png', { type: 'image/png' });
  const upload = photoModule.createPhotoUpload({ auth: { current: () => actor } });
  const calls = [];
  const pending = upload.stage(file, async (_, intent) => { calls.push(intent.idempotencyKey); started(); return reply; });
  await ready; actor = { ...actor, id: 2 }; release(receipt);
  await assert.rejects(pending, { code: 'AUTH' });
  actor = { ...actor, id: 1 };
  await upload.stage(file, async (_, intent) => { calls.push(intent.idempotencyKey); return receipt; });
  assert.equal(calls[0], calls[1], 'Original account retry must preserve its pending upload key.');
});
