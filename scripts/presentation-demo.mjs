import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageBackendFrontend } from './stage-backend-frontend.mjs';
import { verifySources } from './integration-sources.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'integration-manifest.json'), 'utf8'));
if (manifest.dirty || process.env.P1_PRESENTATION_DISPOSABLE !== '1' || process.env.DB_TEST_DISPOSABLE !== '1' ||
    ! /^bc_dba_p1_presentation_[a-z0-9_]+$/.test(process.env.DB_DATABASE || '') ||
    process.env.DB_DATABASE !== process.env.DB_TEST_DATABASE || ! ['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) throw new Error('Use the reviewed clean private snapshot and a confirmed local disposable schema.');
await verifySources(root, manifest);
const php = process.env.PHP_BINARY || 'php';
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', P1_COMBINED_TESTS: '1',
  P2_TEST_BINDINGS: 'true', IDENTITY_ENABLED: 'true', P1_OPERATIONAL_BROWSER: '1',
  SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false' };
const run = (...args) => execFileSync(php, args, { cwd: root, env, windowsHide: true, encoding: 'utf8' });
const credentials = resolve(root, 'backend/storage/app/private/presentation-credentials.json');
if (process.argv[2] === 'prepare') {
  try { await access(credentials); throw new Error('This snapshot already has a presentation dataset. Use a NEW snapshot/schema for reset.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log(run('backend/tests/Support/presentation-fixture.php').trim());
  console.log(run('backend/artisan', 'migrate', '--force', '--no-interaction').trim());
  const records = JSON.parse(run('backend/tests/Support/browser-operational-fixture.php'));
  await writeFile(credentials, JSON.stringify({ database: env.DB_DATABASE, ...records }, null, 2), { mode: 0o600, flag: 'wx' });
  await stageBackendFrontend({ root, operationalTest: true });
  console.log('Prepared fictional accounts. Credentials are in backend/storage/app/private/presentation-credentials.json (never staged/public).');
} else if (process.argv[2] === 'serve') {
  const records = JSON.parse(await readFile(credentials, 'utf8'));
  if (records.database !== env.DB_DATABASE) throw new Error('Dataset/database mismatch.');
  const port = Number(process.env.PRESENTATION_PORT || 8767);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback port.');
  await stageBackendFrontend({ root, operationalTest: true });
  console.log(`Official: http://127.0.0.1:${port}/frontend/login.html\nResident: http://127.0.0.1:${port}/frontend/resident-login.html`);
  const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', resolve(root, 'backend/public'), resolve(root, 'backend/tests/Support/operational-router.php')], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
  server.on('exit', code => process.exitCode = code || 0);
} else throw new Error('Use prepare or serve. Reset means a new snapshot + new schema; this tool never drops data.');
