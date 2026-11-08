import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const browserFiles = { operations: 'tests/browser/operations.mjs', photos: 'tests/browser/photo-workflows.mjs', opening: 'backend/tests/P2/browser-opening-session.mjs', civic: 'backend/tests/P2/browser-civic.mjs' };
const nodeFiles = ['adapters', 'form-intents', 'foundation-adapters', 'location-forms', 'official-forms', 'photo-form', 'photo-upload', 'report-forms', 'resident-photos', 'communications-forms'].map(name => 'tests/p2-' + name + '.mjs');
const step = (runtime, ...args) => ({ runtime, args });
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

// This validates orchestration inputs, not authority or source authenticity.
// The actual unchanged P1 verifier and production entry points remain required.
export function rehearsalPlan(manifest, expected, phase, env) {
  requireValue(['preflight', 'node', 'sql', ...Object.keys(browserFiles)].includes(phase), 'Choose preflight, node, sql, operations, photos, opening or civic.');
  const integrated = manifest.kind === 'integrated-audit-candidate-v1';
  for (const owner of ['p1', 'dba', 'p2']) requireValue(/^[a-f0-9]{40}$/.test(expected[owner] || '') && (integrated && owner === 'p1' ? manifest.candidate : manifest[owner]) === expected[owner], 'Provide matching exact candidate pins for ' + owner + '.');
  requireValue(manifest.dirty === false, 'Use a clean P1-admitted candidate.');
  for (const files of integrated ? [manifest.hashes] : [manifest.p1Hashes, manifest.ownerHashes?.dba, manifest.ownerHashes?.p2]) requireValue(files && Object.keys(files).length > 0, 'Missing owner source fingerprints.');
  requireValue(env.APP_ENV === 'testing', 'Use the testing environment.');
  for (const name of ['SMS_ENABLED', 'MAKE_ENABLED', 'OUTBOX_DISPATCH_ENABLED']) requireValue(env[name] === 'false', 'Keep ' + name + '=false.');
  const plan = [step('node', 'scripts/verify-integration.mjs'), step('node', 'scripts/check.mjs')];
  if (phase === 'node') return [...plan, step('node', 'scripts/run-tests.mjs'), step('node', '--experimental-vm-modules', '--test', ...nodeFiles), step('node', '--test', 'backend/tests/P2/rehearsal.test.mjs')];
  if (phase === 'preflight') return plan;
  requireValue(env.DB_CONNECTION === 'mysql' && env.DB_TEST_DISPOSABLE === '1' && env.MYSQL_INTEGRATION === '1' && env.P1_COMBINED_TESTS === '1', 'Confirm the genuine disposable MySQL integration profile.');
  requireValue(['127.0.0.1', 'localhost', '::1'].includes(env.DB_HOST) && env.DB_HOST === env.DB_TEST_HOST, 'Use matching local disposable database hosts.');
  requireValue(/^\d+$/.test(env.DB_PORT || '') && Number(env.DB_PORT) > 0 && Number(env.DB_PORT) < 65536 && env.DB_PORT === env.DB_TEST_PORT, 'Use matching explicit database ports.');
  requireValue(env.DB_USERNAME && env.DB_USERNAME === env.DB_TEST_USERNAME && (env.DB_PASSWORD || '') === (env.DB_TEST_PASSWORD || ''), 'Use matching private database credentials.');
  const databasePattern = phase === 'sql' ? /^p2_test_[a-zA-Z0-9_]+$/ : phase === 'civic' ? /^bc_dba_p1_civic_[a-zA-Z0-9_]+$/ : /^bc_dba_p1_[a-zA-Z0-9_]+$/;
  requireValue(databasePattern.test(env.DB_DATABASE || '') && env.DB_DATABASE === env.DB_TEST_DATABASE, 'Use matching freshly prepared disposable schema names for this phase.');
  if (phase === 'sql') return [...plan, step('php', 'backend/tests/P2/sql.php'), step('php', 'backend/tests/Review/p2-lock-order.php')];
  requireValue(isAbsolute(env.P1_BROWSER_MODULE || ''), 'Use the private locked Playwright runtime.');
  return [...plan, step('node', browserFiles[phase])];
}

async function main() {
  const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'));
  const manifest = JSON.parse(await readFile(resolve(root, 'integration-manifest.json'), 'utf8'));
  const expected = Object.fromEntries(['p1', 'dba', 'p2'].map(owner => [owner, process.env['P2_CANDIDATE_' + owner.toUpperCase()]]));
  const phase = process.argv[2] || 'preflight';
  const plan = rehearsalPlan(manifest, expected, phase, process.env);
  const ownPath = 'backend/tests/P2/rehearsal.mjs';
  const digest = createHash('sha256').update(await readFile(resolve(root, ownPath))).digest('hex');
  requireValue((manifest.kind === 'integrated-audit-candidate-v1' ? manifest.hashes?.[ownPath] : manifest.ownerHashes?.p2?.[ownPath]) === digest, 'This runner must be included in the owner-admitted composition; do not copy it over a frozen manifest.');
  if (!['preflight', 'node'].includes(phase)) {
    requireValue(process.env.APP_BASE_PATH && await realpath(process.env.APP_BASE_PATH) === await realpath(resolve(root, 'backend')), 'APP_BASE_PATH must be this exact candidate backend.');
    if (process.env.DBA_TEST_AUTOLOAD) requireValue(await realpath(process.env.DBA_TEST_AUTOLOAD) === await realpath(resolve(root, 'backend/vendor/autoload.php')), 'DBA_TEST_AUTOLOAD must use this candidate vendor runtime.');
  }
  const report = { phase, pins: expected, scope: 'P2 phase evidence only; DBA independent acceptance and final P1 Linux CI remain separate.', steps: [] };
  for (const command of plan) {
    const runtime = command.runtime === 'node' ? process.execPath : process.env.PHP_BINARY || 'php';
    const result = spawnSync(runtime, command.args, { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
    report.steps.push({ ...command, exit: result.status });
    if (result.error || result.status !== 0) {
      console.error(JSON.stringify({ ...report, passed: false }));
      process.exitCode = result.status || 1;
      return;
    }
  }
  console.log(JSON.stringify({ ...report, passed: true }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error('P2 rehearsal refused: ' + error.message); process.exitCode = 2; });
