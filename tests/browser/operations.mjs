import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageBackendFrontend } from '../../scripts/stage-backend-frontend.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!isAbsolute(process.env.P1_BROWSER_MODULE || '')) throw new Error('Use the private locked browser runtime.');
const { chromium } = await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
const php = process.env.PHP_BINARY || 'php', fixture = resolve(root, 'backend/tests/Support/browser-operational-fixture.php');
const cli = (...args) => execFileSync(php, [fixture, ...args], { cwd: root, env: process.env, windowsHide: true }).toString();
const records = JSON.parse(cli());
await stageBackendFrontend({ root, operationalTest: true });
const listener = createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/operational-router.php')], {
  cwd: root, detached: process.platform !== 'win32', windowsHide: true, stdio: 'ignore',
  env: { ...process.env, APP_ENV: 'testing', P1_OPERATIONAL_BROWSER: '1', P2_TEST_BINDINGS: 'true', SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' },
});
const evidence = resolve(root, 'tests/browser/evidence/operations');
const report = { scope: 'Original DOM/navigation, actual single transport, Laravel cookies/CSRF and MySQL. No DOM/reference stubs.', checks: [], screenshots: [] };
let browser;
const people = {};
async function screenshot(page, name) { await page.screenshot({ path: resolve(evidence, name + '.png'), fullPage: true }); report.screenshots.push(name + '.png'); }
async function check(name, work) { await work(); report.checks.push(name); console.log('PASS original browser: ' + name); }
async function login(key) {
  const record = records.people[key], context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  await page.clock.install();
  page.on('pageerror', error => console.log('BROWSER PAGE ERROR ' + key + ': ' + error.message));
  await page.goto(origin + '/frontend/' + (record.role === 'resident' ? 'resident-login.html' : 'login.html'));
  await page.locator('#email').fill(record.email); await page.locator('#password').fill(record.password); await page.locator('#sign-in').click();
  await page.waitForURL('**/' + (record.role === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'));
  return people[key] = { context, page, record };
}
async function openAlert(who, id) { await who.page.goto(origin + '/frontend/official-alert.html?id=' + id); await who.page.locator('.alert-incident-heading').waitFor(); }
async function pick(who, id, { mode = 'acknowledge', role = 'responder', target = 'responder' } = {}) {
  const page = who.page;
  await page.locator(mode === 'acknowledge' ? '[data-workflow="acknowledge"]' : mode === 'reassign' ? `[data-reassign="${role}"]` : `[data-assign="${role}"]`).click();
  const dialog = page.getByRole('dialog', { name: (mode === 'reassign' ? 'Reassign ' : 'Assign ') + role, exact: true });
  await dialog.locator(`[name="personnel_id"][value="${records.people[target].id}"]`).check();
  if (mode === 'reassign') await dialog.locator('[name=reason]').fill('Fictional shift replacement');
  await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
}
async function response(who, required, status, drop = false) {
  const page = who.page, calls = []; let lost = drop;
  const handler = async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (lost) { lost = false; const reply = await route.fetch(); assert.equal(reply.status(), 200); await reply.dispose(); return route.abort('failed'); }
    return route.continue();
  };
  await page.route('**/api/v1/alerts/*/responses', handler);
  await page.locator('[data-workflow=logResponse]').click();
  const dialog = page.getByRole('dialog', { name: 'Log response', exact: true });
  await dialog.locator('[name=response_type]').selectOption('Assessment');
  await dialog.locator('[name=rescue_required]').selectOption(required ? 'Yes' : 'No');
  await dialog.locator('[name=response_status]').selectOption(status);
  await dialog.locator('[name=notes]').fill('Fictional first aid assessment');
  await dialog.locator('[type=submit]').click();
  if (drop) {
    await dialog.locator('[data-error]:visible').waitFor();
    assert.equal(await dialog.locator('[name=notes]').inputValue(), 'Fictional first aid assessment');
    await dialog.locator('[type=submit]').click();
  }
  await dialog.waitFor({ state: 'detached' }); await page.unroute('**/api/v1/alerts/*/responses', handler);
  if (drop) { assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); }
}
async function resolveAlert(who, id) {
  await openAlert(who, id); await who.page.locator('[data-workflow=resolve]').click();
  await who.page.getByRole('dialog', { name: 'Resolve alert?', exact: true }).getByRole('button', { name: 'Resolve', exact: true }).click();
  await who.page.getByText('This alert is resolved.', { exact: true }).waitFor();
}
async function sos(who, lostReply = false) {
  const page = who.page, calls = []; let drop = lostReply;
  const handler = async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (drop) { drop = false; const reply = await route.fetch(); assert.equal(reply.status(), 200); await reply.dispose(); return route.abort('failed'); }
    return route.continue();
  };
  await page.route('**/api/v1/alerts', handler); await page.goto(origin + '/frontend/resident-report.html');
  await page.locator('#send').click();
  if (lostReply) { await page.getByText('Unable to reach the server. Check your connection and try again.', { exact: true }).waitFor(); await page.locator('#send').click(); }
  await page.waitForURL(url => url.searchParams.has('id'));
  const id = Number(new URL(page.url()).searchParams.get('id'));
  await page.unroute('**/api/v1/alerts', handler);
  if (lostReply) { assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); }
  if (lostReply) {
    await page.waitForURL('**/resident-alert.html?id=' + id);
    await page.getByRole('link', { name: 'Add details', exact: true }).click();
  } else await page.locator('#add-details').click();
  await page.locator('#details').waitFor();
  await page.locator('[data-type=Flood]').click(); await page.locator('#description').fill('Fictional flood at the household');
  await page.locator('#not-sure').uncheck(); await page.locator('#victims').fill('2');
  assert.equal(await page.locator('#photo').isDisabled(), true);
  await page.locator('#submit-details').click(); await page.waitForURL('**/resident-alert.html?id=' + id);
  assert.equal(JSON.parse(cli('inspect', String(id))).resident_alerts, 1);
  return id;
}
try {
  await mkdir(evidence, { recursive: true });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.equal(ready, true, 'Operational loopback server did not start.');
  browser = await chromium.launch({ headless: true });
  for (const role of ['resident', 'residentRescue', 'captain', 'secretary', 'responder', 'rescuer', 'otherResident', 'replacement', 'foreignResident']) await login(role);
  let noRescue, rescue;
  await check('Resident original SOS/details, lost-reply retry keeps one key/body and one incident', async () => { noRescue = await sos(people.resident, true); await screenshot(people.resident.page, 'resident-pending'); });
  await check('Wrong resident, other barangay and unassigned operator cannot open the private incident', async () => {
    for (const key of ['otherResident', 'foreignResident']) { await people[key].page.goto(origin + '/frontend/resident-alert.html?id=' + noRescue); await people[key].page.getByText('Unable to load this page', { exact: true }).waitFor(); assert.equal(await people[key].page.getByText('Fictional flood at the household', { exact: true }).count(), 0); }
    await people.rescuer.page.goto(origin + '/frontend/official-alert.html?id=' + noRescue); await people.rescuer.page.getByText('Alert unavailable', { exact: true }).waitFor();
  });
  await check('Secretary manually chooses a responder; a stale Captain picker cannot replace its original revision', async () => {
    await openAlert(people.captain, noRescue); await people.captain.page.locator('[data-workflow=acknowledge]').click();
    const stale = people.captain.page.getByRole('dialog', { name: 'Assign responder', exact: true });
    await stale.locator(`[name=personnel_id][value="${records.people.replacement.id}"]`).check();
    await openAlert(people.secretary, noRescue); await pick(people.secretary, noRescue);
    await stale.locator('[type=submit]').click(); await stale.locator('[data-error]:visible').waitFor();
    assert.equal(await stale.locator('[type=submit]').isDisabled(), true); await stale.locator('[data-cancel]').click();
  });
  await check('Original response retries the lost reply with one record; no-rescue completion still needs explicit Secretary resolution', async () => {
    await openAlert(people.responder, noRescue); await response(people.responder, false, 'Completed', true);
    const saved = JSON.parse(cli('inspect', String(noRescue))); assert.equal(saved.responses, 1); assert.equal(saved.status, 'Responding');
    await resolveAlert(people.secretary, noRescue); assert.equal(JSON.parse(cli('inspect', String(noRescue))).status, 'Resolved'); await screenshot(people.secretary.page, 'no-rescue-resolved');
  });
  await check('Rescue-required assessment, Captain manual rescuer, active facility, completed rescue and explicit resolution use original dialogs', async () => {
    rescue = await sos(people.residentRescue); await openAlert(people.secretary, rescue); await pick(people.secretary, rescue);
    await openAlert(people.responder, rescue); await response(people.responder, true, 'Responding');
    // Establish the real polling baseline, then change the assignment while a dirty original dialog is open.
    await people.responder.page.locator('[data-workflow=logResponse]').click();
    const dirty = people.responder.page.getByRole('dialog', { name: 'Log response', exact: true });
    await dirty.locator('[name=notes]').fill('Keep this unsaved note');
    await dirty.locator('[name=rescue_required]').selectOption('Yes');
    await people.responder.page.clock.fastForward(16000);
    await people.responder.page.waitForTimeout(300);
    await openAlert(people.captain, rescue); await pick(people.captain, rescue, { mode: 'reassign', role: 'responder', target: 'replacement' });
    const changed = people.responder.page.waitForResponse(reply => reply.url().endsWith('/api/v1/alerts/' + rescue));
    await people.responder.page.clock.fastForward(16000); await changed;
    assert.equal(await dirty.locator('[name=notes]').inputValue(), 'Keep this unsaved note');
    await dirty.locator('[type=submit]').click(); await dirty.locator('[data-error]:visible').waitFor();
    assert.equal(await dirty.locator('[name=notes]').inputValue(), 'Keep this unsaved note');
    await people.responder.page.goto(origin + '/frontend/official-alert.html?id=' + rescue);
    await people.responder.page.getByText('Alert unavailable', { exact: true }).waitFor();
    cli('inactive', String(records.people.responder.id));
    assert.equal((await people.responder.context.request.get(origin + '/api/v1/me')).status(), 401);
    await openAlert(people.replacement, rescue); await response(people.replacement, true, 'Responding');
    report.checks.push('Transfer revokes former responder; real polling preserves dirty dialog/revision; inactive account loses its session');
    await openAlert(people.captain, rescue); await pick(people.captain, rescue, { mode: 'assign', role: 'rescuer', target: 'rescuer' });
    for (const status of ['In progress', 'Completed']) {
      await openAlert(people.rescuer, rescue); await people.rescuer.page.locator('[data-workflow=logRescue]').click();
      const dialog = people.rescuer.page.getByRole('dialog', { name: 'Log rescue', exact: true }); await dialog.locator('#choose-destination').click();
      const picker = people.rescuer.page.getByRole('dialog', { name: 'Choose destination facility', exact: true }); await picker.locator(`[data-facility="${records.facility}"]`).click();
      await dialog.locator('[name=rescue_status]').selectOption(status); await dialog.locator('[name=notes]').fill('Fictional transport to the selected center');
      await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
    }
    assert.equal(JSON.parse(cli('inspect', String(rescue))).status, 'Rescue in progress');
    await resolveAlert(people.captain, rescue); const saved = JSON.parse(cli('inspect', String(rescue))); assert.equal(saved.status, 'Resolved'); assert.equal(saved.rescues, 2);
    await screenshot(people.captain.page, 'rescue-resolved');
  });
  await check('Captured stale revision gets409 and nearby data contains no household/reporter/photo identity', async () => {
    const nearbyId = await sos(people.otherResident);
    const result = await people.resident.page.evaluate(async id => {
      const { Http } = await import('/frontend/assets/js/core/auth.js');
      let status; try { await Http.request('alerts/' + id, { method: 'PATCH', body: { expected_revision: 0, description: 'Rejected stale edit' }, headers: { 'Idempotency-Key': crypto.randomUUID() } }); } catch (error) { status = error.status; }
      const nearby = await Http.request('nearby-alerts'); return { status, nearby };
    }, noRescue);
    assert.equal(result.status, 409);
    assert.ok(result.nearby.some(alert => alert.id === nearbyId));
    for (const alert of result.nearby) for (const key of ['resident_id', 'household_id', 'resident', 'contact_number', 'photo_name', 'photo_upload_id']) assert.equal(Object.hasOwn(alert, key), false);
  });
  await check('Same-origin account switch rejects stale old-tab writes without changing the persisted incident', async () => {
    const page = await people.resident.context.newPage(), account = records.people.residentRescue;
    await page.goto(origin + '/frontend/resident-login.html'); await page.locator('#email').fill(account.email); await page.locator('#password').fill(account.password); await page.locator('#sign-in').click();
    await page.waitForURL('**/resident-dashboard.html');
    const statuses = await people.resident.page.evaluate(async id => {
      const { Http } = await import('/frontend/assets/js/core/auth.js'); const statuses = [];
      for (let n = 0; n < 2; n++) { try { await Http.request('alerts/' + id, { method: 'PATCH', body: { expected_revision: 0 }, headers: { 'Idempotency-Key': crypto.randomUUID() } }); statuses.push(200); } catch (error) { statuses.push(error.status); } }
      return statuses;
    }, noRescue);
    assert.ok(statuses.every(status => [419, 409].includes(status))); assert.ok(statuses.includes(409));
    assert.equal(JSON.parse(cli('inspect', String(noRescue))).description, 'Fictional flood at the household');
    await page.close();
  });
  await check('Actual in-app receipts project recipient-safe original notifications; pagehide tears polling down', async () => {
    assert.ok(JSON.parse(cli('deliver', String(rescue))).events > 0);
    const who = people.residentRescue; await who.page.goto(origin + '/frontend/resident-notifications.html');
    const response = await who.context.request.get(origin + '/api/v1/notifications'); assert.equal(response.status(), 200);
    const notices = (await response.json()).data; assert.ok(notices.length > 0);
    for (const notice of notices) { assert.ok(!Object.hasOwn(notice, 'object_key')); assert.ok(!Object.hasOwn(notice, 'password')); if (notice.recipient_id) assert.equal(notice.recipient_id, who.record.id); }
    await screenshot(who.page, 'resident-notifications');
    let polls = 0; who.page.on('request', request => { if (request.url().includes('/revisions/')) polls++; });
    await who.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    await who.page.clock.fastForward(32000); assert.equal(polls, 0);
  });
  await check('Generation revocation clears actual browser identity; private paths stay inaccessible', async () => {
    cli('revoke', String(records.people.otherResident.id));
    await people.otherResident.page.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.refresh(); }).catch(() => {});
    await people.otherResident.page.waitForURL('**/resident-login.html');
    for (const path of ['/.env', '/backend/.env', '/vendor/autoload.php', '/frontend/assets/js/data/seed.js']) assert.equal((await people.captain.context.request.get(origin + path)).status(), 404);
  });
  await writeFile(resolve(evidence, 'operations-report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS ${report.checks.length} original operational browser scenarios; ${report.screenshots.length} screenshots`);
} catch (error) {
  report.failure = { message: error.message, stack: error.stack }; await writeFile(resolve(evidence, 'operations-report.json'), JSON.stringify(report, null, 2));
  for (const [key, who] of Object.entries(people)) { try { console.log('BROWSER FAILURE VIEW ' + key + ': ' + (await who.page.locator('main').innerText({ timeout: 1000 })).slice(0,1800)); await screenshot(who.page, 'failure-' + key); } catch {} }
  throw error;
} finally {
  await browser?.close();
  if (server.pid) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {} }
    else { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
  }
}
