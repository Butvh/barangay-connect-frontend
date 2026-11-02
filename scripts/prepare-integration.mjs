import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, lstat, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 });
const lock = JSON.parse(await readFile(resolve(root, 'docs/backend/integration-lock.json'), 'utf8'));
for (const sha of [lock.dba, lock.p2, lock.p2_base]) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid pinned integration commit');
  try { git('cat-file', '-e', `${sha}^{commit}`); }
  catch { git('fetch', '--no-tags', 'origin', sha); }
}
const safe = name => name && !name.includes('\\') && !name.startsWith('/') && !name.split('/').some(part => part === '..' || part === '.git') && !/^backend\/(?:vendor|storage\/.+[^/]$|public\/frontend)\//.test(name) && !/(?:^|\/)\.env(?:$|\.(?!example$))/.test(name);
// Persist across Windows tool sandboxes; CI uses its private runner temp directory.
const scratch = process.env.RUNNER_TEMP || resolve(root, '../barangay-connect-evidence/backend-p1');
await mkdir(scratch, { recursive: true });
const destination = await mkdtemp(resolve(scratch, 'bc-p1-compat-'));
const ownerHashes = {};
const p1Files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean);
for (const name of p1Files) {
  if (!safe(name)) throw new Error(`Unsafe snapshot source: ${name}`);
  const from = resolve(root, name), to = resolve(destination, name);
  if ((await lstat(from)).isSymbolicLink()) throw new Error('Snapshot sources cannot be symbolic links');
  await mkdir(dirname(to), { recursive: true }); await copyFile(from, to);
}
const used = new Set(p1Files);
async function overlay(sha, paths, owner) {
  ownerHashes[owner] = {};
  for (const name of paths) {
    if (!safe(name) || used.has(name)) throw new Error(`Owned file collision or unsafe overlay: ${name}`);
    const content = git('show', `${sha}:${name}`);
    const to = resolve(destination, name);
    await mkdir(dirname(to), { recursive: true }); await writeFile(to, content);
    ownerHashes[owner][name] = createHash('sha256').update(content).digest('hex'); used.add(name);
  }
}
const dba = git('ls-tree', '-r', '--name-only', lock.dba, 'backend').toString().trim().split('\n');
await overlay(lock.dba, dba, 'dba');
const p2 = git('diff', '--name-only', lock.p2_base, lock.p2).toString().trim().split('\n');
if (p2.some(name => !/^(?:backend\/(?:app|routes|tests\/P2)\/|backend\/README\.md$|assets\/js\/adapters\/|tests\/p2-adapters\.mjs$|docs\/P2-BACKEND-INTEGRATION\.md$|docs\/superpowers\/plans\/2026-11-02-p2-modules-execution\.md$)/.test(name))) throw new Error('P2 changed outside the reviewed integration allowlist');
await overlay(lock.p2, p2, 'p2');
// Add DBA suite discovery in the private snapshot only; preserve root P1 suites and every owner's source bytes.
const xmlPath = resolve(destination, 'backend/phpunit.xml');
const xml = await readFile(xmlPath, 'utf8');
await writeFile(resolve(destination, 'backend/phpunit.combined.xml'), xml.replace('</testsuites>', '<testsuite name="Database"><directory>tests/Database</directory></testsuite></testsuites>'));
const manifest = { ...lock, p1: git('rev-parse', 'HEAD').toString().trim(), dirty: Boolean(git('status', '--porcelain').toString().trim()), ownerHashes };
await writeFile(resolve(destination, 'integration-manifest.json'), JSON.stringify(manifest, null, 2));
if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `SNAPSHOT_DIR=${destination}\n`);
console.log(JSON.stringify({ directory: destination, p1: manifest.p1, dirty: manifest.dirty, dba: lock.dba, p2: lock.p2, files: used.size }));
