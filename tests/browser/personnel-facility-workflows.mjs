import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { workflowRuntime } from './workflow-runtime.mjs';

const qa = await workflowRuntime('personnel-facility-workflows');
const { origin, records, image, login, check, screenshot, cli } = qa;
const support = (...args) => JSON.parse(cli('backend/tests/Support/browser-administration-fixture.php', ...args));
let captain, resident, staff, tanod, facility, incident;
async function data(who, path) { const response = await who.context.request.get(origin + '/api/v1/' + path); assert.equal(response.status(), 200); return (await response.json()).data; }
async function select(who, role, target) {
  const dialog = who.page.getByRole('dialog', { name: 'Assign ' + role, exact: true });
  await dialog.locator(`[name=personnel_id][value="${target}"]`).check();
  await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
}
async function external(name) {
  const page = captain.page; await page.locator('[data-add]').click();
  const dialog = page.getByRole('dialog', { name: 'Add external personnel', exact: true });
  for (const [key, value] of Object.entries({ full_name: name, contact_number: '(02) 8000-0000', email: 'administration-qa-' + randomBytes(12).toString('hex') + '@example.invalid', address: '8 Mabini Street', emergency_contact: 'Fictional QA contact (02) 8000-0000' })) await dialog.locator(`[name=${key}]`).fill(value);
  await dialog.locator('[name=role]').selectOption('secretary'); await dialog.locator('[name=status]').selectOption('Inactive');
  await dialog.locator('[name=requirements]').setInputFiles({ name: 'appointment-requirement.png', mimeType: 'image/png', buffer: image });
  await dialog.locator('[type=submit]').click(); await page.getByRole('dialog', { name: 'Confirm appointment', exact: true }).getByRole('button', { name: 'Add personnel', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.cp-dialog-external[open]') || Boolean(document.querySelector('.cp-dialog-external [data-save-error]:not([hidden])')));
  const error = dialog.locator('[data-save-error]:visible');
  if (await error.count()) { await screenshot(page, 'external-appointment-error'); assert.fail(await error.innerText()); }
  await dialog.waitFor({ state: 'detached' });
  return (await data(captain, 'personnel')).records.find(row => row.full_name === name);
}
try {
  captain = await login('captain'); resident = await login('resident');
  const fixtures = support('prepare', String(records.people.captain.id)); tanod = fixtures.tanod_id;
  assert.equal(fixtures.map_available, true, 'Run this suite in its fresh dedicated browser schema; do not spoof map coverage.');
  await check('Original Captain external appointments upload real requirements and inactive positions still exhaust the Secretary capacity', async () => {
    await captain.page.goto(origin + '/frontend/captain-personnel.html'); await captain.page.locator('[data-add]:enabled').waitFor();
    staff = await external('Fictional QA inactive Secretary one'); const other = await external('Fictional QA inactive Secretary two');
    assert.equal(staff.status, 'Inactive'); assert.equal(other.status, 'Inactive'); assert.equal(staff.requirements.length, 1);
    assert.deepEqual((await data(captain, 'personnel')).capacities.secretary, { used: 3, limit: 3, available: 0 });
    await captain.page.locator('[data-add]').click(); const dialog = captain.page.getByRole('dialog', { name: 'Add external personnel', exact: true });
    assert.equal(await dialog.locator('[name=role] option[value=secretary]').isDisabled(), true);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    await screenshot(captain.page, 'inactive-capacity');
  });
  await check('Original fixed Tanod appointment, reassignment and removal preserve the roster and all three history records', async () => {
    const page = captain.page;
    await page.locator(`[data-appoint-row="${tanod}"]`).first().click();
    let dialog = page.getByRole('dialog', { name: 'Appoint from tanods', exact: true });
    await dialog.locator('[name=role]').selectOption('responder'); await dialog.locator('[type=submit]').click();
    await page.getByRole('dialog', { name: 'Confirm appointment', exact: true }).getByRole('button', { name: 'Confirm appointment', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.locator(`[data-reassign="${tanod}"]`).first().click(); dialog = page.getByRole('dialog', { name: 'Reassign role', exact: true });
    await dialog.locator('[name=role]').selectOption('rescuer'); await dialog.locator('[type=submit]').click();
    await page.getByRole('dialog', { name: 'Confirm reassignment', exact: true }).getByRole('button', { name: 'Save changes', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.locator(`[data-remove="${tanod}"]`).first().click(); dialog = page.getByRole('dialog', { name: 'Remove from role?', exact: true });
    await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' });
    const result = await data(captain, 'personnel/' + tanod);
    assert.equal(result.role, null); assert.equal(result.is_tanod, true); assert.equal(result.status, 'Unassigned');
    assert.deepEqual(result.history.map(row => row.action), ['Appointed', 'Reassigned', 'Removed']);
    await page.locator(`[data-view="${tanod}"]`).first().click(); await screenshot(page, 'tanod-retained-history'); await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  });
  await check('Original facility create retries one committed command and saves its actual map pin and immutable creation snapshot once', async () => {
    const page = captain.page, calls = []; let lose = true;
    await page.route('**/api/v1/facilities', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      calls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
      if (lose) { lose = false; const response = await route.fetch(); assert.equal(response.status(), 201); await response.dispose(); return route.abort('failed'); }
      return route.continue();
    });
    await page.goto(origin + '/frontend/official-facilities.html'); await page.locator('[data-add]').click();
    const dialog = page.getByRole('dialog', { name: 'Add facility', exact: true });
    await dialog.locator('[name=name]').fill('Fictional QA referral hospital'); await dialog.locator('[name=type]').selectOption('Hospital');
    await dialog.locator('[name=address]').fill('8 Mabini Street'); await dialog.locator('[name=contact]').fill('(02) 8000-0000');
    await dialog.locator('[name=status][value=Active]').check();
    await dialog.locator('[data-pin]').click(); const map = page.getByRole('dialog', { name: 'Select facility location', exact: true });
    await map.locator('.bc-map-viewport').focus(); await page.keyboard.press('Enter'); await map.getByRole('button', { name: 'Confirm location', exact: true }).click();
    await dialog.locator('[type=submit]').click(); await dialog.locator('[data-form-error]:visible').waitFor();
    await dialog.locator('[type=submit]').click(); await dialog.waitFor({ state: 'detached' }); await page.unroute('**/api/v1/facilities');
    assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
    const rows = (await data(captain, 'facilities')).filter(row => row.name === 'Fictional QA referral hospital'); assert.equal(rows.length, 1); facility = rows[0];
    assert.equal(facility.history.length, 1); assert.equal(facility.history[0].action, 'Created'); assert.equal(Number(facility.map_x), 50); assert.equal(Number(facility.map_y), 50);
  });
  await check('Original facility edit, deactivate and reactivate retain each saved display snapshot and actor', async () => {
    const page = captain.page;
    await page.locator(`[data-menu="${facility.id}"]`).click(); await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit facility', exact: true });
    await dialog.locator('[name=name]').fill('Fictional QA updated hospital'); await dialog.locator('[name=notes]').fill('Private local acceptance fixture');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Fictional QA updated hospital', exact: true }).waitFor();
    for (const action of ['Deactivate', 'Reactivate']) {
      await page.locator(`[data-menu="${facility.id}"]`).click(); await page.getByRole('menuitem', { name: action, exact: true }).click();
      await page.getByRole('dialog', { name: action + ' facility?', exact: true }).getByRole('button', { name: action + ' facility', exact: true }).click();
      await page.getByText(action === 'Deactivate' ? 'Facility deactivated. Its information has been retained.' : 'Facility reactivated. It is available for new assignments.', { exact: true }).waitFor();
    }
    facility = await data(captain, 'facilities/' + facility.id);
    assert.deepEqual(facility.history.map(row => row.action), ['Created', 'Edited', 'Deactivated', 'Reactivated']);
    assert.equal(facility.history[0].snapshot.name, 'Fictional QA referral hospital'); assert.equal(facility.history[1].snapshot.name, 'Fictional QA updated hospital');
    assert.ok(facility.history.every(row => row.by_name === 'Fictional QA captain' && Number.isFinite(Date.parse(row.at))));
    await page.locator(`[data-view="${facility.id}"]`).click(); const detail = page.getByRole('dialog', { name: 'Facility details', exact: true });
    assert.equal(await detail.locator('details').count(), 4); await detail.locator('details').nth(1).locator('summary').click();
    await screenshot(page, 'facility-saved-history'); await detail.getByRole('button', { name: 'Done', exact: true }).click();
  });
  await check('The original shared referral directory exposes read-only facilities without foreign management controls or history', async () => {
    const page = captain.page, id = fixtures.shared_facility_id;
    const row = await data(captain, 'facilities/' + id); assert.equal(row.can_manage, false); assert.deepEqual(row.history ?? [], []);
    assert.equal(await page.locator(`[data-menu="${id}"]`).count(), 0);
    await page.locator(`[data-view="${id}"]`).click(); const dialog = page.getByRole('dialog', { name: 'Facility details', exact: true });
    assert.equal(await dialog.getByRole('heading', { name: 'Facility history', exact: true }).count(), 0);
    await screenshot(page, 'shared-referral-read-only'); await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  });
  await check('A real original SOS and dispatch make the assigned responder unavailable for role removal', async () => {
    const page = resident.page; await page.goto(origin + '/frontend/resident-report.html'); await page.locator('#send').click(); await page.waitForURL(url => url.searchParams.has('id'));
    incident = Number(new URL(page.url()).searchParams.get('id'));
    await captain.page.goto(origin + '/frontend/official-alert.html?id=' + incident); await captain.page.locator('[data-workflow=acknowledge]').click(); await select(captain, 'responder', records.people.responder.id);
    await captain.page.goto(origin + '/frontend/captain-personnel.html'); await captain.page.locator(`[data-remove="${records.people.responder.id}"]`).first().click();
    const dialog = captain.page.getByRole('dialog', { name: 'Remove from role?', exact: true });
    await dialog.getByText('This person is assigned to unresolved incidents. Complete, reassign, or cancel these responsibilities before changing the role.', { exact: true }).waitFor();
    assert.equal(await dialog.locator('[type=submit]').isDisabled(), true);
    assert.equal((await data(captain, 'personnel/' + records.people.responder.id)).role, 'responder');
    await screenshot(captain.page, 'busy-role-denial'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
  await check('Original Captain reports show the recorded incident and administrative actors without inventing absent times', async () => {
    const page = captain.page; await page.goto(origin + '/frontend/captain-reports.html?view=all');
    await page.locator(`[data-report="${incident}"]`).waitFor(); assert.equal(await page.locator(`[data-report="${incident}"]`).count(), 1);
    await page.goto(origin + '/frontend/captain-reports.html?view=activity'); await page.locator('[data-activity]').first().waitFor();
    const text = await page.locator('main').innerText(); assert.ok(text.includes('Fictional QA captain')); assert.ok(text.includes('Earlier actions without a recorded actor or timestamp are not reconstructed.'));
    await screenshot(page, 'captain-recorded-reports');
    await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await screenshot(page, 'captain-reports-mobile');
  });
} finally { await qa.close(); }
