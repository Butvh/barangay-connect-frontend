import assert from 'node:assert/strict';
import { workflowRuntime } from '../../../tests/browser/workflow-runtime.mjs';

// Actual P1 harness/services and original UI; no domain/auth/DOM substitutes.
const qa = await workflowRuntime('p-two-opening-session', { photoTest: true });
try {
  const who = await qa.login('resident'), page = who.page;
  await qa.check('Same-role login before first click denies the old form; a reopened form saves and decodes its private resident gallery', async () => {
    await page.goto(qa.origin + '/frontend/resident-report.html'); await page.locator('#send').click();
    await page.waitForURL(url => url.searchParams.has('id'));
    const id = Number(new URL(page.url()).searchParams.get('id'));
    await page.locator('#add-details').click(); await page.locator('#details').waitFor();
    await page.locator('#description').fill('Old opening-session draft');
    await page.locator('#photo').setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: qa.image });
    const before = JSON.parse(qa.cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id)));
    let uploads = 0, patches = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/v1/incident-photos')) uploads++; if (request.method() === 'PATCH' && request.url().endsWith('/alerts/' + id)) patches++; });
    const fresh = await who.context.newPage(); await fresh.goto(qa.origin + '/frontend/resident-login.html');
    await fresh.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.logout(); });
    await fresh.goto(qa.origin + '/frontend/resident-login.html'); await fresh.locator('#email').fill(who.account.email); await fresh.locator('#password').fill(who.account.password); await fresh.locator('#sign-in').click(); await fresh.waitForURL('**/resident-dashboard.html');
    await page.evaluate(async () => { const { Auth } = await import('/frontend/assets/js/core/auth.js'); await Auth.refresh(); }); await fresh.close();
    await page.locator('#submit-details').click(); await page.getByText('Your session changed. Reopen the form.', { exact: true }).waitFor();
    const denied = JSON.parse(qa.cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id)));
    assert.equal(uploads, 0); assert.equal(patches, 0); assert.equal(denied.revision, before.revision); assert.equal(denied.description, before.description);
    await page.goto(qa.origin + '/frontend/resident-report.html?step=details&id=' + id); await page.locator('#details').waitFor();
    await page.locator('#description').fill('Fresh reopened-session draft');
    await page.locator('#photo').setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: qa.image });
    await page.locator('#submit-details').click(); await page.waitForURL('**/resident-alert.html?id=' + id);
    assert.equal(uploads, 1); assert.equal(patches, 1);
    const saved = JSON.parse(qa.cli('backend/tests/Support/browser-operational-fixture.php', 'inspect', String(id)));
    assert.equal(saved.revision, before.revision + 1); assert.equal(saved.description, 'Fresh reopened-session draft');
    const image = page.locator('.incident-photo-grid img'); await image.waitFor();
    assert.equal(await image.evaluate(async image => { await image.decode(); return image.complete && image.naturalWidth > 0; }), true);
    const href = await page.locator('.incident-photo-grid a').getAttribute('href'); assert.match(href, /^\/api\/v1\/incident-photos\/[1-9][0-9]*\/download$/);
    assert.equal((await who.context.request.get(qa.origin + href)).status(), 200);
    await qa.screenshot(page, 'reopened-resident-gallery');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await qa.screenshot(page, 'resident-gallery-mobile');
    qa.report.openingAndReopen = { deniedUploads: 0, deniedPatches: 0, originalRevision: before.revision, deniedRevision: denied.revision, reopenedRevision: saved.revision, galleryDecoded: true, downloadStatus: 200 };
  });
} finally { await qa.close(); }
