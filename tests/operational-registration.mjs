import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
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
for (const group of ['alerts', 'dashboard', 'map', 'notifications', 'users', 'facilities', 'barangays', 'reports']) assert.equal(typeof selected.factories[group], 'function');
for (const group of ['feedback', 'personnel', 'verification']) assert.equal(selected.factories[group], undefined);
const announcement = { id: 3, title: 'Fictional announcement' };
const announcementReads = [];
const announcements = selected.factories.announcements({ http: { envelope: async (path, options) => {
  announcementReads.push([path, options.method]);
  return path === 'announcements' ? { data: [announcement], meta: { complete: true, total: 1 } } : { data: announcement };
} } });
assert.deepEqual(Object.keys(announcements).sort(), ['get', 'list']);
assert.deepEqual(await announcements.list(), [announcement]);
assert.deepEqual(await announcements.get(3), announcement);
assert.deepEqual(announcementReads, [['announcements', 'GET'], ['announcements/3', 'GET']]);
for (const entity of ['alerts', 'notifications', 'announcements', 'feedback', 'verification', 'users', 'facilities']) assert.equal(typeof selected.sources[entity]({ http }), 'function');
const { createFormSubmission } = await import('../assets/js/adapters/p2-form-intent.js');
const form = createFormSubmission({ auth: { current: () => ({ id: 7, barangay_id: 2, role: 'resident' }) }, demo: false, revision: 3 });
const intents = [];
await assert.rejects(form.submit({ description: 'same' }, async (body, intent) => { intents.push({ body, intent }); throw Error('lost reply'); }));
await form.submit({ description: 'same' }, async (body, intent) => { intents.push({ body, intent }); return {}; });
assert.deepEqual(intents[0], intents[1]); assert.equal(intents[0].body.expected_revision, 3);
console.log('PASS actual P2 helper registered before operational forms; one P1 intent and unchanged revision (unit)');
