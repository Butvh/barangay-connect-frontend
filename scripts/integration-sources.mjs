import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const shared = new Set(['assets/js/pages/official-alert-actions.js', 'assets/js/pages/official-assignment.js', 'assets/js/pages/resident-alert.js', 'assets/js/pages/resident-report-model.js', 'assets/js/pages/resident-report.js', 'tests/resident-sos-pages.mjs',
  'assets/js/pages/official-announcement-actions.js', 'assets/js/pages/official-announcements.js', 'assets/js/pages/official-feedback.js', 'assets/js/pages/resident-feedback-new.js',
]);
const civicAdditions = new Set([
  'backend/app/Contracts/P2/TanodReferences.php', 'docs/P2-COMMUNICATIONS-CLOSURE.md', 'tests/p2-communications-forms.mjs',
  'backend/tests/P2/browser-civic.mjs', 'backend/tests/P2/civic-fixture.php', 'backend/tests/P2/civic-evidence.php',
]);
const photoDependencies = new Map([
  ['assets/js/core/incident-photos.js', '01c4bd21f4280a4f5395ff2583f3708ca168e12e'],
  ['assets/js/core/runtime-config.js', 'c27d4975acf2a8055cbf74c96fb8aec5875214d0'],
]);
const p2Allowed = /^(?:backend\/(?:app|routes|tests\/P2)\/|backend\/tests\/Feature\/P2(?:AdministrativeNotifications|ConsentProducer|IncidentPhotoCommand)Test\.php$|backend\/README\.md$|assets\/js\/adapters\/|tests\/p2-(?:adapters|foundation-adapters|form-harness|form-intents|location-forms|official-forms|report-forms|workflow-http|photo-upload|photo-form|resident-photos)\.mjs$|docs\/P2-(?:BACKEND-INTEGRATION|COMPATIBILITY|PHOTO-AUTHORIZATION|SMS-ELIGIBILITY|PHOTO-SMS-ACCEPTANCE|JOINT-ACCEPTANCE|PRESENTATION-READINESS|ACTUAL-OWNER-INTEGRATION)\.md$|docs\/P2-INTEGRATION-MANIFEST\.json$|docs\/superpowers\/plans\/(?:2026-11-02-p2-modules-execution|2026-11-03-p2-integration-execution|2026-11-03-p2-locks-and-forms|2026-11-04-p2-photo-sms-contracts|2026-11-04-p2-joint-acceptance|2026-11-04-p2-actual-owner-integration|2026-11-04-p2-current-owner-certification|2026-11-05-p2-opening-observation)\.md$)/;
const digest = value => createHash('sha256').update(value).digest('hex');
const lf = value => Buffer.from(value.toString('utf8').replace(/\r\n/g, '\n'));
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
  const ownerHashes = { dba: {}, p2: {} }, sharedOverlays = {}, sharedDependencies = {}, p1Hashes = {}, pending = new Map();
  const p1Files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean);
  for (const name of p1Files) {
    const bytes = await sourceBytes(root, name); pending.set(name, bytes); p1Hashes[name] = digest(bytes);
  }
  const base = entries(lock.p2_base), head = entries('HEAD');
  async function overlay(sha, paths, owner) {
    const incoming = entries(sha);
    for (const name of paths) {
      assertSourcePath(name);
      const dependencyBlob = owner === 'p2' && photoDependencies.get(name);
      if (owner === 'p2' && !dependencyBlob && !shared.has(name) && !civicAdditions.has(name) && !p2Allowed.test(name)) throw new Error(`P2 path outside reviewed allowlist: ${name}`);
      const entry = incoming.get(name);
      if (entry?.type !== 'blob' || entry.mode !== '100644') throw new Error(`Deleted, nonregular or symbolic owner source: ${name}`);
      const content = blob(sha, name);
      if (dependencyBlob) {
        const local = head.get(name), checkout = pending.get(name);
        if (base.has(name) || entry.hash !== dependencyBlob || local?.mode !== '100644' || local.hash !== dependencyBlob || !checkout || !lf(checkout).equals(content)) throw new Error(`Exact shared P1 dependency required: ${name}`);
        pending.set(name, content); p1Hashes[name] = digest(content);
        sharedDependencies[name] = { blob: dependencyBlob, sha256: p1Hashes[name], p2: sha };
        continue;
      }
      if (pending.has(name)) {
        if (owner !== 'p2' || !shared.has(name)) throw new Error(`Owned file collision: ${name}`);
        if (!base.has(name) || head.get(name)?.hash !== base.get(name).hash || !lf(pending.get(name)).equals(blob(lock.p2_base, name))) throw new Error(`Explicit P1/P2 reconciliation required: ${name}`);
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
  const manifest = { ...lock, p1: git('rev-parse', 'HEAD').toString().trim(), dirty: Boolean(git('status', '--porcelain').toString().trim()), ownerHashes, sharedOverlays, sharedDependencies, p1Hashes };
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
