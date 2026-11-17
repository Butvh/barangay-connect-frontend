import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = {
  ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false',
  APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
  DB_CONNECTION: 'mysql', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_URL: '',
  DB_DATABASE: 'bc_dba_p1_guard_probe', DB_TEST_DATABASE: 'bc_dba_p1_guard_probe',
  DB_TEST_DISPOSABLE: '1', P1_COMBINED_TESTS: '1',
  SMS_ENABLED: 'false', MAKE_ENABLED: 'false', OUTBOX_DISPATCH_ENABLED: 'false',
};

// Every rejection happens before opening a database connection; port 1 is intentional.
for (const [helper, validTarget] of [
  ['prepare-browser-database.php', 'bc_dba_p1_admin_browser'],
  ['prepare-p2-database.php', 'p2_test_integration'],
]) {
  for (const [name, target, overrides] of [
    ['unknown target', 'bc_dba_p1_unapproved', {}],
    ['missing disposable opt-in', validTarget, { DB_TEST_DISPOSABLE: '0' }],
    ['missing combined opt-in', validTarget, { P1_COMBINED_TESTS: '0' }],
    ['mismatched database confirmation', validTarget, { DB_TEST_DATABASE: 'bc_dba_p1_other' }],
  ]) {
    test(`${helper} exits nonzero for ${name}`, () => {
      const child = spawnSync(process.env.PHP_BINARY || 'php', [`backend/tests/Support/${helper}`, target], {
        cwd: root, env: { ...base, ...overrides }, encoding: 'utf8', windowsHide: true,
      });
      assert.ifError(child.error);
      assert.match(child.stdout + child.stderr, /Only confirmed ephemeral (?:browser|CI) schemas may be prepared/);
      assert.equal(child.status, 1, 'A rejected setup must stop bash -e before later migrations');
      assert.doesNotMatch(child.stdout + child.stderr, /Prepared fresh disposable/);
    });
  }
}
