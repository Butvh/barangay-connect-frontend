import assert from 'node:assert/strict';
import { workflowRuntime } from './workflow-runtime.mjs';

const qa = await workflowRuntime('integration-audit');
const { origin, records, check, guest, login, screenshot, cli } = qa;
let captain, resident, facilityId, incident;
async function data(who, path) {
  const response = await who.context.request.get(origin + '/api/v1/' + path);
  assert.equal(response.status(), 200); return (await response.json()).data;
}
try {
  await check('All five effective roles are refused by the wrong original portal without leaving a session', async () => {
    for (const role of ['resident', 'captain', 'secretary', 'responder', 'rescuer']) {
      const who = await guest(), account = records.people[role];
      await who.page.goto(origin + '/frontend/' + (role === 'resident' ? 'login.html' : 'resident-login.html'));
      await who.page.locator('#email').fill(account.email); await who.page.locator('#password').fill(account.password);
      await who.page.locator('#sign-in').click(); await who.page.locator('#login-error:visible').waitFor();
      assert.equal((await who.context.request.get(origin + '/api/v1/me')).status(), 401);
      await who.context.close();
    }
  });
  captain = await login('captain'); resident = await login('resident');
  await check('Fresh Sampaguita fixture supports original facility pinning, blank contact, and an accurate marker', async () => {
    const page = captain.page; await page.goto(origin + '/frontend/official-facilities.html'); await page.locator('[data-add]').click();
    const form = page.getByRole('dialog', { name: 'Add facility', exact: true });
    await form.locator('[name=name]').fill('Fictional audit shelter'); await form.locator('[name=type]').selectOption('EvacuationCenter');
    await form.locator('[name=address]').fill('Fictional audit road'); await form.locator('[name=capacity]').fill('300');
    await form.locator('[data-pin]').click(); const picker = page.getByRole('dialog', { name: 'Select facility location', exact: true });
    await picker.locator('.bc-map-viewport').focus(); await page.keyboard.press('Enter');
    await picker.getByRole('button', { name: 'Confirm location', exact: true }).click();
    assert.match(await form.locator('[data-pin-label]').innerText(), /^Location pinned · /);
    await screenshot(page, 'facility-pin-correct-text');
    await form.locator('[type=submit]').click(); await form.waitFor({ state: 'detached' });
    const row = (await data(captain, 'facilities')).find(row => row.name === 'Fictional audit shelter');
    assert.equal(row.capacity, 300); assert.equal(row.contact, ''); assert.equal(row.map_scope, 'sampaguita'); facilityId = row.id;
    await page.goto(origin + '/frontend/official-map.html?facility=' + facilityId);
    await page.locator(`[data-marker="facility-${facilityId}"]`).waitFor();
    assert.equal(await page.locator('[data-layer=complaints]').first().isDisabled(), false);
    await screenshot(page, 'captain-facility-marker');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await screenshot(page, 'captain-map-mobile');
  });
  await check('Resident receives a committed acknowledgement through the in-app worker and original notification page', async () => {
    await resident.page.goto(origin + '/frontend/resident-report.html'); await resident.page.locator('#send').click();
    await resident.page.waitForURL(url => url.searchParams.has('id')); incident = Number(new URL(resident.page.url()).searchParams.get('id'));
    await captain.page.setViewportSize({ width: 1440, height: 1080 });
    await captain.page.goto(origin + '/frontend/official-alert.html?id=' + incident);
    await captain.page.locator('[data-workflow=acknowledge]').click();
    const assign = captain.page.getByRole('dialog', { name: 'Assign responder', exact: true });
    await assign.locator(`[name=personnel_id][value="${records.people.responder.id}"]`).check();
    await assign.locator('[type=submit]').click(); await assign.waitFor({ state: 'detached' });
    cli('backend/artisan', 'notifications:deliver-demo', '--limit=100');
    const notifications = await data(resident, 'notifications');
    assert.ok(notifications.some(row => row.resource_id === incident));
    await resident.page.goto(origin + '/frontend/resident-notifications.html');
    await resident.page.getByText('A-' + incident, { exact: false }).first().waitFor();
    await screenshot(resident.page, 'resident-delivered-acknowledgement');
    const stranger = await login('otherResident');
    assert.ok(!(await data(stranger, 'notifications')).some(row => row.resource_id === incident));
  });
} finally { await qa.close(); }
