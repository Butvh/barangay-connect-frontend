import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageBackendFrontend } from '../../scripts/stage-backend-frontend.mjs';

export async function workflowRuntime(name, { photoTest = false, consentTest = true, localMailPort = null } = {}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  if (!/^[a-z-]+$/.test(name) || !isAbsolute(process.env.P1_BROWSER_MODULE || '')) throw new Error('Use a named private workflow and locked browser runtime.');
  const { chromium } = await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
  const php = process.env.PHP_BINARY || 'php';
  const env = { ...process.env, APP_ENV: 'testing', IDENTITY_ENABLED: 'true', P1_OPERATIONAL_BROWSER: '1', P2_TEST_BINDINGS: 'true', P1_ADMIN_TEST_BINDINGS: 'true',
    P1_PHOTO_TEST_BINDINGS: String(photoTest), P1_CONSENT_TEST_BINDINGS: String(consentTest), P1_SMS_INTENT_TEST_BINDINGS: 'false',
    P1_LOCAL_RECOVERY_MAIL: String(localMailPort !== null), ...(localMailPort === null ? {} : { P1_LOCAL_MAIL_PORT: String(localMailPort) }),
    SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' };
  const cli = (...args) => execFileSync(php, args, { cwd: root, env, windowsHide: true }).toString();
  const records = JSON.parse(cli('backend/tests/Support/browser-operational-fixture.php'));
  await stageBackendFrontend({ root, operationalTest: true, administrationTest: true, photoTest, consentTest });
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(php, ['-d', 'upload_max_filesize=10M', '-d', 'post_max_size=52M', '-d', 'max_file_uploads=12', '-S', `127.0.0.1:${port}`,
    '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/operational-router.php')], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  let ready = false, browser;
  const directory = resolve(root, 'tests/browser/evidence', name);
  const report = { scope: 'Original DOM, actual configured owner services, Laravel cookies/CSRF and genuine disposable MySQL. No domain/authority/DOM stubs.', checks: [], screenshots: [] };
  const contexts = [];
  async function close() { await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server.kill(); }
  try {
    await mkdir(directory, { recursive: true });
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    assert.ok(ready, 'Owned private Laravel server did not become ready.');
    browser = await chromium.launch({ headless: true, ...(process.env.P1_BROWSER_CHANNEL === 'chrome' ? { channel: 'chrome' } : {}) });
  } catch (error) { report.error = error.message; await close(); throw error; }
  async function guest(viewport = { width: 1440, height: 1080 }) {
    const context = await browser.newContext({ viewport }); contexts.push(context);
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    return { page, context };
  }
  async function login(key) {
    const who = await guest(), account = records.people[key];
    await who.page.goto(origin + '/frontend/' + (account.role === 'resident' ? 'resident-login.html' : 'login.html'));
    await who.page.locator('#email').fill(account.email); await who.page.locator('#password').fill(account.password); await who.page.locator('#sign-in').click();
    await who.page.waitForURL('**/' + (account.role === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'));
    return { ...who, account };
  }
  async function check(label, run) {
    try { await run(); report.checks.push(label); console.log('PASS original workflow: ' + label); }
    catch (error) { report.failed = label; report.error = error.message; throw error; }
  }
  async function screenshot(page, label) {
    if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a non-sensitive screenshot name.');
    const file = label + '.png'; await page.screenshot({ path: resolve(directory, file), fullPage: true }); report.screenshots.push(file);
  }
  // Generate actual image bytes through an encoding-safe test boundary.
  const image = Buffer.from(cli('-r', 'ob_start();imagepng(imagecreatetruecolor(32,24));echo base64_encode(ob_get_clean());'), 'base64');
  return { root, php, env, records, origin, report, cli, guest, login, check, screenshot, close, image };
}
