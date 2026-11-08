import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttp } from '../assets/js/adapters/http.js';
import { createDomainTransport } from '../assets/js/adapters/domain-transport.js';
import { createOperations } from '../assets/js/adapters/operations.js';

// Combined-snapshot test only. Starts an owned loopback server with every live integration disabled.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const child = spawn(process.env.PHP_BINARY || 'php', ['artisan', 'serve', '--host=127.0.0.1', `--port=${port}`, '--no-reload'], {
  cwd: resolve(root, 'backend'), detached: process.platform !== 'win32', windowsHide: true,
  env: { ...process.env, IDENTITY_ENABLED: 'false', P2_MODULES_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false', SMS_ENABLED: 'false', MAKE_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', bytes => { serverLog += bytes; }); child.stderr.on('data', bytes => { serverLog += bytes; });
const origin = `http://127.0.0.1:${port}`, jar = new Map();
async function browserFetch(url, init = {}) {
  assert.equal(new URL(url).origin, origin);
  const headers = new Headers(init.headers);
  if (jar.size) headers.set('Cookie', [...jar].map(([key, value]) => `${key}=${value}`).join('; '));
  const response = await fetch(url, { ...init, headers });
  for (const cookie of response.headers.getSetCookie()) {
    const part = cookie.split(';')[0], index = part.indexOf('='); jar.set(part.slice(0, index), part.slice(index + 1));
  }
  return response;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch { /* wait for owned server */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, 'The private loopback Laravel server did not start.');
  const http = createHttp({ origin, fetchImpl: browserFetch }), tab2 = createHttp({ origin, fetchImpl: browserFetch });
  const csrf = await http.request('auth/csrf');
  assert.equal((await tab2.request('auth/csrf')).csrf_token, csrf.csrf_token);
  const raw = await browserFetch(origin + '/api/v1/auth/login', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(raw.status, 419);
  console.log('PASS live Laravel sessions share same-origin cookies across clients; missing CSRF gets 419');
  const operations = createOperations({ request: createDomainTransport(http) });
  await assert.rejects(operations.alerts.list(), error => error.code === 'AUTH' && error.status === 401);
  await assert.rejects(operations.alerts.create({ description: 'Fictional boundary test' }, { idempotencyKey: 'persistent-intent-123' }), error => error.code === 'AUTH' && error.status === 401);
  await assert.rejects(http.request('auth/login', { method: 'POST', body: { email: 'fictional@example.invalid', password: 'LocalBoundary123', portal: 'official' } }), error => error.code === 'NOT_AVAILABLE' && error.status === 503);
  console.log('PASS actual P2 factories use real shared HTTP against Laravel; incomplete identity/modules stay closed');
  for (const path of ['/.env', '/backend/.env', '/vendor/autoload.php', '/storage/private.pdf', '/frontend/assets/js/data/seed.js']) {
    assert.equal((await browserFetch(origin + path, { headers: { Accept: 'application/json' } })).status, 404, path);
  }
  assert.equal((await browserFetch(origin + '/frontend/login.html')).status, 200);
  console.log('PASS actual public root serves the frontend and excludes backend/private/seed paths');
} finally {
  if (child.pid) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* already exited */ } }
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ } }
  }
}
