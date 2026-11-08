import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageBackendFrontend } from '../../../scripts/stage-backend-frontend.mjs';

// Run through rehearsal.mjs civic on a clean admitted candidate. No copied
// transport, fake authority, DOM stubs, schema reset or external delivery.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
assert.ok(isAbsolute(process.env.P1_BROWSER_MODULE || ''), 'Use the private locked browser runtime.');
const { chromium } = await import(pathToFileURL(process.env.P1_BROWSER_MODULE).href);
const env = { ...process.env, APP_ENV: 'testing', IDENTITY_ENABLED: 'true', P1_OPERATIONAL_BROWSER: '1',
  P2_TEST_BINDINGS: 'true', P1_ADMIN_TEST_BINDINGS: 'true', P1_PHOTO_TEST_BINDINGS: 'false', P1_CONSENT_TEST_BINDINGS: 'false',
  P1_SMS_INTENT_TEST_BINDINGS: 'false', SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' };
const php = process.env.PHP_BINARY || 'php';
const cli = (...args) => execFileSync(php, [resolve(root, 'backend/tests/P2/civic-fixture.php'), ...args], { cwd: root, env, windowsHide: true }).toString();
const records = JSON.parse(cli('prepare')); // Credentials exist only in caller memory.
const state = () => JSON.parse(cli('state'));
await stageBackendFrontend({ root, operationalTest: true, administrationTest: true, generalFeedbackTest: true });
const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/operational-router.php')],
  { cwd: root, env, windowsHide: true, stdio: 'ignore' });
const directory = resolve(root, 'tests/browser/evidence/p-two-civic');
const report = { scope: 'Original civic pages and dialogs, shared HTTP/intent, actual Laravel sessions/CSRF and disposable MySQL8.4. No domain/authority/DOM stubs. Not final DBA acceptance.', checks: [], screenshots: [], passed: false };
let browser;
async function check(label, work) {
  try { await work(); report.checks.push(label); console.log('PASS original civic: ' + label); }
  catch (error) { report.failed = label; throw error; }
}
async function login(key) {
  const account = records.people[key], context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  await page.goto(origin + '/frontend/' + (account.role === 'resident' ? 'resident-login.html' : 'login.html'));
  await page.locator('#email').fill(account.email); await page.locator('#password').fill(account.password); await page.locator('#sign-in').click();
  await page.waitForURL('**/' + (account.role === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'));
  // The redirect can precede dashboard reads that initialize capacity guards.
  // Finish those reads before taking full-state denial/replay baselines.
  await page.waitForLoadState('networkidle');
  return { page, context, account };
}
async function http(who, path, { method = 'GET', body, query = {} } = {}) {
  return who.page.evaluate(async ({ path, method, body, query }) => {
    const { Http } = await import('/frontend/assets/js/core/auth.js');
    try { return { status: 200, data: await Http.request(path, { method, query, ...(body === undefined ? {} : { body }),
      ...(method === 'POST' && (['announcements', 'feedback'].includes(path) || /^feedback\/\d+\/(review|archive)$/.test(path)) ? { headers: { 'Idempotency-Key': crypto.randomUUID() } } : {}) }) }; }
    catch (error) { return { status: error.status, code: error.code }; }
  }, { path, method, body, query });
}
async function noEffects(work) {
  const before = state().hashes; await work(); assert.deepEqual(state().hashes, before, 'Denied/replayed command changed source/history/payload/receipt/object hashes.');
}
async function feedbackForm(who, type, text) {
  const page = who.page; await page.goto(origin + '/frontend/resident-feedback-new.html?type=' + type); await page.locator('#feedback-form').waitFor();
  if (type === 'complaint') { await page.locator('#category').selectOption('Drainage and flooding'); await page.locator('[name=location_label]').fill('Fictional civic lane'); }
  if (type === 'general') await page.locator('[data-rating="4"]').click();
  await page.locator(type === 'general' ? '[name=comment]' : '[name=description]').fill(text);
}
async function newFeedback(who, type, text) {
  const before = state().feedback.map(row => row.id); await feedbackForm(who, type, text); await who.page.locator('#submit-feedback').click();
  await who.page.waitForURL('**/resident-feedback.html'); const added = state().feedback.filter(row => !before.includes(row.id));
  assert.equal(added.length, 1); assert.equal(added[0].type, type); return added[0].id;
}
// A lost response still commits on the real server. Keep request evidence private
// and compare whole stored hashes after commit and after the exact retry.
async function dropOnce(page, suffix) {
  const calls = []; let drop = true;
  const handler = async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (!drop) return route.continue(); drop = false;
    const reply = await route.fetch(); assert.ok([200, 201].includes(reply.status()), 'Initial real command must commit before response loss.'); await reply.dispose(); await route.abort('failed');
  };
  await page.route('**/api/v1/' + suffix, handler);
  return { calls, close: () => page.unroute('**/api/v1/' + suffix, handler), assertRetry() { assert.equal(calls.length, 2); assert.ok(calls[0].key); assert.deepEqual(calls[1], calls[0]); } };
}
async function announcements(who) {
  await who.page.goto(origin + '/frontend/official-announcements.html'); await who.page.locator('[data-compose]').waitFor(); await who.page.locator('.official-announcements-list').waitFor();
  await who.page.locator('.official-announcements-list[aria-busy]').waitFor({ state: 'detached' });
}
async function menu(who, id, action) { await who.page.locator(`[data-menu="${id}"]`).click(); await who.page.locator(`[role=menu] [data-action=${action}]`).click(); }
async function publish(who, title) {
  const before = state().announcements.map(row => row.id); await announcements(who); await who.page.locator('[data-compose]').click();
  const dialog = who.page.getByRole('dialog', { name: 'New announcement', exact: true });
  await dialog.locator('[name=title]').fill(title); await dialog.locator('[name=content]').fill('Complete fictional community information.');
  await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
  const added = state().announcements.filter(row => !before.includes(row.id)); assert.equal(added.length, 1); return added[0].id;
}
async function selected(who, type, id) {
  await who.page.goto(origin + `/frontend/official-feedback.html?type=${type}&id=${id}`);
  await who.page.locator(`button[data-record="${id}"][aria-pressed=true]`).waitFor();
}
async function picker(who) {
  await who.page.locator('[data-assign]').click(); const dialog = who.page.getByRole('dialog', { name: 'Assign Tanod', exact: true });
  await dialog.locator('#feedback-tanod').selectOption(String(records.tanod)); return dialog;
}
async function screenshot(page, label) { await page.screenshot({ path: resolve(directory, label + '.png'), fullPage: true }); report.screenshots.push(label + '.png'); }
try {
  await mkdir(directory, { recursive: true });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/up')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.ok(ready, 'Owned loopback Laravel server did not start.');
  const channel = process.env.P1_BROWSER_CHANNEL;
  browser = await chromium.launch({ headless: true, ...(['chrome', 'msedge'].includes(channel) ? { channel } : {}) });
  report.browser = { version: browser.version(), channel: ['chrome', 'msedge'].includes(channel) ? channel : 'private Chromium' };
  const resident = await login('resident'), captain = await login('captain'), secretary = await login('secretary'), foreign = await login('foreignCaptain'), operator = await login('responder');
  let complaint, suggestion, general, publication;
  await check('Actual loopback entry denies anonymous access and session-only writes without CSRF', async () => {
    await noEffects(async () => {
      assert.equal((await fetch(origin + '/api/v1/feedback', { headers: { Accept: 'application/json' } })).status, 401);
      assert.equal((await captain.context.request.post(origin + '/api/v1/announcements', {
        headers: { Accept: 'application/json' }, data: { title: 'Missing CSRF', content: 'Must never persist.' },
      })).status(), 419);
    });
  });
  await check('Original complaint lost create reply preserves one body/key and full committed state; changed body cannot mint another key', async () => {
    await feedbackForm(resident, 'complaint', 'Original fictional drainage concern.'); const lost = await dropOnce(resident.page, 'feedback');
    await resident.page.locator('#submit-feedback').click(); await resident.page.getByText('Unable to reach the server. Check your connection and try again.', { exact: true }).waitFor();
    const committed = state(); assert.equal(committed.feedback.length, 1); complaint = committed.feedback[0].id;
    await resident.page.locator('[name=description]').fill('Changed uncertain concern.'); await resident.page.locator('#submit-feedback').click();
    await resident.page.getByText('Review or cancel the pending submission before changing it.', { exact: true }).waitFor(); assert.equal(lost.calls.length, 1); assert.deepEqual(state().hashes, committed.hashes);
    await resident.page.locator('[name=description]').fill('Original fictional drainage concern.'); await resident.page.locator('#submit-feedback').click();
    await resident.page.waitForURL('**/resident-feedback.html'); lost.assertRetry(); await lost.close(); assert.deepEqual(state().hashes, committed.hashes);
  });
  await check('Original suggestion and general forms retain full description/rating/comment without operational general actions', async () => {
    suggestion = await newFeedback(resident, 'suggestion', 'Full fictional suggestion with a second sentence.'); general = await newFeedback(resident, 'general', 'Full fictional rating comment, preserved without truncation.');
    const row = state().feedback.find(row => row.id === general); assert.equal(row.rating, 4); assert.equal(row.comment, 'Full fictional rating comment, preserved without truncation.');
    await selected(captain, 'general', general); assert.equal(await captain.page.locator('[data-assign],[data-resolve]').count(), 0);
    await captain.page.getByText(row.comment, { exact: true }).last().waitFor();
  });
  await check('Authenticated picker projection exposes only active local Tanod identity and observed revision; wrong role/scope have no effects', async () => {
    const options = await http(captain, `feedback/${complaint}/assignment-options`); assert.equal(options.status, 200); assert.equal(options.data.feedback_revision, 0);
    assert.ok(options.data.tanods.some(person => person.id === records.tanod)); assert.ok(!options.data.tanods.some(person => [records.inactiveTanod, records.foreignTanod].includes(person.id)));
    for (const person of options.data.tanods) assert.deepEqual(Object.keys(person).sort(), ['full_name', 'id']);
    await noEffects(async () => {
      for (const who of [resident, operator]) assert.equal((await http(who, `feedback/${complaint}/assignment-options`)).status, 403);
      assert.equal((await http(foreign, `feedback/${complaint}/assignment-options`)).status, 404);
      assert.equal((await http(foreign, `feedback/${complaint}/assignment`, { method: 'POST', body: { tanod_id: records.tanod, expected_revision: 0 } })).status, 404);
    });
  });
  await check('Original open picker rejects changed membership and account with full invariance after each authority mutation', async () => {
    for (const mode of ['membership', 'account']) {
      await selected(captain, 'complaint', complaint); const dialog = await picker(captain); cli(mode, String(records.tanod), 'inactive');
      try { await noEffects(async () => { await dialog.locator('[data-save]').click(); await dialog.locator('[data-save-error]:visible').waitFor(); }); }
      finally { cli(mode, String(records.tanod), 'active'); }
      await dialog.locator('[data-cancel]').click();
    }
  });
  await check('Original assignment and completion synchronize row/detail; a second official retains stale revision and receives409', async () => {
    await selected(secretary, 'complaint', complaint); await secretary.page.locator('[data-resolve]').click();
    const confirm = secretary.page.getByRole('dialog', { name: 'Mark feedback resolved?', exact: true }); await confirm.waitFor();
    await selected(captain, 'complaint', complaint); const dialog = await picker(captain);
    await dialog.locator('[data-save]').click(); await dialog.waitFor({ state: 'detached' }); assert.equal(state().feedback.find(row => row.id === complaint).status, 'Assigned');
    await captain.page.locator('tr.is-selected').getByText('Assigned', { exact: true }).waitFor(); await captain.page.locator('tr.is-selected').getByText('Civic QA tanod', { exact: true }).waitFor();
    await captain.page.locator('.official-feedback-detail').getByText('Tanod Civic QA tanod', { exact: true }).waitFor();
    const denied = secretary.page.waitForResponse(reply => reply.url().endsWith(`/feedback/${complaint}/resolution`) && reply.request().method() === 'POST');
    await noEffects(async () => { await confirm.getByRole('button', { name: 'Mark resolved', exact: true }).click(); assert.equal((await denied).status(), 409); await secretary.page.locator('[data-action-error]:visible').waitFor(); });
    await selected(captain, 'complaint', complaint); await captain.page.locator('[data-resolve]').click();
    await captain.page.getByRole('dialog', { name: 'Mark feedback resolved?', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(state().feedback.find(row => row.id === complaint).status, 'Assigned');
    await captain.page.locator('[data-resolve]').click(); await captain.page.getByRole('dialog', { name: 'Mark feedback resolved?', exact: true }).getByRole('button', { name: 'Mark resolved', exact: true }).click();
    await captain.page.getByText('Resolved feedback is read-only.', { exact: true }).waitFor(); assert.equal(state().feedback.find(row => row.id === complaint).status, 'Resolved');
    await captain.page.locator('tr.is-selected').getByText('Resolved', { exact: true }).waitFor(); assert.equal((await http(resident, 'feedback/' + complaint)).data.status, 'Resolved');
    await selected(secretary, 'suggestion', suggestion);
    // Closing Assign precedes the real list reload. Keep that response slow so
    // this regression cannot pass by clicking the old, internally guarded action.
    const slowRefresh = async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const reply = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ response: reply });
    };
    await secretary.page.route('**/api/v1/feedback', slowRefresh);
    try {
      const assign = await picker(secretary); await assign.locator('[data-save]').click(); await assign.waitFor({ state: 'detached' });
      await secretary.page.locator('tr.is-selected').getByText('Assigned', { exact: true }).waitFor();
      await secretary.page.locator('[data-resolve]:enabled').click(); await secretary.page.getByRole('dialog', { name: 'Mark feedback resolved?', exact: true }).getByRole('button', { name: 'Mark resolved', exact: true }).click();
      await secretary.page.getByText('Resolved feedback is read-only.', { exact: true }).waitFor(); assert.equal(state().feedback.find(row => row.id === suggestion).status, 'Resolved');
    } finally { await secretary.page.unroute('**/api/v1/feedback', slowRefresh); }
  });
  await check('Original publication retries lost create reply exactly, preserving single history/audit/outbox/receipt result', async () => {
    await announcements(captain); await captain.page.locator('[data-compose]').click(); const dialog = captain.page.getByRole('dialog', { name: 'New announcement', exact: true });
    await dialog.locator('[name=title]').fill('Civic browser publication'); await dialog.locator('[name=content]').fill('Original complete fictional publication.'); const lost = await dropOnce(captain.page, 'announcements');
    await dialog.locator('[type=submit]').click(); await dialog.locator('[data-save-error]:visible').waitFor(); const committed = state(); assert.equal(committed.announcements.length, 1); publication = committed.announcements[0].id;
    await dialog.locator('[name=content]').fill('Changed uncertain publication.'); await dialog.locator('[type=submit]').click();
    await dialog.getByText('Review or cancel the pending submission before changing it.', { exact: true }).waitFor(); assert.equal(lost.calls.length, 1); assert.deepEqual(state().hashes, committed.hashes);
    await dialog.locator('[name=content]').fill('Original complete fictional publication.'); await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' }); lost.assertRetry(); await lost.close(); assert.deepEqual(state().hashes, committed.hashes);
  });
  await check('Original edit preserves observed revision; stale edit is409 without history/payload effects; archive confirmation and retraction reason are real', async () => {
    await announcements(secretary); await menu(secretary, publication, 'edit'); const stale = secretary.page.getByRole('dialog', { name: 'Edit announcement', exact: true }); await stale.locator('[name=title]').fill('Stale title must not persist');
    await menu(captain, publication, 'edit'); const edit = captain.page.getByRole('dialog', { name: 'Edit announcement', exact: true }); await edit.locator('[name=title]').fill('Civic browser edited publication');
    await edit.locator('[type=submit]').click(); await edit.waitFor({ state: 'detached' });
    const response = secretary.page.waitForResponse(reply => reply.url().endsWith('/announcements/' + publication) && reply.request().method() === 'PATCH');
    await noEffects(async () => { await stale.locator('[type=submit]').click(); assert.equal((await response).status(), 409); await stale.locator('[data-save-error]:visible').waitFor(); });
    await menu(captain, publication, 'archive'); let confirm = captain.page.getByRole('dialog', { name: 'Archive announcement?', exact: true });
    await noEffects(async () => { await confirm.getByRole('button', { name: 'Cancel', exact: true }).click(); });
    await menu(captain, publication, 'archive'); confirm = captain.page.getByRole('dialog', { name: 'Archive announcement?', exact: true }); await confirm.getByRole('button', { name: 'Archive', exact: true }).click();
    await captain.page.getByText('Announcement archived.', { exact: true }).waitFor(); await announcements(captain); await menu(captain, publication, 'retract');
    const retract = captain.page.getByRole('dialog', { name: 'Retract announcement', exact: true });
    await noEffects(async () => { await retract.locator('[type=submit]').click(); await retract.getByText('Enter a reason for retraction.', { exact: true }).waitFor(); });
    await retract.locator('[name=reason]').fill('Fictional correction required.'); await retract.locator('[type=submit]').click(); await retract.waitFor({ state: 'detached' });
    assert.equal(state().announcements.find(row => row.id === publication).status, 'Retracted');
    const history = state().history.filter(row => row.announcement_id === publication); assert.deepEqual(history.map(row => row.action), ['Published', 'Edited', 'Archived', 'Retracted']); assert.equal(history.at(-1).reason, 'Fictional correction required.');
    assert.equal((await http(resident, 'announcements/' + publication)).status, 404);
  });
  await check('Original official list runs real expiry once; nonofficial/foreign mutations are denied with no effects', async () => {
    const id = await publish(secretary, 'Civic browser expiring publication'); cli('expire', String(id)); await announcements(secretary);
    assert.equal(state().announcements.find(row => row.id === id).status, 'Archived'); assert.equal(state().history.filter(row => row.announcement_id === id && row.action === 'Expired').length, 1);
    await noEffects(async () => { await announcements(secretary); });
    await noEffects(async () => {
      assert.equal((await http(resident, 'announcements', { method: 'POST', body: { title: 'Unauthorized', content: 'Rejected' } })).status, 403);
      assert.equal((await http(operator, 'feedback', { method: 'POST', body: { type: 'general', rating: 5, comment: 'Rejected' } })).status, 403);
      assert.equal((await http(foreign, 'announcements/' + id, { method: 'PATCH', body: { title: 'Foreign rejected', expected_revision: 2 } })).status, 404);
    });
  });
  await check('Same-role sign-in invalidates an already-open original civic form without a new HTTP write', async () => {
    await feedbackForm(resident, 'suggestion', 'Old session draft must remain unsent.'); let writes = 0; const watch = request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/feedback')) writes++; }; resident.page.on('request', watch);
    const fresh = await resident.context.newPage(); await fresh.goto(origin + '/frontend/resident-login.html');
    await fresh.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.logout(); }); await fresh.goto(origin + '/frontend/resident-login.html');
    await fresh.locator('#email').fill(resident.account.email); await fresh.locator('#password').fill(resident.account.password); await fresh.locator('#sign-in').click(); await fresh.waitForURL('**/resident-dashboard.html');
    await resident.page.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.refresh(); }); await fresh.close();
    await noEffects(async () => { await resident.page.locator('#submit-feedback').click(); await resident.page.getByText('Your session changed. Reopen the form.', { exact: true }).waitFor(); });
    assert.equal(writes, 0); resident.page.off('request', watch);
  });
  await check('General lifecycle original confirmations cancel without writes, then retry a lost committed review with one receipt', async () => {
    await selected(captain, 'general', general);
    await captain.page.locator('[data-review]:enabled').click();
    let dialog = captain.page.getByRole('dialog', { name: 'Mark feedback reviewed?', exact: true });
    await noEffects(async () => { await dialog.locator('[data-cancel]').click(); });
    const lost = await dropOnce(captain.page, `feedback/${general}/review`);
    await captain.page.locator('[data-review]:enabled').click();
    dialog = captain.page.getByRole('dialog', { name: 'Mark feedback reviewed?', exact: true });
    await dialog.locator('[data-confirm]').click(); await dialog.locator('[data-save-error]:visible').waitFor();
    const committed = state(), row = committed.feedback.find(r => r.id === general);
    assert.equal(row.reviewed_by, records.people.captain.id); assert.ok(row.reviewed_at); assert.equal(row.status, null); assert.equal(row.revision, 1);
    await dialog.locator('[data-confirm]').click(); await dialog.waitFor({ state: 'detached' });
    await captain.page.locator('[data-review]:disabled').waitFor(); await captain.page.waitForLoadState('networkidle');
    lost.assertRetry(); await lost.close(); assert.deepEqual(state().hashes, committed.hashes);
  });
  await check('General archive retains ratings/full comments and resident history, synchronizes active selection and rejects stale/wrong authority', async () => {
    await selected(captain, 'general', general); await selected(secretary, 'general', general);
    const summary = await secretary.page.locator('.official-feedback-stats').innerText(), original = state().feedback.find(r => r.id === general);
    await captain.page.locator('[data-archive]:enabled').click();
    const staleDialog = captain.page.getByRole('dialog', { name: 'Archive feedback?', exact: true });
    await secretary.page.locator('[data-archive]:enabled').click();
    const archive = secretary.page.getByRole('dialog', { name: 'Archive feedback?', exact: true });
    await archive.locator('[data-confirm]').click(); await archive.waitFor({ state: 'detached' });
    await secretary.page.locator(`[data-record="${general}"]`).waitFor({ state: 'detached' }); await secretary.page.waitForLoadState('networkidle');
    assert.equal(await secretary.page.locator('.official-feedback-stats').innerText(), summary);
    const saved = state().feedback.find(r => r.id === general);
    assert.equal(saved.archived_by, records.people.secretary.id); assert.equal(saved.rating, original.rating); assert.equal(saved.comment, original.comment); assert.equal(saved.status, null);
    await noEffects(async () => {
      const response = captain.page.waitForResponse(r => r.url().endsWith(`/feedback/${general}/archive`) && r.request().method() === 'POST');
      await staleDialog.locator('[data-confirm]').click(); assert.equal((await response).status(), 409); await staleDialog.locator('[data-save-error]:visible').waitFor();
      for (const who of [resident, operator]) assert.equal((await http(who, `feedback/${general}/archive`, { method: 'POST', body: { expected_revision: 2 } })).status, 403);
      assert.equal((await http(foreign, `feedback/${general}/review`, { method: 'POST', body: { expected_revision: 2 } })).status, 404);
      assert.equal((await http(resident, 'feedback', { query: { archive: 'all' } })).status, 403);
    });
    await staleDialog.locator('[data-cancel]').click();
    const ownHistory = (await http(resident, 'feedback')).data;
    assert.ok(ownHistory.some(r => r.id === general && r.comment === original.comment && r.rating === original.rating));
    const independent = await newFeedback(resident, 'general', 'Independent unreviewed archive preserves this full comment.');
    await selected(captain, 'general', independent); await captain.page.locator('[data-archive]:enabled').click();
    const unreviewed = captain.page.getByRole('dialog', { name: 'Archive feedback?', exact: true }); await unreviewed.locator('[data-confirm]').click(); await unreviewed.waitFor({ state: 'detached' });
    assert.equal(state().feedback.find(r => r.id === independent).reviewed_at, null);
    general = await newFeedback(resident, 'general', 'Secretary review and responsive layout full comment.');
    await selected(secretary, 'general', general); await secretary.page.locator('[data-review]:enabled').click();
    const reviewed = secretary.page.getByRole('dialog', { name: 'Mark feedback reviewed?', exact: true }); await reviewed.locator('[data-confirm]').click(); await reviewed.waitFor({ state: 'detached' });
    assert.equal(state().feedback.find(r => r.id === general).reviewed_by, records.people.secretary.id);
  });
  await check('Original general detail fits measured desktop/tablet/mobile widths and its category tab accepts focus', async () => {
    report.viewports = [];
    for (const width of [1440, 820, 390]) {
      await captain.page.setViewportSize({ width, height: 1080 }); await selected(captain, 'general', general);
      const measured = await captain.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.equal(measured.innerWidth, width); assert.ok(measured.scrollWidth <= width);
      await captain.page.getByRole('tab', { name: 'Suggestions', exact: true }).focus(); assert.equal(await captain.page.getByRole('tab', { name: 'Suggestions', exact: true }).evaluate(el => el === document.activeElement), true);
      await screenshot(captain.page, 'general-' + width); report.viewports.push(measured);
    }
  });
  report.hashes = state().hashes; report.passed = true;
} catch (error) {
  // No raw transport bodies/keys, fixture stdout, credentials, cookies or logs.
  report.error = error.code === 'ERR_ASSERTION' ? 'An acceptance assertion failed; inspect the named check in private local execution.' : 'Civic harness/page execution failed; inspect privately.';
  console.error(JSON.stringify({ failed: report.failed || 'setup', error: report.error })); process.exitCode = 1;
} finally {
  await browser?.close(); server.kill();
  await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
}
