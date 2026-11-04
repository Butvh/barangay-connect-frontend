import assert from 'node:assert/strict';
import { createHttp } from '../assets/js/adapters/http.js';
import { createBackendAuth } from '../assets/js/adapters/session.js';
import { createPolling } from '../assets/js/adapters/polling.js';

let count = 0;
async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const csrf = () => json({ data: { csrf_token: 'csrf-test' }, meta: { server_time: '2026-11-02T00:00:00Z' } });

await test('actual envelope nonce survives hydration and fences an unsafe request across same-role reauthentication', async () => {
  let nonce = 'a'.repeat(64); const calls = [];
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/auth/csrf')) return csrf();
    return json({ data: { id: 1, barangay_id: 1, role: 'resident', is_resident: true, account_status: 'Active' }, meta: { session_observation: nonce } });
  } });
  const auth = createBackendAuth({ http }); await auth.hydrateSession();
  assert.equal(auth.current().session_observation, nonce);
  await http.request('me/verifications', { method: 'POST', body: {} });
  assert.equal(calls.at(-1).init.headers.get('X-BC-Observation'), nonce);
  nonce = 'b'.repeat(64); await auth.refresh();
  assert.equal(auth.current().session_observation, nonce);
  await http.request('me/verifications', { method: 'POST', body: {} });
  assert.equal(calls.at(-1).init.headers.get('X-BC-Observation'), nonce);
});

await test('self-consent purpose segments and real multipart uploads keep the shared session boundary', async () => {
  const calls = [];
  const http = createHttp({ origin: 'http://localhost:8000', fetchImpl: async (url, init) => {
    calls.push({ url, init }); return url.endsWith('/auth/csrf') ? csrf() : json({ data: { ok: true } });
  } });
  await http.request('me/notification-preferences/incident_review');
  const body = new FormData(); body.append('photo', new Blob(['actual fixture bytes'], { type: 'image/png' }), 'fixture.png');
  await http.request('incident-photos', { method: 'POST', body, headers: { 'Idempotency-Key': 'original-photo-intent' } });
  const sent = calls.at(-1).init;
  assert.equal(sent.body, body); assert.equal(sent.headers.has('Content-Type'), false);
  assert.equal(sent.headers.get('X-CSRF-TOKEN'), 'csrf-test'); assert.equal(sent.credentials, 'same-origin');
});
await test('photo processing and oversize errors retain safe actionable codes', async () => {
  for (const [status, code, expected] of [[503, 'PHOTO_PROCESSING', 'PHOTO_PROCESSING'], [409, 'PHOTO_CONFLICT', 'PHOTO_CONFLICT'], [422, 'PHOTO_INVALID', 'PHOTO_INVALID'], [413, 'UNTRUSTED', 'VALIDATION']]) {
    const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => json({ code, message: 'private exception' }, status) });
    await assert.rejects(http.request('me'), error => error.code === expected && !error.message.includes('private'));
  }
});

await test('same-origin JSON request unwraps data and carries session + CSRF', async () => {
  const calls = [];
  const http = createHttp({ origin: 'http://localhost:8000', fetchImpl: async (url, init) => {
    calls.push({ url, init }); return calls.length === 1 ? csrf() : json({ data: { id: 4 } });
  } });
  assert.deepEqual(await http.request('auth/login', { method: 'POST', body: { password: ' Password123 ' } }), { id: 4 });
  assert.equal(calls[1].init.credentials, 'same-origin');
  assert.equal(calls[1].init.headers.get('X-CSRF-TOKEN'), 'csrf-test');
  assert.equal(JSON.parse(calls[1].init.body).password, ' Password123 ');
});
await test('transport rejects external URLs and traversal before fetch', async () => {
  let calls = 0;
  const http = createHttp({ origin: 'http://localhost:8000', fetchImpl: async () => { calls++; return csrf(); } });
  for (const path of ['https://evil.test', '//evil.test', '../secret', '/me', 'files/%2e%2e/.env', 'a//b']) {
    await assert.rejects(http.request(path), error => error.code === 'VALIDATION');
  }
  assert.equal(calls, 0);
});
await test('network failure never returns demo data or exposes raw error', async () => {
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => { throw new Error('credential secret'); } });
  await assert.rejects(http.request('me'), error => error.code === 'NETWORK' && !error.message.includes('secret'));
});
await test('status mapping is stable and does not trust server exception copy', async () => {
  for (const [status, code] of [[401, 'AUTH'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'], [419, 'CSRF'], [422, 'VALIDATION'], [429, 'RATE_LIMIT'], [503, 'NOT_AVAILABLE']]) {
    const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => json({ code: 'UNTRUSTED', message: 'secret db error', fields: { email: 'evil content' }, request_id: 'id-1' }, status) });
    await assert.rejects(http.request('me'), error => error.code === code && !error.message.includes('secret') && error.request_id === 'id-1');
  }
});
await test('unsafe writes are not retried after CSRF failure', async () => {
  let writes = 0;
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async (url) => {
    if (url.endsWith('/auth/csrf')) return csrf();
    writes++; return json({ code: 'CSRF' }, 419);
  } });
  await assert.rejects(http.request('auth/login', { method: 'POST', body: {} }));
  assert.equal(writes, 1);
});
await test('malformed successful response fails closed', async () => {
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => json({ user: { id: 1 } }) });
  await assert.rejects(http.request('me'), error => error.code === 'SERVER');
});
await test('session hydration blocks guards and ignores all demo identifiers', async () => {
  let finish;
  const http = { request: () => new Promise(resolve => { finish = resolve; }), onUnauthorized: () => () => {} };
  const auth = createBackendAuth({ http });
  assert.equal(auth.current(), null);
  assert.throws(() => auth.requireRole(['captain']), error => error.code === 'NOT_READY');
  const ready = auth.hydrateSession();
  finish({ id: 7, full_name: 'Test', barangay_id: 1, is_secretary: true, role: 'secretary' });
  await ready;
  assert.equal(auth.requireRole(['secretary']).id, 7);
  const snapshot = auth.current(); snapshot.is_captain = true;
  assert.equal(auth.current().is_captain, undefined);
});
await test('failed logout retains identity and never signals successful invalidation', async () => {
  const http = { request: async path => { if (path === 'me') return { id: 7, is_secretary: true }; throw Object.assign(new Error('offline'), { code: 'NETWORK' }); }, onUnauthorized: () => () => {} };
  const auth = createBackendAuth({ http }); await auth.hydrateSession();
  await assert.rejects(auth.logout()); assert.equal(auth.current().id, 7);
});
await test('401 hydration is anonymous; outage is explicitly unavailable', async () => {
  for (const code of ['AUTH', 'NETWORK']) {
    const auth = createBackendAuth({ http: { request: async () => { throw Object.assign(new Error(), { code }); }, onUnauthorized: () => () => {} } });
    await auth.hydrateSession(); assert.equal(auth.current(), null);
    assert.equal(auth.error()?.code ?? null, code === 'AUTH' ? null : 'NETWORK');
  }
});
await test('polling unsubscribes, skips unchanged revisions, and disposes timers', async () => {
  let tick, cleared = 0, events = 0, revision = 1;
  const polling = createPolling({
    auth: { current: () => ({ id: 7 }), refresh: async () => {}, onChange: () => () => {} },
    sources: { alerts: async () => revision },
    setIntervalImpl: fn => { tick = fn; return 1; }, clearIntervalImpl: () => { cleared++; }, eventTarget: null,
  });
  const off = polling.subscribe('alerts', () => { events++; });
  await tick(); await tick(); assert.equal(events, 0);
  revision = 2; await tick(); assert.equal(events, 1);
  off(); revision = 3; await tick(); assert.equal(events, 1);
  polling.destroy(); assert.equal(cleared, 1);
});
await test('a broken unauthorized listener cannot block session revocation', async () => {
  let notified = false;
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => json({ code: 'AUTH' }, 401) });
  http.onUnauthorized(() => { throw new Error('broken view'); });
  http.onUnauthorized(() => { notified = true; });
  await assert.rejects(http.request('me'), error => error.code === 'AUTH');
  assert.equal(notified, true);
});
await test('polling stops domain reads when the heartbeat revokes identity', async () => {
  let current = { id: 7 }, tick, calls = 0;
  const polling = createPolling({
    auth: { current: () => current, refresh: async () => { current = null; }, onChange: () => () => {} },
    sources: { alerts: async () => { calls++; return 1; } },
    setIntervalImpl: fn => { tick = fn; return 1; }, clearIntervalImpl() {}, eventTarget: null,
  });
  polling.subscribe('alerts', () => {}); await tick(); assert.equal(calls, 0); polling.destroy();
});
await test('polling survives back-forward caching and destroys on actual departure', async () => {
  const events = new Map(); let cleared = 0;
  const polling = createPolling({ auth: { current: () => null, refresh: async () => {}, onChange: () => () => {} },
    setIntervalImpl: () => 1, clearIntervalImpl: () => { cleared++; },
    eventTarget: { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) },
  });
  events.get('pagehide')({ persisted: true }); assert.equal(cleared, 0);
  events.get('pagehide')({ persisted: false }); assert.equal(cleared, 1);
  assert.equal(events.size, 0); polling.destroy(); assert.equal(cleared, 1);
});
await test('a missing polling reader is explicitly unavailable', async () => {
  const polling = createPolling({ auth: { current: () => null, refresh: async () => {}, onChange: () => () => {} },
    setIntervalImpl: () => 1, clearIntervalImpl() {}, eventTarget: null });
  try { assert.throws(() => polling.subscribe('alerts', () => {}), error => error.code === 'NOT_AVAILABLE'); }
  finally { polling.destroy(); }
});
await test('confirmed sign out signals one caller-owned navigation after clearing identity', async () => {
  let observed, cleared = false;
  const auth = createBackendAuth({ http: { request: async path => path === 'me' ? { id: 7, barangay_id: 1, role: 'secretary', is_secretary: true } : { signed_out: true },
    onUnauthorized: () => () => {}, setIdentity: value => { if (value === null) cleared = true; } } });
  await auth.hydrateSession();
  auth.onChange(event => { observed = { reason: event.reason, user: auth.current(), cleared }; });
  await auth.logout(); assert.deepEqual(observed, { reason: 'signed_out', user: null, cleared: true });
});
await test('explicit sign in identifies caller-owned navigation separately from session refresh', async () => {
  let observed;
  const auth = createBackendAuth({ http: { request: async () => ({ id: 7, barangay_id: 1, role: 'resident', is_resident: true }), onUnauthorized: () => () => {} } });
  auth.onChange(event => { observed = event.reason; });
  await auth.login('fictional@example.invalid', 'Fictional123');
  assert.equal(observed, 'signed_in');
});
console.log(`${count} backend transport checks passed.`);
