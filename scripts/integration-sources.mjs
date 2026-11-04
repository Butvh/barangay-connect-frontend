import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const shared = new Set(['assets/js/pages/official-alert-actions.js', 'assets/js/pages/official-assignment.js', 'assets/js/pages/resident-report-model.js', 'assets/js/pages/resident-report.js', 'tests/resident-sos-pages.mjs']);
const p2Allowed = /^(?:backend\/(?:app|routes|tests\/P2)\/|backend\/README\.md$|assets\/js\/adapters\/|tests\/p2-(?:adapters|foundation-adapters|form-harness|form-intents|location-forms|official-forms|report-forms|workflow-http)\.mjs$|docs\/P2-(?:BACKEND-INTEGRATION|COMPATIBILITY)\.md$|docs\/P2-INTEGRATION-MANIFEST\.json$|docs\/superpowers\/plans\/(?:2026-11-02-p2-modules-execution|2026-11-03-p2-integration-execution|2026-11-03-p2-locks-and-forms)\.md$)/;
const digest = value => createHash('sha256').update(value).digest('hex');
export function assertSourcePath(name) {
  if (!name || /[\\:\x00]/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || ['..', '.', '.git', 'node_modules'].includes(part)) || /(?:^|\/)\.env(?:$|\.(?!example$))/.test(name) || /^backend\/(?:vendor|public\/frontend)(?:\/|$)/.test(name) || (/^backend\/storage\//.test(name) && !name.endsWith('/.gitignore'))) throw new Error(`Unsafe snapshot source: ${name}`);
}
async function sourceBytes(root, name) {
  assertSourcePath(name);
  let current = root;
  for (const part of name.split('/')) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Snapshot sources cannot contain symlinks: ${name}`);
  }
  return readFile(current);
}

export async function composeSnapshot({ root, destination, lock }) {
  const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 });
  const blob = (sha, name) => git('show', `${sha}:${name}`);
  const entries = sha => new Map(git('ls-tree', '-r', '-z', sha).toString().split('\0').filter(Boolean).map(line => {
    const [, mode, type, hash, name] = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/s.exec(line);
    return [name, { mode, type, hash }];
  }));
  const ownerHashes = { dba: {}, p2: {} }, sharedOverlays = {}, p1Hashes = {}, pending = new Map();
  const p1Files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean);
  for (const name of p1Files) {
    const bytes = await sourceBytes(root, name); pending.set(name, bytes); p1Hashes[name] = digest(bytes);
  }
  const base = entries(lock.p2_base), head = entries('HEAD');
  async function overlay(sha, paths, owner) {
    const incoming = entries(sha);
    for (const name of paths) {
      assertSourcePath(name);
      if (owner === 'p2' && !shared.has(name) && !p2Allowed.test(name)) throw new Error(`P2 path outside reviewed allowlist: ${name}`);
      if (!incoming.has(name) || incoming.get(name).type !== 'blob' || incoming.get(name).mode !== '100644') throw new Error(`Deleted, nonregular or symbolic owner source: ${name}`);
      const content = blob(sha, name);
      if (pending.has(name)) {
        if (owner !== 'p2' || !shared.has(name)) throw new Error(`Owned file collision: ${name}`);
        if (!base.has(name) || head.get(name)?.hash !== base.get(name).hash || digest(Buffer.from(pending.get(name).toString('utf8').replace(/\r\n/g, '\n'))) !== digest(blob(lock.p2_base, name))) throw new Error(`Explicit P1/P2 reconciliation required: ${name}`);
        sharedOverlays[name] = { base: lock.p2_base, before: digest(blob(lock.p2_base, name)), checkoutBefore: digest(pending.get(name)), after: digest(content) };
        delete p1Hashes[name];
      } else if (shared.has(name)) throw new Error(`Reviewed common-base source is missing: ${name}`);
      pending.set(name, content); ownerHashes[owner][name] = digest(content);
    }
  }
  await overlay(lock.dba, [...entries(lock.dba).keys()].filter(name => name.startsWith('backend/')), 'dba');
  const p2 = git('diff', '--name-only', '-z', '--no-renames', lock.p2_base, lock.p2).toString().split('\0').filter(Boolean);
  await overlay(lock.p2, p2, 'p2');
  for (const [name, content] of pending) { const target = resolve(destination, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); }
  const xml = pending.get('backend/phpunit.xml').toString();
  await writeFile(resolve(destination, 'backend/phpunit.combined.xml'), xml.replace('</testsuites>', '<testsuite name="Database"><directory>tests/Database</directory></testsuite><testsuite name="Integration"><directory>tests/Integration</directory></testsuite><testsuite name="Compatibility"><directory>tests/Compatibility</directory></testsuite></testsuites>'));
  const manifest = { ...lock, p1: git('rev-parse', 'HEAD').toString().trim(), dirty: Boolean(git('status', '--porcelain').toString().trim()), ownerHashes, sharedOverlays, p1Hashes };
  await writeFile(resolve(destination, 'integration-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function verifySources(root, manifest) {
  let count = 0;
  for (const files of [manifest.p1Hashes || {}, ...Object.values(manifest.ownerHashes)]) for (const [name, expected] of Object.entries(files)) {
    if (digest(await sourceBytes(root, name)) !== expected) throw new Error(`Owner source changed: ${name}`);
    count++;
  }
  return count;
}
