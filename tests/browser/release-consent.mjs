import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { stageBackendFrontend } from '../../scripts/stage-backend-frontend.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = { ...process.env, APP_ENV: 'testing', IDENTITY_ENABLED: 'true', INTEGRATION_RELEASE_ENABLED: 'true', INTEGRATION_SMS_INTENT_ENABLED: 'true',
  P2_MODULES_ENABLED: 'false', P2_TEST_BINDINGS: 'false', P1_ADMIN_TEST_BINDINGS: 'false', P1_CONSENT_TEST_BINDINGS: 'false',
  P1_PHOTO_TEST_BINDINGS: 'false', P1_SMS_INTENT_TEST_BINDINGS: 'false', P1_OPERATIONAL_BROWSER: '0', P2_TEST_HTTP: '0',
  SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' };
const php = env.PHP_BINARY || 'php';
const records = JSON.parse(execFileSync(php, ['backend/tests/Support/browser-operational-fixture.php'], { cwd: root, env, windowsHide: true }).toString());
await stageBackendFrontend({ root, releaseProfile: 'p0-v1' });
const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = 'http://127.0.0.1:' + port;
const server = spawn(php, ['-S', '127.0.0.1:' + port, '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/release-router.php')], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
const { chromium } = await import(pathToFileURL(env.P1_BROWSER_MODULE).href);
let browser;
const report = { checks: [], screenshots: [], testBindings: false, externalDelivery: false };
const evidence = resolve(root, 'tests/browser/evidence/release-consent');
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/up')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(env.P1_BROWSER_CHANNEL === 'chrome' ? { channel: 'chrome' } : {}) });
  await mkdir(evidence, { recursive: true });
  for (const key of ['resident', 'captain', 'secretary']) {
    const context = await browser.newContext({ viewport: { width: key === 'secretary' ? 390 : 1440, height: 1080 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const who = records.people[key];
    await page.goto(origin + '/frontend/' + (key === 'resident' ? 'resident-login.html' : 'login.html'));
    await page.locator('#email').fill(who.email); await page.locator('#password').fill(who.password); await page.locator('#sign-in').click();
    await page.waitForURL('**/' + (key === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'));
    const profile = origin + '/frontend/' + (key === 'resident' ? 'resident-profile.html' : 'official-profile.html');
    await page.goto(profile);
    const purpose = key === 'resident' ? 'Barangay announcements SMS preference' : 'New alerts awaiting review SMS preference';
    const form = page.getByRole('form', { name: purpose });
    await form.getByText('SMS not enabled for this purpose.', { exact: true }).waitFor();
    const stalePage = await context.newPage(); await stalePage.goto(profile);
    const stale = stalePage.getByRole('form', { name: purpose }); await stale.getByText('SMS not enabled for this purpose.', { exact: true }).waitFor();
    await form.getByRole('checkbox').check(); await form.getByRole('button', { name: 'Save preference', exact: true }).click();
    await form.getByText('SMS allowed for this purpose.', { exact: true }).waitFor();
    await stale.getByRole('checkbox').check(); await stale.getByRole('button', { name: 'Save preference', exact: true }).click();
    await stale.locator('[data-error]').filter({ hasText: 'Reload' }).waitFor();
    assert.equal(await stale.getByRole('checkbox').isChecked(), true, 'conflict preserves user intent');
    const route = 'api/v1/me/notification-preferences/' + (key === 'resident' ? 'barangay_announcements' : 'incident_review');
    assert.equal((await (await context.request.get(origin + '/' + route)).json()).data.revision, 1);
    assert.equal((await context.request.put(origin + '/' + route, { data: { state: 'revoked', expected_revision: 1, policy_version: 'sms-consent.v1', template_version: key === 'resident' ? 'announcement-review.v1' : 'alert-review.v1' } })).status(), 419, 'real CSRF rejects missing token');
    await form.getByRole('checkbox').uncheck(); await form.getByRole('button', { name: 'Save preference', exact: true }).click();
    await form.getByText('SMS permission withdrawn.', { exact: true }).waitFor();
    const row = (await (await context.request.get(origin + '/' + route)).json()).data;
    assert.equal(row.state, 'revoked'); assert.equal(row.revision, 2);
    const file = key + '.png'; await page.screenshot({ path: resolve(evidence, file), fullPage: true }); report.screenshots.push(file);
    report.checks.push(key + ': original profile grant/revoke, stale revision, real CSRF, TEST flags off'); console.log('PASS release consent: ' + key);
    await context.close();
  }
} catch (error) { report.error = error.message; throw error; }
finally { await mkdir(evidence, { recursive: true }); await writeFile(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server.kill(); }
