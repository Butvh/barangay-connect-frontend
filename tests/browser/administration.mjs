import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageBackendFrontend } from '../../scripts/stage-backend-frontend.mjs';

// Read/form-readiness evidence only. The real positive source SQL tests stay
// mandatory; these checks cannot turn an unavailable owner writer into a pass.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!isAbsolute(process.env.P1_BROWSER_MODULE || '')) throw new Error('Use the private locked browser runtime.');
const { chromium } = await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
const php = process.env.PHP_BINARY || 'php';
const records = JSON.parse(execFileSync(php, ['backend/tests/Support/browser-operational-fixture.php'], { cwd: root, env: process.env, windowsHide: true }).toString());
await stageBackendFrontend({ root, operationalTest: true, administrationTest: true });
const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(php, ['-d', 'upload_max_filesize=10M', '-d', 'post_max_size=52M', '-d', 'max_file_uploads=12',
  '-S', `127.0.0.1:${port}`, '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/operational-router.php')], {
  cwd: root, windowsHide: true, stdio: 'ignore',
  env: { ...process.env, APP_ENV: 'testing', P1_OPERATIONAL_BROWSER: '1', P2_TEST_BINDINGS: 'true', P1_ADMIN_TEST_BINDINGS: 'true',
    P1_LOCAL_RECOVERY_MAIL: 'false', SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' },
});
const evidence = resolve(root, 'tests/browser/evidence/administration');
const report = { scope: 'Original administration reads, form validation and role denial on actual Laravel/MySQL. Positive write acceptance remains a separate required SQL gate.', checks: [], screenshots: [], positiveWriteAcceptance: false };
let browser;
async function check(name, work) { await work(); report.checks.push(name); console.log('PASS administration readiness: ' + name); }
async function login(key) {
  const account = records.people[key], context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  await page.goto(origin + '/frontend/' + (account.role === 'resident' ? 'resident-login.html' : 'login.html'));
  await page.locator('#email').fill(account.email); await page.locator('#password').fill(account.password); await page.locator('#sign-in').click();
  await page.waitForURL('**/' + (account.role === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'));
  return { page, context, account };
}
async function responsive(page, name) {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${name} overflows at ${width}px`);
    const path = `${name}-${width}.png`; await page.screenshot({ path: resolve(evidence, path), fullPage: true }); report.screenshots.push(path);
  }
}
try {
  await mkdir(evidence, { recursive: true });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.ok(ready, 'Private Laravel test server did not become ready.');
  browser = await chromium.launch({ headless: true, ...(process.env.P1_BROWSER_CHANNEL === 'chrome' ? { channel: 'chrome' } : {}) });
  const captain = await login('captain'), resident = await login('resident'), secretary = await login('secretary');
  await check('Own official and resident profile fields come from persisted identity, without cross-role disclosure', async () => {
    await captain.page.goto(origin + '/frontend/official-profile.html');
    await captain.page.locator('#official-profile-full_name').waitFor();
    assert.equal(await captain.page.locator('#official-profile-full_name').inputValue(), 'Fictional QA captain');
    assert.ok(await captain.page.locator('#official-profile-role').getAttribute('readonly') !== null);
    const result = await captain.context.request.get(origin + '/api/v1/profile'); assert.equal(result.status(), 200);
    assert.match(result.headers()['cache-control'], /private/); assert.match(result.headers()['cache-control'], /no-store/);
    const data = (await result.json()).data; assert.equal(data.id, captain.account.id); assert.equal(Object.hasOwn(data, 'password'), false);
    await responsive(captain.page, 'official-profile');
    await resident.page.goto(origin + '/frontend/resident-profile.html'); await resident.page.locator('#profile-full_name').waitFor();
    assert.equal(await resident.page.locator('#profile-full_name').inputValue(), 'Fictional QA resident');
    await responsive(resident.page, 'resident-profile');
  });
  await check('Captain personnel reads and private requirement form are available; Secretary is denied the actual API', async () => {
    await captain.page.setViewportSize({ width: 1440, height: 1080 });
    await captain.page.goto(origin + '/frontend/captain-personnel.html'); await captain.page.locator('[data-add]:enabled').waitFor();
    await captain.page.locator('[data-add]').click();
    const form = captain.page.getByRole('dialog'); await form.locator('input[type=file]').waitFor();
    assert.ok(await form.getByText(/uploaded privately/).count() > 0);
    await captain.page.keyboard.press('Escape'); await form.waitFor({ state: 'detached' });
    await responsive(captain.page, 'personnel');
    assert.equal((await secretary.context.request.get(origin + '/api/v1/personnel')).status(), 403);
  });
  await check('Facility directory and original create validation use the shared administrative factory', async () => {
    await captain.page.setViewportSize({ width: 1440, height: 1080 });
    await captain.page.goto(origin + '/frontend/official-facilities.html'); await captain.page.locator('[data-facility-card]').waitFor();
    await captain.page.locator('[data-add]').click();
    const form = captain.page.getByRole('dialog', { name: 'Add facility', exact: true });
    await form.locator('[type=submit]').click();
    assert.ok(await form.locator('[aria-invalid=true]').count() >= 2);
    await form.getByRole('button', { name: 'Cancel', exact: true }).click(); await form.waitFor({ state: 'detached' });
    await responsive(captain.page, 'facilities');
  });
  await check('Resident verification read uses its current own source; authenticated account creation is rejected', async () => {
    await resident.page.goto(origin + '/frontend/resident-verification.html');
    await resident.page.getByRole('heading', { name: 'Your residency is verified', exact: true }).waitFor();
    const status = await resident.page.evaluate(async () => {
      const { Http } = await import('/frontend/assets/js/core/auth.js');
      try { await Http.request('auth/register', { method: 'POST', body: {}, headers: { 'Idempotency-Key': crypto.randomUUID() } }); return 200; } catch (error) { return error.status; }
    });
    assert.equal(status, 409);
  });
  await check('Guest registration retains visible labels and validates account input before sending any create', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage(); let creates = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/auth/register')) creates++; });
    await page.goto(origin + '/frontend/register.html'); await page.locator('[data-barangay]').first().click();
    await page.locator('#account [type=submit], #account button:not([type])').first().click();
    assert.ok(await page.locator('#account [aria-invalid=true]').count() >= 3); assert.equal(creates, 0);
    await responsive(page, 'registration'); await context.close();
  });
} catch (error) {
  report.error = error.message; throw error;
} finally {
  await mkdir(evidence, { recursive: true }); await writeFile(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); server.kill();
}
