import assert from 'node:assert/strict';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';

let actor = { id: 1, barangay_id: 1, role: 'captain' }, generated = 0;
const intent = createSubmissionIntent({ auth: { current: () => actor }, keyFactory: () => `intent-key-${++generated}` });
const input = { personnel_id: 7, reason: 'Fictional test' };
const original = intent.prepare(input, 4);
input.reason = 'Changed after submission';
assert.deepEqual(intent.retry(), original);
assert.equal(generated, 1);
assert.equal(intent.retry().body.expected_revision, 4);
assert.throws(() => intent.prepare(input, 5), error => error.code === 'CONFLICT');
assert.equal(generated, 1);
actor = { id: 2, barangay_id: 1, role: 'secretary' };
assert.throws(() => intent.retry(), error => error.code === 'AUTH');
intent.discard();
const second = intent.prepare({ personnel_id: 8 }, 0);
assert.notEqual(second.idempotencyKey, original.idempotencyKey);
assert.equal(second.body.expected_revision, 0);
intent.complete(); assert.throws(() => intent.retry(), error => error.code === 'INVALID_STATE');
console.log('PASS submit intent retains one key, immutable body and observed revision on retry; changed accounts and stale replacements fail closed');

let guest = null;
const registration = createSubmissionIntent({ auth: { current: () => guest }, allowAnonymous: true, keyFactory: () => 'guest-registration-key' });
assert.equal(registration.prepare({ email: 'fictional@example.invalid' }).idempotencyKey, 'guest-registration-key');
guest = { id: 9, barangay_id: 1, role: 'resident' };
assert.throws(() => registration.retry(), error => error.code === 'AUTH');
assert.throws(() => createSubmissionIntent({ auth: { current: () => null } }).prepare({}), error => error.code === 'AUTH');
console.log('PASS explicit guest registration retains its own observation without enabling anonymous operational intents');
