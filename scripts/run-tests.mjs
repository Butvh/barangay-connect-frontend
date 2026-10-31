import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Node 24 removed this flag; earlier supported versions need it for package-free ES modules.
const flags = Number(process.versions.node.split('.')[0]) < 24 ? ['--experimental-default-type=module'] : [];
const result = spawnSync(process.execPath, [...flags, 'tests/node-runner.js'], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
if (!process.exitCode) {
  const pages = spawnSync(process.execPath, ['tests/facility-pages.mjs'], { cwd: root, stdio: 'inherit' });
  if (pages.error) console.error(pages.error.message);
  process.exitCode = pages.status ?? 1;
}
if (!process.exitCode) {
  const sos = spawnSync(process.execPath, ['tests/resident-sos-pages.mjs'], { cwd: root, stdio: 'inherit' });
  if (sos.error) console.error(sos.error.message);
  process.exitCode = sos.status ?? 1;
}
if (!process.exitCode) {
  const detail = spawnSync(process.execPath, ['tests/official-alert-detail.mjs'], { cwd: root, stdio: 'inherit' });
  if (detail.error) console.error(detail.error.message);
  process.exitCode = detail.status ?? 1;
}
