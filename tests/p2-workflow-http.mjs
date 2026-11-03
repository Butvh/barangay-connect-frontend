// Original operational controllers + P1 HTTP/session + actual P2 services/MySQL.
// DOM, navigation and P1's unavailable reference-page reads are test boundaries, not production registrations.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHttp } from '../assets/js/adapters/http.js';
import { createP2DomainFactories } from '../assets/js/adapters/p2-registration.js';
import { createOperations } from '../assets/js/adapters/operations.js';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { createReports } from '../assets/js/adapters/reports.js';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { createFormSubmission, configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import { load, element } from './p2-form-harness.mjs';
import { UI } from '../assets/js/core/ui.js';
import { Icons } from '../assets/js/core/icons.js';
import { Fmt } from '../assets/js/core/format.js';
import * as model from '../assets/js/pages/resident-report-model.js';
const [origin, fixturePath] = process.argv.slice(2), fixtures = JSON.parse(await readFile(fixturePath, 'utf8'));
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
configureOperationalSubmissions({ createSubmissionIntent });
const factories = createP2DomainFactories({ createOperations, createCommunications, createReports });
async function client(record) {
  const jar = new Map(), calls = [];
  let dropResponse = false;
  const http = createHttp({ origin, async fetchImpl(url, options) {
    const headers = new Headers(options.headers);
    if (jar.size) headers.set('Cookie', [...jar].map(([key, value]) => key + '=' + value).join('; '));
    const response = await fetch(url, { ...options, headers });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)); }
    if (options.method === 'POST' && /\/(responses|rescues)$/.test(new URL(url).pathname)) {
      calls.push({ key: headers.get('Idempotency-Key'), body: JSON.parse(options.body) });
      if (dropResponse && response.ok) { dropResponse = false; await response.text(); throw Error('Test-only lost reply after server commit'); }
    }
    return response;
  } });
  const user = await http.request('auth/login', { method: 'POST', body: { email: record.email, password: 'Fixture123' } });
  http.setIdentity(user);
  const alerts = factories.alerts({ http });
  return { user, http, alerts, calls, dropNextReply() { dropResponse = true; } };
}
const clients = Object.fromEntries(await Promise.all(Object.entries(fixtures.people).map(async ([key, value]) => [key, await client(value)])));
const settle = async () => { for (let n = 0; n < 10; n++) await new Promise(resolve => setImmediate(resolve)); };
const event = { preventDefault() {} };
async function sos(who) {
  const user = { ...who.user, household: fixtures.household }, auth = { current: () => user, roleOf: u => u.role, requireRole() {} };
  const main = element(), errors = [];
  const shared = { Auth: auth, Api: { alerts: who.alerts, barangays: { list: async () => [fixtures.barangay] } }, UI, Icons, Fmt, e: UI.escape, icon: Icons.svg,
    BCMap: { mount: () => ({ destroy() {} }) }, heading: () => '', tile: () => '', link: () => '', field: () => '', textarea: () => '',
    busy: async (_, work) => work(), errorView: (_, error) => errors.push(error.message), householdUser: async () => user, verificationFor: async () => ({ review_status: 'Approved' }), baseMarkers: () => [],
  };
  const context = vm.createContext({ URLSearchParams, location: { search: '', replace() {} }, history: { replaceState() {} }, window: { addEventListener() {} } });
  const page = new vm.SourceTextModule(await readFile(new URL('../assets/js/pages/resident-report.js', import.meta.url), 'utf8'), { context });
  await page.link(specifier => {
    const values = specifier.endsWith('resident-shared.js') ? shared : specifier.endsWith('shell-resident.js') ? { Shell: { resident: () => main } } : specifier.endsWith('icons.js') ? { Icons } : specifier.endsWith('config.js') ? { Config: { DEMO_MODE: false } } : specifier.endsWith('p2-form-intent.js') ? { createFormSubmission: options => { const form = createFormSubmission({ ...options, demo: false }); return { ...form, submit: (body, write) => form.submit(structuredClone(body), write) }; } } : model;
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await page.evaluate();
  for (let n = 0; n < 100 && !main.querySelector('#send').events?.click && !errors.length; n++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(errors, []);
  const button = main.querySelector('#send'); await button.events.click({ currentTarget: button });
  const rows = await who.alerts.list(); assert.equal(rows.length, 1); return rows[0];
}
async function assign(who, alert, role, personId) {
  const { module } = await load('official-assignment.js', { user: who.user, role: who.user.role, api: { alerts: who.alerts } });
  const el = module.assignAlert(alert, { role, mode: alert.status === 'Pending' ? 'acknowledge' : 'assign' });
  for (let n = 0; n < 100 && !el.querySelector('[data-people]').events?.change; n++) await settle();
  // The handler is attached before the HTTP read completes; wait for its submit button to become available.
  for (let n = 0; n < 100 && el.querySelector('[type=submit]').disabled; n++) await new Promise(resolve => setTimeout(resolve, 20));
  el.querySelector('[data-people]').events.change({ target: { value: String(personId) } });
  await el.querySelector('form').events.submit(event);
  assert.equal(el.open, false, 'Original assignment dialog did not save: ' + el.querySelector('[data-error]').textContent);
  return who.alerts.get(alert.id);
}
async function log(who, alert, rescue, needed) {
  const { module, dialogs } = await load('official-alert-actions.js', { user: who.user, role: who.user.role, api: { alerts: who.alerts }, facilities: [fixtures.facility] });
  const el = await module.logAlert(alert, rescue ? 'rescue' : 'response'), form = el.querySelector('form');
  for (const [name, value] of Object.entries({ response_type: 'Assessment', response_status: 'Completed', rescue_status: 'Completed', rescue_required: needed ? 'Yes' : 'No', notes: 'Fictional integration check' })) form.elements[name] = { value };
  if (rescue) { await settle(); form.querySelector('#choose-destination').events.click(); dialogs.at(-1).choice.events.click(); }
  who.dropNextReply();
  await form.events.submit(event); assert.equal(el.open, true, 'Lost reply unexpectedly completed UI');
  await form.events.submit(event); assert.equal(el.open, false, 'Original log retry failed: ' + form.querySelector('[data-error]').textContent);
  assert.deepEqual(who.calls.at(-1), who.calls.at(-2));
  return who.alerts.get(alert.id);
}
for (const needed of [false, true]) {
  const resident = clients[needed ? 'residentRescue' : 'residentNoRescue'];
  let alert = await sos(resident);
  alert = await assign(clients.secretary, alert, 'responder', clients.responder.user.id);
  await assert.rejects(clients.responder.alerts.logResponse(alert.id, { response_type: 'Assessment', response_status: 'Completed', rescue_required: needed, expected_revision: 0 }, { idempotencyKey: 'stale-ui-response-' + Number(needed) }), { code: 'CONFLICT' });
  await assert.rejects(clients.rescuer.alerts.get(alert.id), { code: 'NOT_FOUND' });
  alert = await log(clients.responder, alert, false, needed);
  assert.equal(alert.status, 'Responding'); assert.equal(alert.responses.length, 1);
  if (needed) {
    alert = await assign(clients.captain, alert, 'rescuer', clients.rescuer.user.id);
    alert = await log(clients.rescuer, alert, true, true);
    assert.equal(alert.status, 'Rescue in progress'); assert.equal(alert.rescues.length, 1);
  }
  const { module } = await load('official-alert-actions.js', { role: clients.captain.user.role, user: clients.captain.user, api: { alerts: clients.captain.alerts } });
  await module.resolveAlert(alert);
  assert.equal((await resident.alerts.get(alert.id)).status, 'Resolved');
  const other = clients[needed ? 'residentNoRescue' : 'residentRescue'];
  await assert.rejects(other.alerts.get(alert.id), { code: 'NOT_FOUND' });
  for (const nearby of await other.alerts.list({ nearby: true })) for (const key of ['resident', 'household', 'resident_id', 'responses']) assert.equal(Object.hasOwn(nearby, key), false);
  console.log('PASS original controllers over real P1 HTTP/MySQL: SOS, manual dispatch, current assessment, ' + (needed ? 'rescue' : 'no-rescue') + ', explicit resolution; lost-reply replay, stale revision and recipient privacy');
}
