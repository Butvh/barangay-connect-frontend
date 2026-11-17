import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { stageBackendFrontend } from '../scripts/stage-backend-frontend.mjs';
const root = await mkdtemp(resolve(tmpdir(), 'bc-release-artifact-'));
const names = ['backend/app/Providers/IntegrationServiceProvider.php', 'backend/config/integration.php',
  'backend/app/Http/Controllers/Identity/AdministrationController.php', 'assets/js/adapters/administrative-registration.js',
  'assets/js/adapters/domains.js', 'assets/js/core/notification-preferences.js', 'scripts/stage-backend-frontend.mjs', 'backend/routes/api.php'];
const sha = bytes => createHash('sha256').update(bytes.toString().replace(/\r\n/g, '\n')).digest('hex');
const admissionPath = 'docs/backend/pr51-p0-release-admission.json';
try {
  await mkdir(resolve(root, 'backend/public'), { recursive: true });
  for (const dir of ['core', 'adapters']) await cp(new URL('../assets/js/' + dir, import.meta.url), resolve(root, 'assets/js/' + dir), { recursive: true });
  await writeFile(resolve(root, 'index.html'), '<!doctype html><title>Release fixture</title>');
  for (const name of names) { await mkdir(dirname(resolve(root, name)), { recursive: true }); await cp(new URL('../' + name, import.meta.url), resolve(root, name)); }
  const requiredSources = Object.fromEntries(await Promise.all(names.map(async name => [name, sha(await readFile(resolve(root, name)))])));
  const admission = { kind: 'pr51-p0-release-admission-v1', profile: 'p0-v1', baseCommit: 'b60c0dddeff1a765c08cdec73ce45e4afdf26b43', requiredSources };
  await mkdir(dirname(resolve(root, admissionPath)), { recursive: true });
  async function pin(value, dirty = false) {
    await writeFile(resolve(root, admissionPath), JSON.stringify(value));
    const hashes = {};
    async function walk(dir = '') { for (const e of await readdir(resolve(root, dir), { withFileTypes: true })) {
      const name = dir ? dir + '/' + e.name : e.name;
      if (name.startsWith('backend/public/frontend') || name.startsWith('.frontend-dist') || name === 'integration-manifest.json') continue;
      if (e.isDirectory()) await walk(name); else hashes[name] = sha(await readFile(resolve(root, name)));
    } }
    await walk();
    await writeFile(resolve(root, 'integration-manifest.json'), JSON.stringify({ kind: 'integrated-audit-candidate-v1', candidate: 'a'.repeat(40), dirty, hashes }));
  }
  await pin(admission);
  const result = await stageBackendFrontend({ root, releaseProfile: 'p0-v1' });
  const runtime = await readFile(resolve(result.directory, 'assets/js/core/runtime-config.js'), 'utf8');
  assert.match(runtime, /releaseProfile: "p0-v1"/);
  assert.doesNotMatch(runtime, /(?:operationalTest|administrationTest|photoTest|consentTest|generalFeedbackTest): true/);
  await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'p0-v1', consentTest: true }));
  await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'unknown' }));
  await pin(admission, true); await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'p0-v1' }), /clean/i);
  const incomplete = structuredClone(admission); delete incomplete.requiredSources['backend/config/integration.php'];
  await pin(incomplete); await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'p0-v1' }), /incomplete/i);
  const wrong = structuredClone(admission); wrong.requiredSources['assets/js/adapters/domains.js'] = '0'.repeat(64);
  await pin(wrong); await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'p0-v1' }), /changed/i);
  await pin(admission); await writeFile(resolve(root, 'assets/js/adapters/domains.js'), '// unreviewed mutation');
  await assert.rejects(stageBackendFrontend({ root, releaseProfile: 'p0-v1' }), /changed/i);
  console.log('PASS release artifact requires exact clean admission, rejects mixed/unknown/dirty/incomplete/changed dependencies');
} finally {
  if (dirname(root) !== resolve(tmpdir()) || !basename(root).startsWith('bc-release-artifact-')) throw new Error('Unsafe fixture cleanup');
  await rm(root, { recursive: true, force: true });
}
