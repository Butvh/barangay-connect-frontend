import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, access, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stageBackendFrontend } from '../scripts/stage-backend-frontend.mjs';

const fixture = await mkdtemp(resolve(tmpdir(), 'bc-backend-artifact-'));
try {
  await mkdir(resolve(fixture, 'backend/public'), { recursive: true });
  await writeFile(resolve(fixture, 'index.html'), '<!doctype html><title>Test</title>');
  for (const folder of ['core', 'adapters']) await cp(new URL(`../assets/js/${folder}/`, import.meta.url), resolve(fixture, `assets/js/${folder}`), { recursive: true });
  await mkdir(resolve(fixture, 'assets/js/data'), { recursive: true });
  await writeFile(resolve(fixture, 'assets/js/data/seed.js'), 'throw new Error("Seed must never load");');
  await writeFile(resolve(fixture, 'backend/.env'), 'APP_KEY=excluded-test-value');
  const result = await stageBackendFrontend({ root: fixture });
  assert.match(await readFile(resolve(result.directory, 'assets/js/core/runtime-config.js'), 'utf8'), /mode: 'backend'/);
  await assert.rejects(access(resolve(result.directory, 'assets/js/data/seed.js')));
  await assert.rejects(access(resolve(result.directory, 'backend/.env')));
  console.log('PASS backend artifact switches mode and excludes seeds and backend secrets');

  let storageReads = 0, requests = 0;
  const oldFetch = globalThis.fetch, oldLocation = globalThis.location;
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { storageReads++; throw new Error('No browser storage permitted'); } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { storageReads++; throw new Error('No demo session permitted'); } });
  globalThis.location = { origin: 'http://localhost:8000' };
  globalThis.fetch = async url => {
    requests++; assert.equal(url, 'http://localhost:8000/api/v1/me');
    return new Response(JSON.stringify({ data: { id: 42, barangay_id: 7, full_name: 'Test Secretary', is_secretary: true }, meta: { server_time: '2026-11-02T01:00:00Z' } }), { headers: { 'Content-Type': 'application/json' } });
  };
  let Api;
  try {
    const { Auth } = await import(pathToFileURL(resolve(result.directory, 'assets/js/core/auth.js')));
    const { Store } = await import(pathToFileURL(resolve(result.directory, 'assets/js/core/store.js')));
    ({ Api } = await import(pathToFileURL(resolve(result.directory, 'assets/js/core/api.js'))));
    assert.equal(Auth.requireRole(['secretary']).id, 42);
    assert.equal(requests, 1); assert.equal(storageReads, 0);
    assert.throws(() => Store.read(), error => error.code === 'NOT_AVAILABLE');
    assert.match(Store.now(), /^2026-11-02T09:00:/);
    await assert.rejects(Api.alerts.list(), error => error.code === 'NOT_AVAILABLE');
    console.log('PASS actual staged module graph hydrates /me before guards, uses server time, and never reads demo storage');
  } finally {
    Api?.destroy(); globalThis.fetch = oldFetch;
    if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation;
    for (const [key, old] of [['localStorage', oldLocal], ['sessionStorage', oldSession]]) {
      if (old) Object.defineProperty(globalThis, key, old); else delete globalThis[key];
    }
  }
  if (process.platform !== 'win32') {
    await rm(result.directory, { recursive: true });
    await symlink(resolve(fixture, 'assets'), result.directory, 'dir');
    await assert.rejects(stageBackendFrontend({ root: fixture }), /symbolic link/);
    console.log('PASS backend artifact rejects a symlink destination before deletion');
  }
} finally {
  if (dirname(fixture) !== resolve(tmpdir()) || !basename(fixture).startsWith('bc-backend-artifact-')) throw new Error('Unsafe fixture cleanup');
  await rm(fixture, { recursive: true, force: true });
}
