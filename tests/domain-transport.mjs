import assert from 'node:assert/strict';
import { createHttp } from '../assets/js/adapters/http.js';
import { createDomainTransport } from '../assets/js/adapters/domain-transport.js';
import { createP2DomainFactories } from '../assets/js/adapters/p2-registration.js';
import { access } from 'node:fs/promises';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const calls = [];
const http = createHttp({ origin: 'http://localhost:8000', fetchImpl: async (url, init) => {
  calls.push({ url, init });
  if (url.endsWith('/auth/csrf')) return json({ data: { csrf_token: 'test-csrf' } });
  return json({ data: [{ id: 1042 }], meta: { complete: true, total: 1 } });
} });
const request = createDomainTransport(http);
assert.equal(typeof http.setIdentity, 'function');
http.setIdentity({ id: 42, barangay_id: 7, role: 'secretary' });
const envelope = await request('/alerts?q=Riverside+Street&status=Pending');
assert.deepEqual(envelope.meta, { complete: true, total: 1 });
assert.equal(calls[0].url, 'http://localhost:8000/api/v1/alerts?q=Riverside+Street&status=Pending');
await request('/alerts', { method: 'POST', body: { description: 'Test' }, headers: { 'Idempotency-Key': 'same-submit-intent' } });
assert.equal(calls.at(-1).init.headers.get('Idempotency-Key'), 'same-submit-intent');
assert.equal(calls.at(-1).init.headers.get('X-CSRF-TOKEN'), 'test-csrf');
assert.equal(calls.at(-1).init.headers.get('X-BC-Identity'), '42:7:secretary');
for (const path of ['//evil.test/me', 'https://evil.test/me', '/alerts/../me', '/alerts/%2e%2e/me', '/alerts#fragment', '/api/v1/alerts']) {
  await assert.rejects(request(path), error => error.code === 'VALIDATION');
}
await assert.rejects(request('/alerts', { method: 'POST', headers: { Authorization: 'Bearer external' }, body: {} }), error => error.code === 'VALIDATION');
console.log('PASS domain transport retains envelopes, queries, stable keys and CSRF without allowing foreign authority');

const source = new URL('../assets/js/adapters/operations.js', import.meta.url);
let available = true;
try { await access(source); } catch { available = false; }
if (!available) {
  console.log('SKIP P2 factory transport checks: run against the pinned combined snapshot, not a fabricated adapter.');
} else {
  const exports = { ...await import(source), ...await import('../assets/js/adapters/communications.js'), ...await import('../assets/js/adapters/reports.js') };
  const traffic = [];
  let complete = true;
  const shared = createHttp({ origin: 'http://localhost:8000', fetchImpl: async (url, init) => {
    traffic.push({ url, init });
    if (url.endsWith('/auth/csrf')) return json({ data: { csrf_token: 'real-transport-token' } });
    if (url.includes('assignment-options')) return json({ data: { alert_revision: 2, current_assignment: { id: 9 } } });
    return init.method === 'GET' ? json({ data: [{ id: 1042 }], meta: { complete, total: 1 } }) : json({ data: { id: 1042 } });
  } });
  const factories = createP2DomainFactories(exports);
  const alerts = factories.alerts({ http: shared, auth: {} });
  assert.deepEqual(await alerts.list({ q: 'Riverside & Mabini', status: 'Pending' }), [{ id: 1042 }]);
  assert.match(traffic.at(-1).url, /q=Riverside\+%26\+Mabini/);
  complete = false;
  await assert.rejects(alerts.list(), error => error.code === 'CONTRACT'); complete = true;
  await assert.rejects(alerts.create({}), error => error.code === 'VALIDATION');
  for (let attempt = 0; attempt < 2; attempt++) await alerts.create({ description: 'same intent' }, { idempotencyKey: 'stable-intent-1042' });
  const posts = traffic.filter(call => call.init.method === 'POST');
  assert.equal(posts.length, 2);
  assert.ok(posts.every(call => call.init.headers.get('Idempotency-Key') === 'stable-intent-1042' && call.init.headers.get('X-CSRF-TOKEN') === 'real-transport-token'));
  const before = traffic.length;
  await assert.rejects(alerts.reassign(1042, { role: 'responder', expected_revision: 1, personnel_id: 8, reason: 'Transfer' }), error => error.code === 'CONFLICT');
  assert.equal(traffic.length, before + 1); // Read only: stale form never becomes a POST with a refreshed revision.
  const notices = factories.notifications({ http: shared, auth: {} });
  await notices.clearRead({ recipient_id: 42, expected_role: 'secretary' });
  assert.deepEqual(JSON.parse(traffic.at(-1).init.body), { recipient_id: 42, expected_role: 'secretary' });
  assert.equal(typeof factories.map({ http: shared, auth: {} }).get, 'function');
  assert.equal(typeof factories.reports({ http: shared, auth: {} }).performance, 'function');
  console.log('PASS 8 actual P2 factory checks through shared HTTP: complete lists, query encoding, CSRF, stable intents, stale revisions and observed identity');
}
