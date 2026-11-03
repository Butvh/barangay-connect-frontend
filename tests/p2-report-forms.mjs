// Original resident Report controller, P1 intent helper and real P2 factory/transport handoff.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { createFormSubmission, configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import { createP2DomainFactories } from '../assets/js/adapters/p2-registration.js';
import { createOperations } from '../assets/js/adapters/operations.js';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { createReports } from '../assets/js/adapters/reports.js';
import * as model from '../assets/js/pages/resident-report-model.js';
import { UI } from '../assets/js/core/ui.js';
import { Fmt } from '../assets/js/core/format.js';
import { Icons } from '../assets/js/core/icons.js';

configureOperationalSubmissions({ createSubmissionIntent });
const calls = [], elements = new Map(), errors = [];
const user = { id: 4, barangay_id: 1, role: 'resident', household: { address: 'Fixture road', map_x: 0, map_y: 100 } };
const auth = { requireRole() {}, current: () => user, roleOf: () => 'resident' };
let alert;
const factories = createP2DomainFactories({ createOperations, createCommunications, createReports });
const alerts = factories.alerts({ http: { async envelope(path, options) {
  if (options.method === 'POST') {
    calls.push(options);
    alert = { id: 7, status: 'Pending', household: user.household, was_created: true };
    if (calls.length === 1) throw Object.assign(Error('Lost reply'), { code: 'NETWORK' });
    return { data: alert };
  }
  return { data: alert };
} } });
const main = { classList: { add() {} }, innerHTML: '', querySelectorAll: () => [], querySelector(selector) {
  if (!elements.has(selector)) elements.set(selector, { disabled: false, addEventListener(type, fn) { this[type] = fn; } });
  return elements.get(selector);
} };
const shared = { Auth: auth, Api: { alerts: { ...alerts, list: async () => [] }, barangays: { list: async () => [{ id: 1, name: 'Fixture scope' }] } }, UI, Fmt, Icons, e: UI.escape, icon: Icons.svg,
  BCMap: { mount: () => ({ destroy() {} }) }, heading: () => '', tile: () => '', link: () => '', field: () => '', textarea: () => '',
  busy: async (_, task) => task(), errorView: (_, error) => errors.push(error.message), householdUser: async () => user, verificationFor: async () => ({ review_status: 'Approved' }), baseMarkers: () => [],
};
const context = vm.createContext({ URLSearchParams, location: { search: '', replace() {} }, history: { replaceState() {} }, window: { addEventListener() {} } });
const source = await readFile(new URL('../assets/js/pages/resident-report.js', import.meta.url), 'utf8');
const page = new vm.SourceTextModule(source, { context });
await page.link(specifier => {
  const values = specifier.endsWith('resident-shared.js') ? shared : specifier.endsWith('shell-resident.js') ? { Shell: { resident: () => main } } : specifier.endsWith('icons.js') ? { Icons } : specifier.endsWith('config.js') ? { Config: { DEMO_MODE: false } } : specifier.endsWith('p2-form-intent.js') ? { createFormSubmission: options => { const form = createFormSubmission({ ...options, demo: false }); return { ...form, submit: (input, write) => form.submit(structuredClone(input), write) }; } } : model;
  return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
});
await page.evaluate();
for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(errors, []);
const button = main.querySelector('#send');
await button.click({ currentTarget: button });
await button.click({ currentTarget: button });
assert.equal(calls.length, 2, 'Original SOS form must send the prepared intent and retain it after a lost reply');
assert.deepEqual(calls[0].body, calls[1].body);
assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
assert.equal(Object.hasOwn(calls[0].body, 'photo_name'), false, 'Filename metadata is not a private upload');
assert.equal(calls[0].body.map_x, 0);
assert.match(main.innerHTML, /Your SOS is now Pending/);
console.log('PASS original SOS controller retries with one P1 key/body, preserves edge pin and omits fake upload metadata');
