import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workflowRuntime } from './workflow-runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inbox = resolve(root, 'backend/storage/app/private/recovery-mail-test-' + randomBytes(8).toString('hex') + '.eml');
const sink = spawn(process.execPath, ['tests/Support/local-smtp-sink.mjs', inbox], { cwd: resolve(root, 'backend'), env: { ...process.env, P1_SMTP_FIXTURE_MS: '120000' }, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
const mailPort = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Fictional loopback SMTP sink did not start.')), 10000);
  sink.once('error', reject); sink.once('exit', () => reject(new Error('Private SMTP fixture exited before readiness.')));
  sink.stdout.once('data', chunk => { clearTimeout(timer); resolve(JSON.parse(String(chunk)).port); });
});
let qa;
try {
  qa = await workflowRuntime('expiry-recovery-workflows', { localMailPort: mailPort });
  const { origin, guest, login, check, cli, image, screenshot } = qa;
  const credentials = { email: 'administration-qa-' + randomBytes(12).toString('hex') + '@example.invalid', password: 'Qa' + randomBytes(18).toString('hex') + '7' };
  const secretary = await login('secretary'), captain = await login('captain'), applicant = await guest();
  const data = async (who, path) => { const r = await who.context.request.get(origin + '/api/v1/' + path); assert.equal(r.status(), 200); return (await r.json()).data; };
  const files = async page => {
    await page.locator('#valid-id').setInputFiles({ name: 'valid-id.png', mimeType: 'image/png', buffer: image });
    await page.locator('#proof').setInputFiles({ name: 'proof-of-residence.png', mimeType: 'image/png', buffer: image });
    await page.locator('#submit-documents').click(); await page.waitForURL('**/resident-verification.html');
  };
  const area = (await data(captain, 'me')).barangay_id;
  await applicant.page.goto(origin + '/frontend/register.html'); await applicant.page.locator(`[data-barangay="${area}"]`).click();
  for (const [name, value] of Object.entries({ full_name: 'Fictional QA recovery applicant', email: credentials.email, contact_number: '(02) 8000-0000', password: credentials.password, household_address: '14 Riverside Street' })) await applicant.page.locator('#' + name).fill(value);
  await applicant.page.getByRole('button', { name: 'Continue', exact: true }).click(); await files(applicant.page);
  await check('Original password recovery receives an actual encrypted-job code through fictional loopback SMTP, resets without login and revokes the prior session', async () => {
    const recovery = await guest(), page = recovery.page; await page.goto(origin + '/frontend/resident-login.html');
    await page.locator('#email').fill(credentials.email); await page.locator('[data-forgot-password]').click();
    const request = page.waitForResponse(response => response.url().endsWith('/api/v1/password-recovery/requests') && response.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: 'Send reset code', exact: true }).click();
    const response = await request; assert.equal(response.status(), 200); const challenge = (await response.json()).data.challenge_id;
    const delivered = JSON.parse(cli('backend/tests/Support/browser-administration-fixture.php', 'deliver-recovery', challenge)); assert.equal(delivered.delivered_to_fictional_loopback_sink, true);
    const message = (await readFile(inbox, 'utf8')).replace(/=\r?\n/g, '').replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    const code = message.match(/verification code is (\d{6})\./)?.[1]; assert.ok(code, 'The private fictional inbox did not contain the actual recovery code.');
    for (let i = 0; i < 6; i++) await page.locator(`[data-code-digit="${i}"]`).fill(code[i]);
    await page.getByRole('dialog').getByRole('button', { name: 'Verify code', exact: true }).click();
    const next = 'Qa' + randomBytes(18).toString('hex') + '9';
    await page.locator('#recovery-password').fill(next); await page.locator('#recovery-password_confirmation').fill(next);
    await page.getByRole('dialog').getByRole('button', { name: 'Reset password', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal((await recovery.context.request.get(origin + '/api/v1/me')).status(), 401); assert.equal((await applicant.context.request.get(origin + '/api/v1/me')).status(), 401);
    await page.locator('#password').fill(next); await page.locator('#sign-in').click(); await page.waitForURL('**/resident-dashboard.html'); credentials.password = next;
    await screenshot(page, 'recovery-fresh-sign-in'); await recovery.context.close();
    // Reauthenticate the original application tab with the new credential.
    await applicant.page.goto(origin + '/frontend/resident-login.html'); await applicant.page.locator('#email').fill(credentials.email); await applicant.page.locator('#password').fill(next); await applicant.page.locator('#sign-in').click(); await applicant.page.waitForURL('**/resident-dashboard.html');
  });
  await check('An elapsed verification rejects the open approval and original reapplication creates a new window while retaining the expired application history', async () => {
    const old = (await data(applicant, 'verifications'))[0], page = secretary.page;
    await page.goto(origin + '/frontend/official-verification.html?id=' + old.id); await page.locator('[data-approve]:enabled').waitFor();
    JSON.parse(cli('backend/tests/Support/browser-administration-fixture.php', 'elapse-verification', String(old.id)));
    const decision = page.waitForResponse(response => response.url().endsWith('/verifications/' + old.id + '/decisions'));
    await page.locator('[data-approve]').click(); assert.equal((await decision).status(), 409);
    await applicant.page.goto(origin + '/frontend/resident-verification.html'); await applicant.page.getByRole('heading', { name: 'Your verification window has expired', exact: true }).waitFor();
    await applicant.page.getByRole('link', { name: 'Resubmit', exact: true }).click();
    await files(applicant.page); await applicant.page.getByRole('heading', { name: 'Documents under review', exact: true }).waitFor();
    const latest = (await data(applicant, 'verifications'))[0], retained = await data(applicant, 'verifications/' + old.id);
    assert.notEqual(latest.id, old.id); assert.equal(retained.review_status, 'Expired');
    assert.ok(retained.history.some(row => row.action === 'Expired')); assert.ok(Date.parse(latest.deadline_at) > Date.now());
    await applicant.page.setViewportSize({ width: 390, height: 844 }); await screenshot(applicant.page, 'verification-new-window-mobile');
  });
} finally { await qa?.close(); sink.kill(); }
