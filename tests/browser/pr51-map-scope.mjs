import assert from 'node:assert/strict';
import { workflowRuntime } from './workflow-runtime.mjs';

// Regression preparation: real original pages, shared transport, Laravel and MySQL.
const qa = await workflowRuntime('pr-one-map-scope');
const { records, origin, cli, login, check, screenshot } = qa;
const failures = [];
async function scenario(label, run) {
  try { await check(label, run); }
  catch (error) { failures.push({ label, error: error.message }); console.error('FAIL map contract: ' + label + ': ' + error.message); }
}
function coverage(user, mode) {
  return JSON.parse(cli('backend/tests/Support/browser-pr51-map-fixture.php', String(user.id), mode));
}
async function reference(who) {
  const response = await who.context.request.get(origin + '/api/v1/references/barangays');
  assert.equal(response.status(), 200);
  return (await response.json()).data[0];
}
try {
  const firstCaptain = await login('captain');
  const firstScope = await reference(firstCaptain);
  // This fresh database's first scope is genuinely ID1; never reuse retained data.
  assert.equal(firstScope.id, 1, 'Run this browser entry on a new, empty disposable schema.');
  for (const mode of ['missing', 'unknown']) await scenario(`ID1 with ${mode} coverage never displays Sampaguita artwork`, async () => {
    coverage(records.people.captain, mode);
    await firstCaptain.page.goto(origin + '/frontend/official-map.html');
    await firstCaptain.page.waitForLoadState('networkidle');
    await screenshot(firstCaptain.page, 'id-one-' + mode + '-coverage');
    await firstCaptain.page.locator('#monitor-map').getByText('Map coverage is not available yet', { exact: true }).waitFor({ timeout: 4000 });
    assert.equal(await firstCaptain.page.locator('.bc-map-image').count(), 0);
  });
  coverage(records.people.captain, 'supported');
  // Generate another actual tenant/role set; the supported artwork must work at non-1 IDs.
  Object.assign(records, JSON.parse(cli('backend/tests/Support/browser-operational-fixture.php')));
  for (const role of ['captain', 'secretary']) await scenario(`${role} can pin and edit a declared non-1 map without losing form intent`, async () => {
    const who = await login(role), page = who.page, area = await reference(who);
    assert.notEqual(area.id, 1); assert.equal(area.map_scope, 'sampaguita');
    await page.goto(origin + '/frontend/official-facilities.html'); await page.locator('[data-add]').click();
    const form = page.getByRole('dialog', { name: 'Add facility', exact: true });
    await form.locator('[name=name]').fill('Fictional PR51 ' + role + ' hospital');
    await form.locator('[name=type]').selectOption('Hospital');
    await form.locator('[name=address]').fill('Fictional PR51 street');
    await screenshot(page, role + '-non-one-form');
    assert.equal(await form.locator('[data-pin]').isEnabled(), true);
    await form.locator('[data-pin]').click();
    const picker = page.getByRole('dialog', { name: 'Select facility location', exact: true });
    await picker.locator('.bc-map-viewport').focus(); await page.keyboard.press('Enter');
    await picker.locator('[data-marker="draft-facility"]').focus(); await page.keyboard.press('ArrowLeft');
    await picker.getByRole('button', { name: 'Confirm location', exact: true }).click();
    assert.match(await form.locator('[data-pin-label]').innerText(), /^Location pinned · /);
    await form.locator('[type=submit]').click(); await form.waitFor({ state: 'detached' });
    const response = await who.context.request.get(origin + '/api/v1/facilities');
    assert.equal(response.status(), 200);
    const row = (await response.json()).data.find(value => value.name === 'Fictional PR51 ' + role + ' hospital');
    assert.ok(row); assert.equal(row.map_scope, 'sampaguita'); assert.ok(row.map_x >= 0 && row.map_y <= 100);
    await page.goto(origin + '/frontend/official-map.html?facility=' + row.id);
    await page.locator('[data-marker="facility-' + row.id + '"]').waitFor();
    for (const width of [1920, 768, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await screenshot(page, role + '-map-' + width);
    }
  });
  for (const role of ['resident', 'responder', 'rescuer']) await scenario(`${role} reads declared non-1 coverage through the actual page`, async () => {
    const who = await login(role), page = who.page;
    assert.notEqual((await reference(who)).id, 1);
    await page.goto(origin + '/frontend/' + (role === 'resident' ? 'resident-map.html' : 'official-map.html'));
    await page.waitForLoadState('networkidle');
    await screenshot(page, role + '-declared-non-one');
    await page.locator('.bc-map-image').waitFor({ timeout: 4000 });
  });
  qa.report.failures = failures;
  assert.deepEqual(failures, [], 'Map-scope regression failures remain; no changed-candidate acceptance is claimed.');
} finally { await qa.close(); }
