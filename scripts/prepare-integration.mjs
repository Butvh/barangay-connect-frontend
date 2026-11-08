import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeSnapshot } from './integration-sources.mjs';
import { composeIntegratedCandidate } from './integrated-candidate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await readFile(resolve(root, 'docs/backend/integration-lock.json'), 'utf8'));
for (const sha of [lock.dba, lock.p2, lock.p2_base]) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid pinned integration commit');
  try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root }); }
  catch { execFileSync('git', ['fetch', '--no-tags', 'origin', sha], { cwd: root }); }
}
const scratch = process.env.RUNNER_TEMP || resolve(root, '../barangay-connect-evidence/backend-p1');
await mkdir(scratch, { recursive: true });
const directory = await mkdtemp(resolve(scratch, 'bc-p1-compat-'));
const integrated = await readFile(resolve(root, 'docs/backend/owner-source-baseline.json')).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
const manifest = integrated ? await composeIntegratedCandidate({ root, destination: directory }) : await composeSnapshot({ root, destination: directory, lock });
if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `SNAPSHOT_DIR=${directory}\n`);
console.log(JSON.stringify({ directory, p1: manifest.p1, dirty: manifest.dirty, dba: lock.dba, p2: lock.p2, files: manifest.hashes ? Object.keys(manifest.hashes).length : Object.keys(manifest.p1Hashes).length + Object.values(manifest.ownerHashes).reduce((n, files) => n + Object.keys(files).length, 0) }));
