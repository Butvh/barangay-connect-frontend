import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createBackendAuth } from '../assets/js/adapters/session.js';
import { createHttp } from '../assets/js/adapters/http.js';
import { monitoringMarkers } from '../assets/js/pages/official-map-model.js';

test('authored frontend files are valid UTF-8 and contain no repeated-decoding corruption', async () => {
  const files = [];
  async function walk(path) { for (const entry of await readdir(path, { withFileTypes: true })) { const name = path + '/' + entry.name; if (entry.isDirectory()) await walk(name); else if (/\.(js|html|css)$/.test(name)) files.push(name); } }
  await walk('assets');
  files.push(...(await readdir('.')).filter(name => name.endsWith('.html')));
  const corrupted = [];
  for (const file of files) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file));
    if (/\u00c3[\u0080-\u00ff]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf\u2000-\u20ff]|\u00ef\u00bf\u00bd/.test(text)) corrupted.push(file);
  }
  assert.deepEqual(corrupted, [], 'Fix authored strings rather than decoding arbitrary resident input at runtime.');
});

for (const portal of ['resident', 'official']) test(`${portal} sign-in sends explicit portal intent through the shared transport`, async () => {
  let body;
  const role = portal === 'resident' ? 'resident' : 'secretary';
  const auth = createBackendAuth({ location: { pathname: portal === 'resident' ? '/frontend/resident-login.html' : '/frontend/login.html' },
    http: { onUnauthorized() {}, async request(path, options) { body = options.body; return { id: 1, barangay_id: 1, role, ['is_'+role]: true }; } } });
  await auth.login('fictional@example.invalid', 'Fictional123');
  assert.equal(body.portal, portal);
});

test('registration sign-in can explicitly retain resident portal intent', async () => {
  let body;
  const auth = createBackendAuth({ location: { pathname: '/frontend/register.html' }, http: { onUnauthorized() {}, async request(path, options) { body = options.body; return { id: 1, barangay_id: 1, role: 'resident', is_resident: true }; } } });
  await auth.login('fictional@example.invalid', 'Fictional123', { portal: 'resident' });
  assert.equal(body.portal, 'resident');
});

test('known field explanations survive HTTP normalization while arbitrary server strings stay generic', async () => {
  const http = createHttp({ origin: 'http://localhost', fetchImpl: async () => new Response(JSON.stringify({ code: 'VALIDATION', fields: {
    capacity: 'Enter a whole number.', name: '<script>private arbitrary text</script>', map_x: 'Map coverage is not available for this barangay.',
  } }), { status: 422, headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(http.request('facilities'), error => {
    assert.equal(error.fields.capacity, 'Enter a whole number.');
    assert.equal(error.fields.name, 'Check this field.');
    assert.equal(error.fields.map_x, 'Map coverage is not available for this barangay.');
    return true;
  });
});

test('map projection reports unlocated facilities and alerts without inventing coordinates', () => {
  const filters = { status: '', type: '', facility: '', households: true, complaints: false };
  const data = { alerts: [{ id: 1, map_x: null, map_y: null }], facilities: [{ id: 2, name: 'Unpinned', type: 'Hospital', status: 'Active', map_x: null, map_y: null }], households: [], complaints: [] };
  const projected = monitoringMarkers(data, filters, 'captain');
  assert.equal(projected.unplacedFacilities, 1); assert.equal(projected.unplacedAlerts, 1);
  assert.equal(projected.markers.length, 1);
});

test('pinned zero-edge and inactive facility markers retain their truthful availability', () => {
  const projected = monitoringMarkers({ alerts: [], households: [], complaints: [], facilities: [{ id: 2, name: 'Inactive hospital', type: 'Hospital', status: 'Inactive', map_x: 0, map_y: 100 }] }, { facility: '', households: true }, 'secretary');
  assert.equal(projected.markers[1].inactive, true); assert.equal(projected.markers[1].x, 0);
});
