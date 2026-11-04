import assert from 'node:assert/strict';
import { workflowRuntime } from './workflow-runtime.mjs';

const qa = await workflowRuntime('photo-workflows', { photoTest: true });
const { origin, image, login, check, screenshot, cli, records, report } = qa;
async function details(who) {
  const page = who.page; await page.goto(origin + '/frontend/resident-report.html'); await page.locator('#send').click();
  await page.waitForURL(url => url.searchParams.has('id')); const id = Number(new URL(page.url()).searchParams.get('id'));
  await page.locator('#add-details').click(); await page.locator('#details').waitFor();
  await page.locator('[data-type=Flood]').click(); await page.locator('#description').fill('Fictional private photo workflow');
  await page.locator('#photo').setInputFiles({ name: 'private-incident.png', mimeType: 'image/png', buffer: image });
  return id;
}
async function photo(who, id) {
  const response = await who.context.request.get(origin + '/api/v1/incident-photos/references/' + id); assert.equal(response.status(), 200);
  const rows = (await response.json()).data; assert.equal(rows.length, 1); assert.deepEqual(Object.keys(rows[0]).sort(), ['bytes', 'id', 'mime']); return rows[0];
}
let resident, secretary, captain, replacement, responder, other;
try {
  resident = await login('resident'); secretary = await login('secretary'); captain = await login('captain'); responder = await login('responder'); replacement = await login('replacement'); other = await login('otherResident');
  let id, metadata;
  await check('Original details stage actual bytes once and replay a committed lost details reply with one original body and private metadata reference', async () => {
    let uploads = 0, lose = true; const calls = [];
    resident.page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/incident-photos')) uploads++; });
    await resident.page.route('**/api/v1/alerts/*', async route => {
      if (route.request().method() !== 'PATCH') return route.continue();
      calls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
      if (lose) { lose = false; const response = await route.fetch(); assert.equal(response.status(), 200); await response.dispose(); return route.abort('failed'); }
      return route.continue();
    });
    id = await details(resident); assert.equal(uploads, 0, 'Immediate SOS must not stage a photo.');
    const stale = await resident.context.newPage(); await stale.goto(origin + '/frontend/resident-report.html?step=details&id=' + id); await stale.locator('#details').waitFor();
    await stale.locator('#description').fill('Rejected stale original browser draft');
    await resident.page.locator('#submit-details').click(); await resident.page.getByText('Unable to reach the server. Check your connection and try again.', { exact: true }).waitFor();
    await resident.page.locator('#submit-details').click(); await resident.page.waitForURL('**/resident-alert.html?id=' + id);
    assert.equal(uploads, 1); assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); metadata = await photo(resident, id);
    const staleReply = stale.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/alerts/' + id));
    await stale.locator('#submit-details').click(); assert.equal((await staleReply).status(), 409);
    assert.equal(await stale.locator('#description').inputValue(), 'Rejected stale original browser draft');
    assert.equal(JSON.parse(cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id))).description, 'Fictional private photo workflow');
    await screenshot(stale, 'stale-original-photo-details'); await stale.close();
    assert.equal((await resident.context.request.get(origin + '/api/v1/incident-photos/' + metadata.id + '/download')).status(), 200);
    assert.equal((await other.context.request.get(origin + '/api/v1/incident-photos/' + metadata.id + '/download')).status(), 404);
    await secretary.page.goto(origin + '/frontend/official-alert.html?id=' + id);
    const gallery = secretary.page.locator('.incident-photo-grid img'); await gallery.waitFor(); await gallery.scrollIntoViewIfNeeded();
    assert.equal(await gallery.evaluate(async image => { await image.decode(); return image.complete && image.naturalWidth > 0; }), true);
    await screenshot(secretary.page, 'authorized-photo-gallery');
    report.residentGalleryPresent = await resident.page.locator('.incident-photo-grid img').count() > 0;
  });
  await check('Photo bytes follow current assignment on transfer and remain owner/admin history after explicit resolution', async () => {
    const page = captain.page; await page.goto(origin + '/frontend/official-alert.html?id=' + id); await page.locator('[data-workflow=acknowledge]').click();
    let dialog = page.getByRole('dialog', { name: 'Assign responder', exact: true }); await dialog.locator(`[name=personnel_id][value="${records.people.responder.id}"]`).check(); await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
    const url = origin + '/api/v1/incident-photos/' + metadata.id + '/download'; assert.equal((await responder.context.request.get(url)).status(), 200);
    await page.locator('[data-reassign=responder]').click(); dialog = page.getByRole('dialog', { name: 'Reassign responder', exact: true });
    await dialog.locator(`[name=personnel_id][value="${records.people.replacement.id}"]`).check(); await dialog.locator('[name=reason]').fill('Fictional shift replacement'); await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
    assert.equal((await responder.context.request.get(url)).status(), 404); assert.equal((await replacement.context.request.get(url)).status(), 200);
    await replacement.page.goto(origin + '/frontend/official-alert.html?id=' + id); await replacement.page.locator('[data-workflow=logResponse]').click(); dialog = replacement.page.getByRole('dialog', { name: 'Log response', exact: true });
    await dialog.locator('[name=response_type]').selectOption('Assessment'); await dialog.locator('[name=rescue_required]').selectOption('No'); await dialog.locator('[name=response_status]').selectOption('Completed'); await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
    await page.goto(origin + '/frontend/official-alert.html?id=' + id); await page.locator('[data-workflow=resolve]').click(); await page.getByRole('dialog', { name: 'Resolve alert?', exact: true }).getByRole('button', { name: 'Resolve', exact: true }).click(); await page.getByText('This alert is resolved.', { exact: true }).waitFor();
    assert.equal((await replacement.context.request.get(url)).status(), 404); assert.equal((await resident.context.request.get(url)).status(), 200); assert.equal((await secretary.context.request.get(url)).status(), 200);
    await screenshot(page, 'resolved-private-photo-history');
  });
  await check('A details form opened before same-account reauthentication cannot adopt its new observation while a staged upload reply is pending', async () => {
    const id = await details(other), page = other.page;
    const before = JSON.parse(cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id)));
    let release, staged, stageError, patches = 0, settled;
    const uploaded = new Promise(resolve => staged = resolve), gate = new Promise(resolve => release = resolve);
    const patchDone = new Promise(resolve => settled = resolve);
    await page.route('**/api/v1/incident-photos', async route => {
      try {
        const response = await route.fetch(); assert.equal(response.status(), 201);
        // route.fetch has already applied these real response cookies to this
        // context. Delay only the body; do not replay an old Set-Cookie header
        // a second time after the subsequent real login has rotated it.
        const headers = { ...response.headers() }; delete headers['set-cookie'];
        staged(); await gate; await route.fulfill({ response, headers });
      }
      catch (error) { stageError = error; staged(); await route.abort(); }
    });
    page.on('request', request => { if (request.method() === 'PATCH' && request.url().endsWith('/alerts/' + id)) patches++; });
    page.on('response', async response => { if (response.request().method() === 'PATCH' && response.url().endsWith('/alerts/' + id)) { await response.finished(); settled({ status: response.status() }); } });
    page.on('requestfailed', request => { if (request.method() === 'PATCH' && request.url().endsWith('/alerts/' + id)) settled({ requestFailed: true }); });
    await page.locator('#submit-details').click(); await uploaded; if (stageError) throw stageError;
    try {
      const fresh = await other.context.newPage(); await fresh.goto(origin + '/frontend/resident-login.html');
      // The real login form intentionally redirects an already hydrated session;
      // explicitly sign out first, then reauthenticate in this same cookie jar.
      await fresh.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.logout(); });
      await fresh.goto(origin + '/frontend/resident-login.html'); await fresh.locator('#email').fill(records.people.otherResident.email); await fresh.locator('#password').fill(records.people.otherResident.password); await fresh.locator('#sign-in').click(); await fresh.waitForURL('**/resident-dashboard.html');
      await page.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.refresh(); });
      await fresh.close();
    } finally { release(); }
    await page.waitForFunction(() => !document.querySelector('#submit-details') || !document.querySelector('#submit-details').disabled);
    const patchOutcome = patches ? await patchDone : null;
    const after = JSON.parse(cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id)));
    report.sameRoleObservationEvidence = { patchRequests: patches, patchOutcome, originalRevision: before.revision, savedRevision: after.revision, descriptionChanged: before.description !== after.description };
    await screenshot(page, 'same-role-staged-reply'); assert.equal(patches, 0, 'An old photo form must not prepare a fresh details command after same-role reauthentication.'); assert.equal(after.revision, before.revision);
  });
} finally { await qa.close(); }
