import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { buildFrontendArtifact } from '../scripts/stage-frontend.mjs';

const root = await mkdtemp(join(tmpdir(), 'bc-artifact-'));
async function put(path, value = 'fixture') { await mkdir(resolve(root, path, '..'), { recursive: true }); await writeFile(resolve(root, path), value); }
try {
  for (const file of ['index.html', 'login.html', 'resident-login.html', 'official-dashboard.html', 'captain-reports.html', 'assets/css/base.css', 'assets/js/core/auth.js', 'assets/js/adapters/http.js', 'assets/img/maps/sampaguita.png', 'assets/fonts/Inter.woff2']) await put(file);
  for (const file of ['tests.html', 'components.html', '.env', '.env.production', 'backend/public/index.php', 'backend/.env', 'backend/vendor/package/file.js', 'docs/private.md', 'uploads/document.pdf', 'dump.sql', 'assets/img/source/README.md', 'assets/js/secrets.js', 'assets/uploads/private.png', 'assets/js/core/.secret.js']) await put(file, 'SHOULD_NEVER_BE_PUBLIC');
  const result = await buildFrontendArtifact({ root });
  assert.equal(result.directory, resolve(root, '.frontend-dist'));
  assert.equal(await readFile(join(result.directory, 'login.html'), 'utf8'), 'fixture');
  assert.equal(result.files.length, 10);
  assert.ok(result.files.every(name => !/backend|\.env|tests|components|docs|uploads|dump|README|secrets|\.secret/.test(name)));
  assert.deepEqual((await readdir(result.directory)).sort(), ['assets', 'captain-reports.html', 'index.html', 'login.html', 'official-dashboard.html', 'resident-login.html']);
  await put('.frontend-dist/stale.txt');
  await buildFrontendArtifact({ root });
  assert.ok(!(await readdir(result.directory)).includes('stale.txt'));
  console.log('PASS FrontendArtifactTest: only intended static pages/assets are public; stale files removed.');
  await assert.rejects(() => buildFrontendArtifact({ root, destination: root }), /destination/i);
  console.log('PASS FrontendArtifactTest: output cannot replace the repository root.');
  if (process.platform !== 'win32') {
    await symlink(resolve(root, 'backend/.env'), resolve(root, 'assets/js/core/leak.js'));
    await assert.rejects(() => buildFrontendArtifact({ root }), /symbolic link/i);
    console.log('PASS FrontendArtifactTest: linked files are rejected.');
  }
} finally {
  // Exact mkdtemp result, checked against the intended temporary parent/prefix.
  const expectedParent = resolve(tmpdir()) + sep;
  if (!root.startsWith(expectedParent) || !root.slice(expectedParent.length).startsWith('bc-artifact-')) throw new Error('Unsafe fixture cleanup');
  await rm(root, { recursive: true, force: true });
}
