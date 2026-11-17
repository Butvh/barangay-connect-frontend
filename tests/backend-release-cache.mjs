import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.DB_TEST_DISPOSABLE !== '1' || !/^bc_dba_p1_/.test(process.env.DB_DATABASE || '') || process.env.DB_DATABASE !== process.env.DB_TEST_DATABASE) throw new Error('Confirmed disposable target required.');
const env = { ...process.env, APP_ENV: 'testing', IDENTITY_ENABLED: 'true', P2_MODULES_ENABLED: 'false',
  P2_TEST_BINDINGS: 'false', P1_ADMIN_TEST_BINDINGS: 'false', P1_PHOTO_TEST_BINDINGS: 'false', P1_CONSENT_TEST_BINDINGS: 'false',
  P1_SMS_INTENT_TEST_BINDINGS: 'false', P1_OPERATIONAL_BROWSER: '0', P2_TEST_HTTP: '0', INTEGRATION_SMS_INTENT_ENABLED: 'false',
  OUTBOX_DISPATCH_ENABLED: 'false', SMS_ENABLED: 'false', MAKE_ENABLED: 'false' };
const disabled = { ...env, INTEGRATION_RELEASE_ENABLED: 'false' }, release = { ...env, INTEGRATION_RELEASE_ENABLED: 'true' };
const cli = (args, config = disabled) => spawnSync(env.PHP_BINARY || 'php', ['backend/artisan', ...args], { cwd: root, env: config, windowsHide: true, encoding: 'utf8' });
function ok(args, config) { const r = cli(args, config); assert.equal(r.status, 0, r.stdout + r.stderr); return r.stdout; }
function probe(config) {
  const r = spawnSync(env.PHP_BINARY || 'php', ['backend/tests/Support/release-route-probe.php'], { cwd: root, env: config, windowsHide: true, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}
function routes(config) { return JSON.parse(ok(['route:list', '--json'], config)); }
try {
  ok(['config:clear']); ok(['route:clear']);
  assert.equal(probe(release).status, 401);
  assert.ok(routes(release).some(r => r.uri === 'api/v1/alerts' && r.method.includes('POST')));
  const mixed = cli(['route:list', '--json'], { ...release, P2_MODULES_ENABLED: 'true' });
  assert.notEqual(mixed.status, 0); assert.match(mixed.stdout + mixed.stderr, /raw isolated P2/i);
  ok(['route:cache']);
  const mismatch = probe(release);
  assert.equal(mismatch.status, 503); assert.match(mismatch.message, /different profile/i);
  ok(['route:clear']);
  ok(['route:cache'], release); ok(['config:cache'], release);
  assert.equal(probe(release).status, 401);
  assert.ok(routes(release).some(r => r.uri === 'api/v1/alerts' && r.method.includes('POST')));
  console.log('PASS fresh/cached release operational routes, mixed raw flag rejection, mismatched cache fail-closed');
} finally { ok(['config:clear']); ok(['route:clear']); }
