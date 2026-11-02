import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!vm.SourceTextModule) {
  const flags = Number(process.versions.node.split('.')[0]) < 24 ? ['--experimental-default-type=module'] : [];
  const result = spawnSync(process.execPath, [...flags, '--experimental-vm-modules', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else {
  const source = await readFile(new URL('../assets/js/core/sign-out.js', import.meta.url), 'utf8');
  async function fixture(logout) {
    const navigations = [], toasts = [];
    const context = vm.createContext({ location: { assign: path => navigations.push(path) } });
    const mod = new vm.SourceTextModule(source, { context });
    await mod.link(spec => {
      const values = spec.endsWith('auth.js') ? { Auth: { logout } } : { UI: { toast: (...args) => toasts.push(args) } };
      return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
    });
    await mod.evaluate();
    return { run: mod.namespace.signOutTo, navigations, toasts };
  }
  let finish;
  const delayed = await fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = delayed.run('login.html');
  assert.deepEqual(delayed.navigations, []);
  finish(); assert.equal(await pending, true); assert.deepEqual(delayed.navigations, ['login.html']);
  const failed = await fixture(async () => { throw new Error('Private failure detail'); });
  assert.equal(await failed.run('login.html'), false); assert.deepEqual(failed.navigations, []);
  assert.equal(failed.toasts.length, 1); assert.doesNotMatch(failed.toasts[0][0], /Private/);
  console.log('PASS sign out waits for invalidation and preserves the page on failure');
}
