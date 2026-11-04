import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { workflowRuntime } from './workflow-runtime.mjs';

const qa = await workflowRuntime('administration-workflows');
const { origin, image, login, guest, check, screenshot } = qa;
const payload = name => ({ name, mimeType: 'image/png', buffer: image });
const credentials = { email: 'administration-qa-' + randomBytes(12).toString('hex') + '@example.invalid', password: 'Qa' + randomBytes(18).toString('hex') + '7' };
let applicant, verification, captain, secretary;
async function data(who, path) { const response = await who.context.request.get(origin + '/api/v1/' + path); assert.equal(response.status(), 200); return (await response.json()).data; }
async function review(state, reason = '') {
  await secretary.page.goto(origin + '/frontend/official-verification.html?id=' + verification.id);
  await secretary.page.locator('#rejection-reason:enabled').waitFor();
  await secretary.page.locator('#rejection-reason').fill(reason);
  await secretary.page.locator(state === 'Approved' ? '[data-approve]' : '[data-request-resubmission]').click();
  if (state !== 'Approved') await secretary.page.getByRole('dialog').getByRole('button', { name: 'Confirm request', exact: true }).click();
  await secretary.page.waitForURL('**/official-verifications.html*');
}
try {
  captain = await login('captain'); secretary = await login('secretary');
  await check('Guest registration retries its committed lost reply, signs in, and uploads actual private documents once', async () => {
    applicant = await guest(); const page = applicant.page, area = (await data(captain, 'me')).barangay_id;
    const requests = []; let lose = true;
    await page.route('**/api/v1/auth/register', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
      if (lose) { lose = false; const response = await route.fetch(); assert.equal(response.status(), 201); await response.dispose(); return route.abort('failed'); }
      return route.continue();
    });
    await page.goto(origin + '/frontend/register.html'); await page.locator(`[data-barangay="${area}"]`).click();
    for (const [name, value] of Object.entries({ full_name: 'Fictional QA applicant', email: credentials.email, contact_number: '(02) 8000-0000', password: credentials.password, household_address: '14 Riverside Street' })) await page.locator('#' + name).fill(value);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('#valid-id').setInputFiles(payload('valid-id.png')); await page.locator('#proof').setInputFiles(payload('proof-of-residence.png'));
    await page.locator('#submit-documents').click();
    await page.getByText('Unable to reach the server. Check your connection and try again.', { exact: true }).waitFor();
    await page.locator('#submit-documents').click(); await page.waitForURL('**/resident-verification.html');
    await page.getByRole('heading', { name: 'Documents under review', exact: true }).waitFor();
    assert.equal(requests.length, 2); assert.ok(requests[0].key === requests[1].key && requests[0].body === requests[1].body, 'Original registration command changed during retry.');
    await page.unroute('**/api/v1/auth/register');
    verification = (await data(applicant, 'verifications'))[0]; assert.equal(verification.review_status, 'Pending');
    await screenshot(page, 'registration-pending');
  });
  await check('Original correction/resubmission preserves its application and real private history before approval', async () => {
    const id = verification.id; await review('Resubmission requested', 'Please provide a clearer proof of residence.');
    await applicant.page.goto(origin + '/frontend/resident-verification.html');
    await applicant.page.getByRole('link', { name: 'Resubmit documents', exact: true }).click();
    await applicant.page.locator('#valid-id').setInputFiles(payload('corrected-id.png')); await applicant.page.locator('#proof').setInputFiles(payload('corrected-proof.png'));
    await applicant.page.locator('#submit-documents').click(); await applicant.page.waitForURL('**/resident-verification.html');
    verification = (await data(applicant, 'verifications'))[0]; assert.equal(verification.id, id); assert.equal(verification.review_status, 'Pending');
    await review('Approved');
    await applicant.page.goto(origin + '/frontend/resident-verification.html');
    await applicant.page.getByRole('heading', { name: 'Your residency is verified', exact: true }).waitFor();
    await screenshot(applicant.page, 'verification-approved');
  });
  await check('Original resident profile and password change persist actual values and permit only the new credential', async () => {
    const page = applicant.page; await page.goto(origin + '/frontend/resident-profile.html'); await page.locator('#profile-full_name').waitFor();
    await page.locator('#profile-full_name').fill('Fictional QA updated resident'); await page.locator('[data-save-profile]:visible').click();
    await page.locator('#profile-saved:visible').waitFor(); assert.equal((await data(applicant, 'profile')).full_name, 'Fictional QA updated resident');
    await page.locator('[data-change-password]:visible').click(); const modal = page.getByRole('dialog');
    const next = 'Qa' + randomBytes(18).toString('hex') + '9';
    await modal.locator('[name=current_password]').fill(credentials.password); await modal.locator('[name=password]').fill(next); await modal.locator('[name=password_confirmation]').fill(next);
    await modal.locator('[data-update]').click(); await modal.waitFor({ state: 'detached' }); credentials.password = next;
    const fresh = await guest(); await fresh.page.goto(origin + '/frontend/resident-login.html'); await fresh.page.locator('#email').fill(credentials.email); await fresh.page.locator('#password').fill(next); await fresh.page.locator('#sign-in').click();
    await fresh.page.waitForURL('**/resident-dashboard.html'); await fresh.context.close();
    await screenshot(page, 'profile-persisted');
  });
  await check('Original purpose-specific consent is explicit, self-only, revision guarded and revocable', async () => {
    const second = await login('captain');
    for (const who of [captain, second]) { await who.page.goto(origin + '/frontend/official-profile.html'); await who.page.getByText('SMS not enabled for this purpose.', { exact: true }).first().waitFor(); }
    const form = who => who.page.getByRole('form', { name: 'New alerts awaiting review SMS preference', exact: true });
    await form(captain).locator('[name=consent]').check(); await form(captain).getByRole('button', { name: 'Save preference', exact: true }).click();
    await form(captain).getByText('SMS allowed for this purpose.', { exact: true }).waitFor();
    const other = await data(captain, 'me/notification-preferences/barangay_announcements'); assert.equal(other.state, 'not_granted');
    await form(second).locator('[name=consent]').check(); await form(second).getByRole('button', { name: 'Save preference', exact: true }).click();
    await form(second).locator('[data-error]:visible').waitFor(); assert.equal((await data(captain, 'me/notification-preferences/incident_review')).revision, 1);
    await form(captain).locator('[name=consent]').uncheck(); await form(captain).getByRole('button', { name: 'Save preference', exact: true }).click();
    await form(captain).getByText('SMS permission withdrawn.', { exact: true }).waitFor();
    assert.equal((await data(captain, 'me/notification-preferences/incident_review')).state, 'revoked');
    await captain.page.setViewportSize({ width: 390, height: 844 }); await screenshot(captain.page, 'consent-mobile'); await second.context.close();
  });
} finally { await qa.close(); }
