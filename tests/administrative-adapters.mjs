// Frontend boundary checks only. Actual production-adapter acceptance remains
// in the combined MySQL suites; these HTTP fixtures do not certify the backend.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createAdministrativeFactories } from '../assets/js/adapters/administrative-registration.js';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { createHttp } from '../assets/js/adapters/http.js';
import { submitPrivateDocuments } from '../assets/js/adapters/private-document-submission.js';

let actor = { id: 5, barangay_id: 1, role: 'resident' }, refreshes = 0;
const auth = { current: () => actor, refresh: async () => { refreshes++; } };
let fail = true;
const calls = [];
const http = createHttp({ origin: 'http://localhost:8000', fetchImpl: async (url, init) => {
  calls.push({ url, init });
  if (url.endsWith('/auth/csrf')) return new Response(JSON.stringify({ data: { csrf_token: 'original-shared-csrf' } }));
  if (fail) throw new TypeError('Connection interrupted');
  return new Response(JSON.stringify({ data: { id: 42, password_changed: true } }));
} });
const factories = createAdministrativeFactories();
const verification = factories.verification({ http, auth });
const intent = createSubmissionIntent({ auth, keyFactory: () => 'original-document-intent' });
const file = new File(['actual-file-bytes'], 'id.png', { type: 'image/png' });
const body = { document_type: 'Valid ID and proof of residence', valid_id: file, proof_of_residence: file };
await assert.rejects(verification.submit(actor.id, body, { intent }), error => error.code === 'NETWORK');
assert.equal(calls.at(-1).init.headers.get('Idempotency-Key'), 'original-document-intent');
assert.equal(calls.at(-1).init.headers.get('X-CSRF-TOKEN'), 'original-shared-csrf');
assert.ok(calls.at(-1).init.body instanceof FormData);
assert.equal(await calls.at(-1).init.body.get('valid_id').text(), 'actual-file-bytes');
const before = calls.length;
const changed = new File(['other-file-bytes!'], 'id.png', { type: 'image/png' });
await assert.rejects(verification.submit(actor.id, { ...body, valid_id: changed }, { intent }), error => error.code === 'CONFLICT');
assert.equal(calls.length, before);
fail = false;
assert.equal((await verification.submit(actor.id, body, { intent })).id, 42);
assert.equal(calls.at(-1).init.headers.get('Idempotency-Key'), 'original-document-intent');
assert.throws(() => intent.retry(), error => error.code === 'INVALID_STATE');
console.log('PASS private byte FormData, shared CSRF, frozen retry key and changed-byte conflict');

const isolated = createSubmissionIntent({ auth, keyFactory: () => 'second-document-intent' });
const noWrite = calls.length;
await assert.rejects(submitPrivateDocuments({ http, auth, intent: isolated, path: 'me/verifications', fields: {}, files: [['valid_id', file, 1000]],
  cryptoImpl: { subtle: { async digest(...args) { actor = { ...actor, id: 99 }; return webcrypto.subtle.digest(...args); } } } }), error => error.code === 'AUTH');
assert.equal(calls.length, noWrite);
actor = { id: 5, barangay_id: 1, role: 'resident' };
assert.throws(() => verification.submit(99, body, { intent }), error => error.code === 'FORBIDDEN');
console.log('PASS account switching during byte hashing and forged upload owner send no write');

const facilities = factories.facilities({ http, auth });
await facilities.setStatus(7, { status: 'Inactive', expected_revision: 4 });
assert.deepEqual(JSON.parse(calls.at(-1).init.body), { status: 'Inactive', expected_revision: 4 });
assert.match(calls.at(-1).url, /facilities\/7\/status$/);
await factories.account({ http, auth }).changePassword({ current_password: ' old ', password: ' New12345 ', password_confirmation: ' New12345 ' });
assert.equal(refreshes, 1);
assert.equal(JSON.parse(calls.at(-1).init.body).password, ' New12345 ');
const recovery = factories.recovery({ http, auth });
await recovery.verifyCode({ challenge_id: 'opaque-challenge', code: '012345' });
assert.match(calls.at(-1).url, /password-recovery\/verifications$/);
assert.equal(JSON.parse(calls.at(-1).init.body).code, '012345');
console.log('PASS existing facility signature, exact password values and recovery routes use the shared transport');

const createIntent = createSubmissionIntent({ auth, keyFactory: () => 'facility-create-original' });
fail = true;
await assert.rejects(facilities.create({ name: 'Fictional facility' }, { intent: createIntent }), error => error.code === 'NETWORK');
fail = false;
await facilities.create({ name: 'Fictional facility' }, { intent: createIntent });
const creates = calls.filter(c => c.url.endsWith('/facilities') && c.init.method === 'POST');
assert.equal(creates.length, 2);
assert.ok(creates.every(c => c.init.headers.get('Idempotency-Key') === 'facility-create-original'));
console.log('PASS facility creates retry the same original JSON command after an ambiguous network failure');

let rejected = true, sequence = 0;
const validated = createSubmissionIntent({ auth, keyFactory: () => 'validation-document-' + ++sequence });
const validateHttp = { async request() { if (rejected) throw Object.assign(new Error('Validation'), { status: 422 }); return { id: 8 }; } };
await assert.rejects(submitPrivateDocuments({ http: validateHttp, auth, path: 'me/verifications', fields: {}, files: [['valid_id', file, 1000]], intent: validated }));
rejected = false;
assert.equal((await submitPrivateDocuments({ http: validateHttp, auth, path: 'me/verifications', fields: {}, files: [['valid_id', changed, 1000]], intent: validated })).id, 8);
assert.equal(sequence, 2);
console.log('PASS confirmed atomic validation failures allow corrected file bytes through a new intent');
