import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createBackendApi } from '../assets/js/adapters/api.js';
import { createHttp } from '../assets/js/adapters/http.js';
import { operationalComposition } from '../assets/js/adapters/operational-registration.js';
import { createSourceFactories, sourceReaders } from '../assets/js/adapters/source-references.js';
import { createAdministrativeFactories } from '../assets/js/adapters/administrative-registration.js';

assert.deepEqual(Object.keys((await operationalComposition()).factories), []);
const calls = [], signal = new AbortController().signal;
const http = { request: async (path, options) => { calls.push({ path, options }); return path.includes('revisions') ? { revision: 'a'.repeat(64) } : []; } };
http.envelope = async (path, options) => ({ data: await http.request(path, options) });
const own = createSourceFactories();
await own.users({ http }).get(7); await own.facilities({ http }).get(8); await own.barangays({ http }).list();
assert.deepEqual(calls.map(call => call.path), ['references/users/7', 'references/facilities/8', 'references/barangays']);
assert.equal(await sourceReaders.users({ http })({ signal }), 'a'.repeat(64)); assert.equal(calls.at(-1).options.signal, signal);
assert.throws(() => own.users({ http }).get('../secret'));
console.log('PASS disabled operational registration, minimal source paths and cancellation-aware revisions (unit)');

const verification = { id: 9, review_status: 'Resubmission requested', resubmission_reason: 'Clearer proof required', history: [{ action: 'Submitted' }] };
const reads = [];
const profileHttp = { request: async path => {
  reads.push(path);
  return path === 'profile' ? { id: 7, verification: { id: 9, review_status: verification.review_status } } : verification;
} };
const residentUsers = createAdministrativeFactories().users({ http: profileHttp, auth: { current: () => ({ id: 7, role: 'resident' }) } });
assert.deepEqual((await residentUsers.get(7)).verification, verification);
await assert.rejects(residentUsers.get(8), error => error.code === 'FORBIDDEN');
assert.deepEqual(reads, ['profile', 'verifications/9']);
console.log('PASS original resident reads the scoped verification detail with correction reason and history');
try { await access(new URL('../assets/js/adapters/p2-form-intent.js', import.meta.url)); }
catch { console.log('SKIP actual operational registration: requires reviewed composed owner sources.'); process.exit(0); }
const selected = await operationalComposition(true);

for (const group of ['alerts', 'dashboard', 'map', 'announcements', 'feedback', 'notifications', 'users', 'facilities', 'barangays', 'reports']) {
  assert.equal(typeof selected.factories[group], 'function');
}
for (const group of ['personnel', 'verification']) assert.equal(selected.factories[group], undefined);

const noPolling = () => ({});
const auth = { current: () => ({ id: 7, barangay_id: 2, role: 'resident' }) };
const partial = createBackendApi({ auth, factories: {}, sources: {}, pollingFactory: noPolling });
for (const call of [() => partial.announcements.expireOverdue(), () => partial.feedback.assignmentOptions(3)]) {
  await assert.rejects(call, error => error.code === 'NOT_AVAILABLE');
}

const requests = [];
const announcement = { id: 3, title: 'Fictional announcement' };
const feedback = { id: 4, revision: 2 };
const options = { feedback_revision: 2, tanods: [{ id: 9, full_name: 'Fictional Tanod' }] };
const transport = createHttp({
  origin: 'http://localhost',
  fetchImpl: async (url, init) => {
    const parsed = new URL(url), path = parsed.pathname.slice('/api/v1/'.length);
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    requests.push({ path, query: Object.fromEntries(parsed.searchParams), method: init.method, body, headers: init.headers });
    if (path === 'auth/csrf') return Response.json({ data: { csrf_token: 'fixture-csrf' } });
    if (path === 'announcements/401') return Response.json({ code: 'AUTH' }, { status: 401 });
    if (path === 'feedback/404/assignment-options') return Response.json({ code: 'NOT_FOUND' }, { status: 404 });
    if (path === 'feedback/403/resolution') return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    if (init.method === 'GET' && ['announcements', 'feedback'].includes(path)) {
      return Response.json({ data: [path === 'announcements' ? announcement : feedback], meta: { complete: true, total: 1 } });
    }
    const data = path === 'feedback/4/assignment-options' ? options : path.startsWith('feedback') ? feedback : announcement;
    return Response.json({ data });
  },
});
transport.setIdentity({ id: 7, barangay_id: 2, role: 'captain', observation: 'a'.repeat(64) });
const { announcements, feedback: civicFeedback } = createBackendApi({
  http: transport, auth, factories: selected.factories, sources: {}, pollingFactory: noPolling,
});
assert.deepEqual(await announcements.list(), [announcement]);
assert.deepEqual(await announcements.get(3), announcement);
assert.deepEqual(await civicFeedback.list({ resident_id: 7 }), [feedback]);
assert.deepEqual(await civicFeedback.get(4), feedback);
assert.deepEqual(await civicFeedback.assignmentOptions(4), options);
const intent = { idempotencyKey: 'civic-test-intent' };
const notice = { title: 'Fictional announcement', content: 'Test', expires_at: null };
const comment = { rating: 4, comment: 'Fictional feedback' };
const observed = { expected_revision: 2 };
await announcements.expireOverdue();
await announcements.create(notice, intent);
await announcements.update(3, { ...notice, ...observed });
await announcements.archive(3, observed);
await announcements.retract(3, { reason: 'Fixture', ...observed });
await civicFeedback.create('general', comment, intent);
await civicFeedback.assignTanod(4, 9, observed);
await civicFeedback.resolve(4, observed);
assert.deepEqual(requests.find(request => request.path === 'feedback').query, { resident_id: '7' });
assert.deepEqual(requests.filter(request => request.method !== 'GET').map(({ path, method, body }) => [path, method, body]), [
  ['announcements/expire-overdue', 'POST', {}],
  ['announcements', 'POST', notice],
  ['announcements/3', 'PATCH', { ...notice, ...observed }],
  ['announcements/3/archive', 'POST', observed],
  ['announcements/3/retract', 'POST', { reason: 'Fixture', ...observed }],
  ['feedback', 'POST', { ...comment, type: 'general' }],
  ['feedback/4/assignment', 'POST', { tanod_id: 9, ...observed }],
  ['feedback/4/resolution', 'POST', observed],
]);
const writes = requests.filter(request => request.method !== 'GET');
for (const request of writes) {
  assert.equal(request.headers.get('X-CSRF-TOKEN'), 'fixture-csrf');
  assert.equal(request.headers.get('X-BC-Observation'), 'a'.repeat(64));
}
assert.deepEqual(writes.filter(request => request.headers.has('Idempotency-Key')).map(request => request.headers.get('Idempotency-Key')), [
  intent.idempotencyKey, intent.idempotencyKey,
]);
assert.equal(civicFeedback.review, undefined);
assert.equal(civicFeedback.archive, undefined);
for (const [call, code, status] of [
  [() => civicFeedback.assignmentOptions(404), 'NOT_FOUND', 404],
  [() => civicFeedback.resolve(403, observed), 'FORBIDDEN', 403],
  [() => announcements.get(401), 'AUTH', 401],
]) {
  await assert.rejects(call, error => error.code === code && error.status === status);
}
console.log('PASS civic registrations use shared authenticated transport, exact intent/revision and fail-closed responses (unit)');
for (const entity of ['alerts', 'notifications', 'announcements', 'feedback', 'verification', 'users', 'facilities']) assert.equal(typeof selected.sources[entity]({ http }), 'function');
const { createFormSubmission } = await import('../assets/js/adapters/p2-form-intent.js');
const form = createFormSubmission({ auth: { current: () => ({ id: 7, barangay_id: 2, role: 'resident' }) }, demo: false, revision: 3 });
const intents = [];
await assert.rejects(form.submit({ description: 'same' }, async (body, intent) => { intents.push({ body, intent }); throw Error('lost reply'); }));
await form.submit({ description: 'same' }, async (body, intent) => { intents.push({ body, intent }); return {}; });
assert.deepEqual(intents[0], intents[1]); assert.equal(intents[0].body.expected_revision, 3);
console.log('PASS actual P2 helper registered before operational forms; one P1 intent and unchanged revision (unit)');
