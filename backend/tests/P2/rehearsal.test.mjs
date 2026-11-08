import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import vm from 'node:vm';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const { rehearsalPlan } = await import('./rehearsal.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
// Orchestration input fixtures only; these are not domain/auth/service acceptance.
const pins = { p1: '1'.repeat(40), dba: '2'.repeat(40), p2: '3'.repeat(40) };
const manifest = { ...pins, dirty: false, p1Hashes: { 'scripts/check.mjs': 'a'.repeat(64) },
  ownerHashes: { dba: { 'backend/app/Models/Barangay.php': 'b'.repeat(64) }, p2: { 'backend/tests/P2/sql.php': 'c'.repeat(64) } } };
const env = { APP_ENV: 'testing', SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' };
const sql = { ...env, DB_CONNECTION: 'mysql', DB_HOST: '127.0.0.1', DB_TEST_HOST: '127.0.0.1', DB_PORT: '3307', DB_TEST_PORT: '3307', DB_DATABASE: 'p2_test_rehearsal', DB_TEST_DATABASE: 'p2_test_rehearsal', DB_USERNAME: 'root', DB_TEST_USERNAME: 'root', DB_TEST_DISPOSABLE: '1', MYSQL_INTEGRATION: '1', P1_COMBINED_TESTS: '1' };

test('integrated candidates retain exact owner pins but use the actual candidate commit for execution', () => {
  const candidate = '4'.repeat(40);
  const integrated = { kind: 'integrated-audit-candidate-v1', ...pins, candidate, dirty: false, hashes: { 'scripts/check.mjs': 'a'.repeat(64) } };
  assert.equal(rehearsalPlan(integrated, { ...pins, p1: candidate }, 'preflight', env)[0].args[0], 'scripts/verify-integration.mjs');
  assert.throws(() => rehearsalPlan(integrated, pins, 'preflight', env), /matching exact candidate pins/);
});

test('preflight always uses the real P1 verifier and required static check, with no DB commands', () => {
  assert.equal(typeof rehearsalPlan, 'function');
  assert.deepEqual(rehearsalPlan(manifest, pins, 'preflight', env), [
    { runtime: 'node', args: ['scripts/verify-integration.mjs'] }, { runtime: 'node', args: ['scripts/check.mjs'] },
  ]);
});
test('dirty/missing/mismatched owner evidence and unprovided exact pins are refused', () => {
  for (const bad of [{ ...manifest, dirty: true }, { ...manifest, dirty: undefined }, { ...manifest, p2: '4'.repeat(40) }, { ...manifest, ownerHashes: {} }, { ...manifest, p1Hashes: {} }])
    assert.throws(() => rehearsalPlan(bad, pins, 'node', env));
  assert.throws(() => rehearsalPlan(manifest, { ...pins, p2: undefined }, 'node', env));
});
test('node verification retains original suites and all current P2 page/intent tests', () => {
  const plan = rehearsalPlan(manifest, pins, 'node', env);
  assert.equal(plan[0].args[0], 'scripts/verify-integration.mjs');
  assert.ok(plan.some(step => step.args.includes('scripts/run-tests.mjs')));
  assert.ok(plan.some(step => step.args.includes('tests/p2-resident-photos.mjs') && step.args.includes('tests/p2-photo-form.mjs') && step.args.includes('tests/p2-form-intents.mjs')));
});
test('SQL requires explicit matching disposable local MySQL confirmation and never migrates/seeds', () => {
  const plan = rehearsalPlan(manifest, pins, 'sql', sql);
  assert.deepEqual(plan.slice(-2), [{ runtime: 'php', args: ['backend/tests/P2/sql.php'] }, { runtime: 'php', args: ['backend/tests/Review/p2-lock-order.php'] }]);
  for (const change of [{ DB_DATABASE: 'barangay_live' }, { DB_TEST_DATABASE: 'p2_test_other' }, { DB_HOST: 'shared.example' }, { DB_TEST_HOST: 'other' }, { DB_TEST_PORT: '3306' }, { DB_TEST_DISPOSABLE: '0' }, { MYSQL_INTEGRATION: undefined }, { DB_CONNECTION: 'sqlite' }])
    assert.throws(() => rehearsalPlan(manifest, pins, 'sql', { ...sql, ...change }));
  assert.ok(plan.every(step => !step.args.some(arg => /migrate|seed|fresh|drop/i.test(arg))));
});
test('browser phase preserves original operational/photo runners and explicit reopen-gallery proof', () => {
  const browser = { ...sql, DB_DATABASE: 'bc_dba_p1_rehearsal', DB_TEST_DATABASE: 'bc_dba_p1_rehearsal', P1_BROWSER_MODULE: process.platform === 'win32' ? 'C:/private/playwright/index.mjs' : '/private/playwright/index.mjs' };
  for (const [phase, file] of Object.entries({ operations: 'tests/browser/operations.mjs', photos: 'tests/browser/photo-workflows.mjs', opening: 'backend/tests/P2/browser-opening-session.mjs' })) {
    const plan = rehearsalPlan(manifest, pins, phase, browser);
    assert.ok(plan.some(step => step.args.includes(file)));
    assert.equal(plan.filter(step => step.args.some(arg => arg.startsWith('tests/browser/') || arg.endsWith('browser-opening-session.mjs'))).length, 1, 'Use a separate fresh schema for each browser runner.');
  }
  assert.throws(() => rehearsalPlan(manifest, pins, 'photos', { ...browser, P1_BROWSER_MODULE: 'relative/path' }));
  assert.throws(() => rehearsalPlan(manifest, pins, 'photos', { ...browser, DB_DATABASE: 'p2_test_wrong', DB_TEST_DATABASE: 'p2_test_wrong' }));
});
test('unknown phases, production environments and enabled external delivery fail before launching work', () => {
  assert.throws(() => rehearsalPlan(manifest, pins, 'all', env));
  for (const change of [{ APP_ENV: 'production' }, { SMS_ENABLED: 'true' }, { MAKE_ENABLED: 'true' }, { OUTBOX_DISPATCH_ENABLED: 'true' }]) assert.throws(() => rehearsalPlan(manifest, pins, 'preflight', { ...env, ...change }));
});
test('civic browser uses its own fresh schema and keeps the original source verifier', () => {
  const browser = { ...sql, DB_DATABASE: 'bc_dba_p1_civic_rehearsal', DB_TEST_DATABASE: 'bc_dba_p1_civic_rehearsal', P1_BROWSER_MODULE: process.platform === 'win32' ? 'C:/private/playwright/index.mjs' : '/private/playwright/index.mjs' };
  assert.deepEqual(rehearsalPlan(manifest, pins, 'civic', browser).at(-1), { runtime: 'node', args: ['backend/tests/P2/browser-civic.mjs'] });
  assert.throws(() => rehearsalPlan(manifest, pins, 'civic', { ...browser, DB_DATABASE: 'bc_dba_p1_retained', DB_TEST_DATABASE: 'bc_dba_p1_retained' }));
});
test('civic readiness selectors exist in original announcement markup (selector contract only)', async () => {
  const source = await readFile(new URL('./browser-civic.mjs', import.meta.url), 'utf8');
  const original = await readFile(new URL('../../../assets/js/pages/official-announcements.js', import.meta.url), 'utf8');
  const markup = original.split('\n').find(line => line.trim().startsWith('main.innerHTML ='));
  const open = vm.runInNewContext('(' + source.slice(source.indexOf('async function announcements('), source.indexOf('async function menu(')) + ')', { origin: 'http://local.invalid' });
  await open({ page: { async goto() {}, locator(selector) { return { async waitFor() {
    for (const match of selector.matchAll(/\.([\w-]+)|\[([\w-]+)\]/g)) {
      assert.ok(match[1] ? new RegExp('class="[^"]*\\b' + match[1] + '\\b').test(markup) : new RegExp('\\b' + match[2] + '(?:[= >])').test(markup), 'No original element matches ' + selector);
    }
  } }; } } });
});
test('actual CLI refuses an unadmitted copied runner before launching even the source verifier', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bc-p2-rehearsal-'));
  try {
    const target = join(directory, 'backend/tests/P2/rehearsal.mjs');
    await mkdir(dirname(target), { recursive: true });
    await copyFile(new URL('./rehearsal.mjs', import.meta.url), target);
    await writeFile(join(directory, 'integration-manifest.json'), JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [target, 'preflight'], { encoding: 'utf8', windowsHide: true,
      env: { ...process.env, ...env, P2_CANDIDATE_P1: pins.p1, P2_CANDIDATE_DBA: pins.dba, P2_CANDIDATE_P2: pins.p2 } });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /runner must be included in the owner-admitted composition/);
    assert.equal(result.stdout, '');
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.split(/[\\/]/).at(-1).startsWith('bc-p2-rehearsal-'));
    await rm(directory, { recursive: true, force: true });
  }
});
