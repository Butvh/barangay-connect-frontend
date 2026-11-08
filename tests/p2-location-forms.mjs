import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { element } from './p2-form-harness.mjs';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { createFormSubmission, configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import * as model from '../assets/js/pages/resident-report-model.js';
import { UI } from '../assets/js/core/ui.js';
import { Icons } from '../assets/js/core/icons.js';
import { Fmt } from '../assets/js/core/format.js';
configureOperationalSubmissions({ createSubmissionIntent });
for (const [name, coordinates, pick, expected] of [
  ['unknown location remains null', { map_x: null, map_y: null }, null, [null, null]],
  ['saved edge pin remains exact', { map_x: 0, map_y: 100 }, null, [0, 100]],
  ['deliberate map pick is submitted', { map_x: null, map_y: null }, { x: 12, y: 34 }, [12, 34]],
]) {
  const main = element(), writes = [], errors = [], home = { address: 'Fixture address', ...coordinates };
  const user = { id: 1, barangay_id: 1, role: 'resident', household: home }, alert = { id: 7, assignment_revision: 0, status: 'Pending', ...coordinates };
  const shared = { Auth: { requireRole() {}, current: () => user, roleOf: () => 'resident' }, Api: { alerts: { get: async () => alert, addDetails: async (...args) => { writes.push(args); } }, barangays: { list: async () => [{ id: 1, name: 'Fixture scope' }] } },
    UI: { ...UI, toast() {} }, Fmt, e: UI.escape, icon: Icons.svg, BCMap: { mount: () => ({ destroy() {}, setMarkers() {} }) }, heading: () => '', tile: () => '', field: () => '', textarea: () => '', link: () => '',
    busy: async (_, work) => work(), errorView: (_, error) => errors.push(error.message), householdUser: async () => user, verificationFor: async () => ({ review_status: 'Approved' }), baseMarkers: () => [],
  };
  const context = vm.createContext({ URLSearchParams, FormData: class { get(name) { return name === 'description' ? 'Description only' : 'Fixture address'; } }, location: { search: '?id=7&step=details', href: '' }, window: { addEventListener() {} } });
  const page = new vm.SourceTextModule(await readFile(new URL('../assets/js/pages/resident-report.js', import.meta.url), 'utf8'), { context });
  await page.link(specifier => {
    const values = specifier.endsWith('resident-shared.js') ? shared : specifier.endsWith('shell-resident.js') ? { Shell: { resident: () => main } } : specifier.endsWith('icons.js') ? { Icons } : specifier.endsWith('config.js') ? { Config: { DEMO_MODE: false } } : specifier.endsWith('p2-form-intent.js') ? { createFormSubmission: options => { const form = createFormSubmission({ ...options, demo: false }); return { ...form, submit: (body, write) => form.submit(structuredClone(body), write) }; } } : model;
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await page.evaluate(); for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, []);
  if (pick) main.querySelector('#point-map').events['bc-map-point']({ detail: pick });
  await main.querySelector('#details').events.submit({ preventDefault() {}, currentTarget: main.querySelector('#details') });
  assert.equal(writes.length, 1);
  assert.deepEqual([writes[0][1].map_x, writes[0][1].map_y], expected, name);
  assert.equal(writes[0][1].expected_revision, 0);
  assert.ok(writes[0][2]?.idempotencyKey, 'Details must retain a command key');
  console.log('PASS original details controller: ' + name);
}
