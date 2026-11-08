import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!process.env.P1_BROWSER_MODULE || !isAbsolute(process.env.P1_BROWSER_MODULE)) throw new Error('Use the private, locked browser-test runtime outside the repository.');
const { chromium } = await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
const php = process.env.PHP_BINARY || 'php';
const fixtureFile = resolve(root, 'backend/tests/Support/browser-identity-fixture.php');
const fixtures = JSON.parse(execFileSync(php, [fixtureFile], { cwd: root, env: process.env, windowsHide: true }).toString());
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(php, ['artisan', 'serve', '--host=127.0.0.1', `--port=${port}`, '--no-reload'], {
  cwd: resolve(root, 'backend'), detached: process.platform !== 'win32', windowsHide: true, stdio: 'ignore',
  env: { ...process.env, APP_ENV: 'local', IDENTITY_ENABLED: 'true', P2_MODULES_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false', SMS_ENABLED: 'false', MAKE_ENABLED: 'false' },
});
let browser, context;
const evidence = resolve(root, 'tests/browser/evidence');
const report = { scope: 'Actual original identity UI only; domain data/photos remain unavailable', checks: [], screenshots: [] };
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch { /* owned server startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, 'Private browser server failed to start.');
  await mkdir(evidence, { recursive: true });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.goto(origin + '/frontend/login.html');
  await page.locator('#official-login').waitFor();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.screenshot({ path: resolve(evidence, `login-${width}.png`), fullPage: true });
    report.screenshots.push(`login-${width}.png`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Login overflows at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  async function login(target, identity, resident = false) {
    await target.goto(origin + '/frontend/' + (resident ? 'resident-login.html' : 'login.html'));
    await target.locator('#email').fill(identity.email); await target.locator('#password').fill(identity.password);
    await target.locator('#sign-in').click();
    await target.waitForURL('**/' + (resident ? 'resident-dashboard.html' : 'official-dashboard.html'));
  }
  await login(page, fixtures.captain);
  let response = await context.request.get(origin + '/api/v1/me');
  assert.equal(response.status(), 200);
  const current = (await response.json()).data;
  assert.equal(current.id, fixtures.captain.id);
  assert.equal(current.role, 'captain');
  for (const field of ['password', 'remember_token', 'auth_version']) assert.equal(Object.hasOwn(current, field), false);
  await page.locator('[data-sign-out]:visible').first().waitFor();
  await page.screenshot({ path: resolve(evidence, 'identity-shell-domain-disabled.png'), fullPage: true });
  report.screenshots.push('identity-shell-domain-disabled.png');
  report.checks.push('Original official sign-in form authenticates real DBA rows; safe /me200 and role projection');
  assert.equal((await context.request.get(origin + '/api/v1/incident-photos/1/download')).status(), 503);
  await page.locator('[data-sign-out]:visible').first().click();
  await page.waitForURL('**/login.html');
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 401);
  report.checks.push('Original Sign out control invalidates the real server session before navigation');

  await login(page, fixtures.captain);
  const second = await context.newPage(); second.setDefaultTimeout(15000);
  await login(second, fixtures.resident, true);
  const statuses = await page.evaluate(async () => {
    const { Http } = await import('/frontend/assets/js/core/auth.js');
    const seen = [];
    for (let i = 0; i < 2; i++) {
      try { await Http.request('auth/logout', { method: 'POST', body: {} }); seen.push(200); }
      catch (error) { seen.push(error.status); }
    }
    return seen;
  });
  assert.equal(statuses.every(status => status === 419 || status === 409), true);
  assert.equal(statuses.includes(409), true);
  assert.equal((await (await context.request.get(origin + '/api/v1/me')).json()).data.id, fixtures.resident.id);
  report.checks.push('Two real tabs share origin cookies; stale old-tab transport writes get419/409 and cannot sign out the new account');
  execFileSync(php, [fixtureFile, 'revoke', String(fixtures.resident.id)], { cwd: root, env: process.env, windowsHide: true });
  assert.equal((await context.request.get(origin + '/api/v1/me')).status(), 401);
  report.checks.push('A committed operations-guarded generation change revokes the actual browser session');
  for (const path of ['/.env', '/backend/.env', '/vendor/autoload.php', '/storage/private.png', '/frontend/assets/js/data/seed.js']) assert.equal((await context.request.get(origin + path)).status(), 404);
  report.checks.push('Private/config/vendor/demo-seed paths remain404; no public photo bytes or fabricated filename upload');
  await writeFile(resolve(evidence, 'identity-report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS ${report.checks.length} real-browser identity scenarios; ${report.screenshots.length} screenshots; no domain/worker completeness claim`);
} finally {
  await context?.close(); await browser?.close();
  if (server.pid) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* owned process exited */ } }
    else { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* owned process exited */ } }
  }
}
