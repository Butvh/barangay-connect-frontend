import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { composeSnapshot, assertSourcePath, verifySources } from '../scripts/integration-sources.mjs';

const page = 'assets/js/pages/resident-report.js';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'bc-snapshot-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git('init'); git('config', 'user.name', 'Snapshot test'); git('config', 'user.email', 'snapshot@example.invalid'); git('config', 'core.autocrlf', 'false');
  const put = async (name, value) => { await mkdir(join(root, name, '..'), { recursive: true }); await writeFile(join(root, name), value); };
  const commit = () => { git('add', '.'); git('commit', '-m', 'fixture'); return git('rev-parse', 'HEAD'); };
  await put(page, 'export const original = true;\n');
  await put('backend/phpunit.xml', '<phpunit><testsuites><testsuite name="Unit"/></testsuites></phpunit>');
  const base = commit();
  await put('backend/database/fixture.php', '<?php // DBA\n'); git('add', 'backend/database/fixture.php');
  git('rm', page, 'backend/phpunit.xml'); git('commit', '-m', 'DBA-owned tree'); const dba = git('rev-parse', 'HEAD');
  git('checkout', '--detach', base);
  await put(page, 'export const original = true;\nexport const intent = true;\n');
  await put('assets/js/adapters/p2-form-intent.js', 'export const adapter = true;\n'); const p2 = commit();
  git('checkout', '--detach', base);
  const destination = await mkdtemp(join(tmpdir(), 'bc-snapshot-result-'));
  const lock = { p2_base: base, dba, p2 };
  return { root, destination, git, put, commit, lock };
}

test('approved common-base page overlay preserves the exact P2 blob and before/after fingerprints', async () => {
  const f = await fixture();
  // A normal Windows CRLF checkout is the same reviewed text, not a concurrent edit.
  await f.put(page, 'export const original = true;\r\n');
  const manifest = await composeSnapshot(f);
  const incoming = f.git('show', `${f.lock.p2}:${page}`) + '\n';
  assert.equal(await readFile(join(f.destination, page), 'utf8'), incoming);
  const sha = value => createHash('sha256').update(value).digest('hex');
  assert.equal(manifest.sharedOverlays[page].before, sha('export const original = true;\n'));
  assert.equal(manifest.sharedOverlays[page].after, sha(incoming));
  assert.equal(manifest.ownerHashes.p2[page], sha(incoming));
  assert.equal(manifest.ownerHashes.dba['backend/database/fixture.php'], sha('<?php // DBA\n'));
  const xml = await readFile(join(f.destination, 'backend/phpunit.combined.xml'), 'utf8');
  for (const name of ['Unit', 'Database', 'Integration', 'Compatibility']) assert.ok(xml.includes(`name="${name}"`));
  assert.equal(await verifySources(f.destination, manifest), 4);
  await writeFile(join(f.destination, page), 'changed after assembly');
  await assert.rejects(verifySources(f.destination, manifest), /source changed/);
});

test('uncommitted and committed concurrent P1 page edits require reconciliation', async () => {
  for (const committed of [false, true]) {
    const f = await fixture(); await f.put(page, 'export const p1Changed = true;\n');
    if (committed) f.commit();
    await assert.rejects(composeSnapshot(f), /reconciliation/i);
  }
});

test('an arbitrary P2 original-page collision is rejected, even when its baseline matches', async () => {
  const f = await fixture();
  f.git('checkout', '--detach', f.lock.p2); await f.put('assets/js/pages/login.js', 'unreviewed'); f.lock.p2 = f.commit(); f.git('checkout', '--detach', f.lock.p2_base);
  await assert.rejects(composeSnapshot(f), /allowlist|reviewed/i);
});

test('reviewed photo/SMS contract documents compose without allowing unrelated P2 documents', async () => {
  const f = await fixture(); f.git('checkout', '--detach', f.lock.p2);
  for (const name of ['P2-PHOTO-AUTHORIZATION', 'P2-SMS-ELIGIBILITY', 'P2-PHOTO-SMS-ACCEPTANCE', 'P2-JOINT-ACCEPTANCE']) await f.put(`docs/${name}.md`, '# Reviewed contract\n');
  await f.put('docs/superpowers/plans/2026-11-04-p2-photo-sms-contracts.md', '# Reviewed execution\n');
  await f.put('docs/superpowers/plans/2026-11-04-p2-joint-acceptance.md', '# Reviewed joint execution\n');
  f.lock.p2 = f.commit(); f.git('checkout', '--detach', f.lock.p2_base);
  const manifest = await composeSnapshot(f); assert.equal(Object.keys(manifest.ownerHashes.p2).length, 8);
  assert.equal(await verifySources(f.destination, manifest), 10);
  f.git('checkout', '--detach', f.lock.p2); await f.put('docs/P2-UNREVIEWED.md', '# Not approved\n'); f.lock.p2 = f.commit(); f.git('checkout', '--detach', f.lock.p2_base);
  await assert.rejects(composeSnapshot({ ...f, destination: await mkdtemp(join(tmpdir(), 'bc-snapshot-reject-')) }), /allowlist/);
});

test('unapproved DBA collision never overwrites a P1 source', async () => {
  const f = await fixture();
  f.git('checkout', '--detach', f.lock.dba); await f.put('backend/phpunit.xml', 'replacement'); f.lock.dba = f.commit(); f.git('checkout', '--detach', f.lock.p2_base);
  await assert.rejects(composeSnapshot(f), /collision/i);
});

test('path validation rejects traversal, Windows roots, private bytes and dependencies', () => {
  for (const path of ['../escape', 'a/../b', '/root', 'C:/escape', 'a\\b', '.git/config', 'backend/.env', 'backend/.env.local', 'backend/vendor/a.php', 'backend/public/frontend/a.js', 'backend/storage/private/a.pdf', 'node_modules/a.js']) assert.throws(() => assertSourcePath(path), /Unsafe/);
  for (const path of [page, 'backend/.env.example', 'backend/storage/app/private/.gitignore']) assert.doesNotThrow(() => assertSourcePath(path));
});

test('incoming symlink Git objects and symlinked source parents are rejected', async t => {
  const f = await fixture();
  f.git('checkout', '--detach', f.lock.p2); f.git('update-index', '--add', '--cacheinfo', `120000,${f.git('hash-object', '-w', '--stdin')},assets/js/adapters/link.js`);
  f.git('commit', '-m', 'symlink fixture'); f.lock.p2 = f.git('rev-parse', 'HEAD'); f.git('checkout', '--detach', f.lock.p2_base);
  await assert.rejects(composeSnapshot(f), /symbolic|symlink/i);
  const other = await fixture();
  await rename(join(other.root, 'assets/js/pages'), join(other.root, 'assets/js/pages-real'));
  try { await symlink(join(other.root, 'assets/js/pages-real'), join(other.root, 'assets/js/pages'), 'junction'); }
  catch (error) { if (error.code === 'EPERM') { t.diagnostic('Windows does not permit junction creation; Git symlink object rejection still executed.'); return; } throw error; }
  await assert.rejects(composeSnapshot(other), /symbolic|symlink/i);
});
