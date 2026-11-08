import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { assertSourcePath } from './integration-sources.mjs';

const hash = bytes => {
  // Canonicalize text line endings only; retain binary assets byte-for-byte.
  let normalized = bytes;
  try { normalized = Buffer.from(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n')); } catch { /* Binary source. */ }
  return createHash('sha256').update(normalized).digest('hex');
};
async function source(root, name) {
  assertSourcePath(name);
  let path = root;
  for (const part of name.split('/')) {
    path = resolve(path, part);
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Symbolic candidate source: ' + name);
  }
  return readFile(path);
}

// Frozen upstream fingerprints remain separate from explicitly patched candidate bytes.
export async function verifyCandidateBaseline(root) {
  const baseline = JSON.parse(await source(root, 'docs/backend/owner-source-baseline.json'));
  const patches = JSON.parse(await source(root, 'docs/backend/integration-audit-patches.json'));
  const lock = JSON.parse(await source(root, 'docs/backend/integration-lock.json'));
  if (baseline.dirty || ['dba', 'p2', 'p2_base'].some(key => baseline[key] !== lock[key])) throw new Error('Owner baseline and locked pins differ.');
  const expected = { ...baseline.p1Hashes, ...baseline.ownerHashes.dba, ...baseline.ownerHashes.p2 };
  const names = Object.keys(expected);
  const queries = names.map(name => `${baseline.ownerHashes.dba[name] ? baseline.dba : baseline.ownerHashes.p2[name] ? baseline.p2 : baseline.p1}:${name}`);
  const blobs = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: queries.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
  let offset = 0;
  const changed = new Set();
  for (const name of names) {
    const end = blobs.indexOf(10, offset), header = blobs.subarray(offset, end).toString();
    if (!/^[a-f0-9]{40} blob \d+$/.test(header)) throw new Error('Missing pinned source: ' + name);
    const size = Number(header.split(' ')[2]), start = end + 1;
    const before = hash(blobs.subarray(start, start + size)); offset = start + size + 1;
    const after = hash(await source(root, name));
    if (after === before) continue;
    const patch = patches[name];
    if (!patch || patch.before !== before || patch.after !== after || !patch.reason?.trim()) throw new Error('Unreviewed candidate modification: ' + name);
    changed.add(name);
  }
  if (Object.keys(patches).some(name => !changed.has(name))) throw new Error('Stale or extraneous candidate patch declaration.');
  return { baseline, patches };
}

export async function composeIntegratedCandidate({ root, destination }) {
  const { baseline, patches } = await verifyCandidateBaseline(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 }).toString();
  const files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
  const hashes = {};
  for (const name of files) {
    const bytes = await source(root, name);
    hashes[name] = hash(bytes);
    const target = resolve(destination, name);
    await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes);
  }
  const manifest = { kind: 'integrated-audit-candidate-v1', candidate: git('rev-parse', 'HEAD').trim(),
    dirty: Boolean(git('status', '--porcelain').trim()), p1: baseline.p1, dba: baseline.dba, p2: baseline.p2,
    upstreamOwnerFiles: Object.keys(baseline.ownerHashes.dba).length + Object.keys(baseline.ownerHashes.p2).length,
    explicitPatches: Object.keys(patches).length, hashes };
  await writeFile(resolve(destination, 'integration-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function verifyIntegratedCandidate(root, manifest) {
  await verifyCandidateBaseline(root);
  for (const [name, expected] of Object.entries(manifest.hashes)) {
    if (hash(await source(root, name)) !== expected) throw new Error('Candidate changed after snapshot: ' + name);
  }
  return Object.keys(manifest.hashes).length;
}
