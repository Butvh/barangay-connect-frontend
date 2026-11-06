import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createFormSubmission, configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { UI } from '../assets/js/core/ui.js';
import { Icons } from '../assets/js/core/icons.js';
import { Fmt } from '../assets/js/core/format.js';
import * as feedbackModel from '../assets/js/pages/official-feedback-model.js';
import * as announcementModel from '../assets/js/core/announcements.js';

// A standalone P2 checkout may explicitly use P1's unchanged helper for isolated
// unit tests. This is not source admission or final composed-browser acceptance.
const helper = process.env.P2_TEST_SUBMISSION_HELPER ? pathToFileURL(process.env.P2_TEST_SUBMISSION_HELPER) : new URL('../assets/js/adapters/submission-intent.js', import.meta.url);
configureOperationalSubmissions(await import(helper));
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
function element() {
  const children = new Map();
  const value = { open: true, isConnected: true, dataset: {}, value: '', hidden: false, disabled: false, innerHTML: '',
    classList: { add() {}, toggle() {} }, events: {}, elements: {},
    addEventListener(name, fn) { this.events[name] = fn; },
    querySelector(selector) { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
    querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, focus() {}, contains() { return false; },
  };
  for (const key of ['title', 'content', 'expires_at', 'reason', 'q', 'status', 'sort']) value.elements[key] = { value: key === 'sort' ? 'newest' : '', addEventListener() {}, setAttribute() {}, removeAttribute() {} };
  return value;
}
async function page(file, { demo = false, role = 'secretary', feedback = [], formData = {}, search = '', transport = async () => ({ data: { id: 1 } }), confirm = async () => true } = {}) {
  let actor = { id: 2, barangay_id: 1, role, full_name: 'Fixture', session_observation: 'opening' };
  const main = element(), dialogs = [], errors = [], api = createCommunications({ request: transport });
  const rating = element(); rating.dataset.rating = '4';
  main.querySelectorAll = selector => selector === '[data-rating]' ? [rating] : [];
  const auth = { current: () => actor, roleOf: u => u.role, requireRole() {} };
  const ui = { ...UI, tabs() {}, confirm, toast(message) { errors.push(message); }, closeDialog(el) { el.open = false; } };
  const shared = { Auth: auth, Api: { ...api, subscribe: () => () => {}, feedback: { ...api.feedback, list: async () => feedback } }, UI: ui, Fmt, Icons, e: UI.escape,
    Store: { now: () => '2026-11-06T08:00:00Z' }, icon: Icons.svg, heading: () => '', tile: () => '', field: () => '', textarea: () => '', link: () => '',
    verificationFor: async () => ({ review_status: 'Approved' }), busy: async (el, work) => work(), pagination: () => '', live: (_, load) => load,
    dialog() { const el = element(); dialogs.push(el); return el; },
  };
  const location = { search, href: '' }, context = vm.createContext({ URLSearchParams, location, history: { replaceState() {} }, document: { hidden: true, addEventListener() {}, querySelector: () => main }, window: { addEventListener() {} }, clearTimeout() {}, setTimeout() {}, FormData: class { constructor() { return new Map(Object.entries(formData)); } } });
  const module = new vm.SourceTextModule(await readFile(new URL('../assets/js/pages/' + file, import.meta.url), 'utf8'), { context });
  await module.link(specifier => {
    const values = /(?:official|resident)-shared.js$/.test(specifier) ? shared
      : specifier.includes('shell-') ? { Shell: { resident: () => main, official: () => main } }
        : specifier.includes('p2-form-intent.js') ? { createFormSubmission: options => { const form = createFormSubmission({ ...options, demo }); return { ...form, submit: (body, write) => form.submit(structuredClone(body), write) }; } }
          : specifier.includes('config.js') ? { Config: { DEMO_MODE: demo } }
            : specifier.includes('official-feedback-model') ? feedbackModel
              : specifier.includes('icons.js') ? { Icons } : announcementModel;
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate(); await settle();
  return { module: module.namespace, main, dialogs, errors, location, rating, reauthenticate() { actor = { ...actor, session_observation: 'new-login' }; } };
}
const event = { preventDefault() {} };

test('original publish dialog retries the exact key/body and refuses changed draft or session', async () => {
  const calls = [], p = await page('official-announcement-actions.js', { transport: async (_, options) => { calls.push(structuredClone(options)); throw { code: 'NETWORK', message: 'lost reply' }; } });
  const el = p.module.composeAnnouncement({ onSaved() {} }), form = el.querySelector('form');
  form.elements.title.value = 'Notice'; form.elements.content.value = 'Original content';
  await form.events.submit(event); await form.events.submit(event);
  assert.equal(calls.length, 2); assert.ok(calls[0].headers?.['Idempotency-Key']); assert.deepEqual(calls[0], calls[1]);
  form.elements.content.value = 'Changed'; await form.events.submit(event); assert.equal(calls.length, 2);
  form.elements.content.value = 'Original content'; p.reauthenticate(); await form.events.submit(event); assert.equal(calls.length, 2);
});
test('original edit/retract dialogs retain their opening revision and reject changed sessions', async () => {
  for (const action of ['edit', 'retract']) {
    const calls = [], p = await page('official-announcement-actions.js', { transport: async (_, options) => { calls.push(structuredClone(options)); throw { code: 'NETWORK', message: 'lost reply' }; } });
    const row = { id: 3, title: 'Notice', content: 'Original', expires_at: null, revision: 7 };
    const el = action === 'edit' ? p.module.composeAnnouncement({ row, onSaved() {} }) : p.module.retractAnnouncement(row, () => {}), form = el.querySelector('form');
    form.elements.title.value = 'Notice'; form.elements.content.value = 'Original'; form.elements.reason.value = 'Incorrect';
    await form.events.submit(event); await form.events.submit(event);
    assert.equal(calls.length, 2); assert.equal(calls[0].body.expected_revision, 7); assert.deepEqual(calls[0].body, calls[1].body);
    p.reauthenticate(); await form.events.submit(event); assert.equal(calls.length, 2);
  }
});
for (const type of ['complaint', 'suggestion', 'general']) test(`original resident ${type} form submits the contracted payload with a stable key`, async () => {
  const calls = [], p = await page('resident-feedback-new.js', { role: 'resident', search: '?type=' + type, formData: type === 'general' ? { comment: 'Useful information' } : { category: 'Drainage', description: 'Clear drain', location_label: 'Fixture road' }, transport: async (_, options) => { calls.push(structuredClone(options)); throw { code: 'NETWORK', message: 'lost reply' }; } });
  if (type === 'general') p.rating.events.click();
  const form = p.main.querySelector('#feedback-form');
  await form.events.submit({ ...event, currentTarget: form }); await form.events.submit({ ...event, currentTarget: form });
  assert.equal(calls.length, 2); assert.ok(calls[0].headers?.['Idempotency-Key']); assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(Object.keys(calls[0].body).sort(), type === 'general' ? ['comment', 'rating', 'type'] : ['category', 'description', 'location', 'type']);
  if (type === 'general') assert.equal(calls[0].body.rating, 4);
  p.reauthenticate(); await form.events.submit({ ...event, currentTarget: form }); assert.equal(calls.length, 2);
});
test('original feedback picker uses scoped eligible options and retains record revision', async () => {
  const calls = [], row = { id: 12, type: 'complaint', description: 'Drain', category: 'Drainage', status: 'Pending', revision: 4, created_at: '2026-11-06T08:00:00Z' };
  const p = await page('official-feedback.js', { feedback: [row], transport: async (path, options) => { calls.push([path, structuredClone(options)]); if (path.endsWith('assignment-options')) return { data: { feedback_revision: 4, tanods: [{ id: 42, full_name: 'Local Tanod' }] } }; throw { code: 'NETWORK', message: 'lost reply' }; } });
  const panel = p.main.querySelector('#feedback-complaint');
  await panel.querySelector('aside').querySelector('[data-assign]').events.click(); await settle();
  assert.ok(calls.some(([path]) => path.endsWith('assignment-options')), 'Picker must load scoped options instead of a seeded user ID');
  const body = p.dialogs[0].querySelector('[data-assignment]'); body.querySelector('select').value = '42';
  await body.querySelector('[data-save]').events.click(); await body.querySelector('[data-save]').events.click();
  const writes = calls.filter(([, o]) => o.method !== 'GET');
  assert.equal(writes.length, 2); assert.equal(writes[0][1].body.expected_revision, 4); assert.equal(writes[0][1].body.tanod_id, 42);
  assert.deepEqual(writes[0], writes[1]);
  p.reauthenticate(); await body.querySelector('[data-save]').events.click(); assert.equal(calls.filter(([, o]) => o.method !== 'GET').length, 2);
});
test('feedback resolution observes the selected revision and session before confirmation', async () => {
  const row = { id: 12, type: 'suggestion', description: 'Signs', category: 'Safety', status: 'Assigned', revision: 5, created_at: '2026-11-06T08:00:00Z' };
  const calls = [], p = await page('official-feedback.js', { search: '?type=suggestion', feedback: [row], transport: async (path, options) => { calls.push([path, options]); return { data: { ...row, status: 'Resolved' } }; } });
  await p.main.querySelector('#feedback-suggestion').querySelector('aside').querySelector('[data-resolve]').events.click();
  assert.equal(calls[0][1].body.expected_revision, 5);
  let changed;
  const stale = await page('official-feedback.js', { search: '?type=suggestion', feedback: [row], confirm: async () => { changed(); return true; }, transport: async () => { throw Error('Unexpected write'); } });
  changed = () => stale.reauthenticate();
  await stale.main.querySelector('#feedback-suggestion').querySelector('aside').querySelector('[data-resolve]').events.click();
  assert.ok(stale.errors.every(message => message !== 'Feedback marked resolved.'));
  assert.match(stale.main.querySelector('#feedback-suggestion').querySelector('aside').querySelector('[data-action-error]').textContent, /session changed/i);
});
test('changed feedback options never rebase the opening record revision', async () => {
  const row = { id: 12, type: 'complaint', description: 'Drain', category: 'Drainage', status: 'Pending', revision: 4, created_at: '2026-11-06T08:00:00Z' };
  const p = await page('official-feedback.js', { feedback: [row], transport: async () => ({ data: { feedback_revision: 5, tanods: [{ id: 42, full_name: 'Local Tanod' }] } }) });
  await p.main.querySelector('#feedback-complaint').querySelector('aside').querySelector('[data-assign]').events.click();
  assert.match(p.dialogs[0].querySelector('[data-assignment]').innerHTML, /feedback changed/);
});
test('demo announcement edit/retract still send their original revision', async () => {
  for (const action of ['edit', 'retract']) {
    const calls = [], p = await page('official-announcement-actions.js', { demo: true, transport: async (_, options) => { calls.push(options); return { data: { id: 3 } }; } });
    const row = { id: 3, title: 'Notice', content: 'Original', expires_at: null, revision: 7 };
    const el = action === 'edit' ? p.module.composeAnnouncement({ row, onSaved() {} }) : p.module.retractAnnouncement(row, () => {}), form = el.querySelector('form');
    form.elements.title.value = 'Notice'; form.elements.content.value = 'Original'; form.elements.reason.value = 'Correction';
    await form.events.submit(event);
    assert.equal(calls.length, 1, action + ' lost its demo revision guard'); assert.equal(calls[0].body.expected_revision, 7);
  }
});
async function announcementAction({ changedSession = false, demo = false, name = 'archive' } = {}) {
  const source = await readFile(new URL('../assets/js/pages/official-announcements.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function action('), end = source.indexOf('  function openMenu(', start);
  assert.ok(start >= 0 && end > start);
  let actor = { id: 2, barangay_id: 1, role: 'secretary', session_observation: 'opening' };
  const calls = [], errors = [], auth = { current: () => actor, roleOf: p => p.role };
  const context = vm.createContext({ Auth: auth, Store: { now: () => '2026-11-06T08:00:00Z' },
    Api: { announcements: { async get() { if (changedSession) actor = { ...actor, session_observation: 'new-login' }; return { id: 3, title: 'Notice', status: 'Active', expires_at: null, revision: 7 }; }, async archive(_, body) { calls.push(body); } } },
    createFormSubmission: options => { const form = createFormSubmission({ ...options, demo }); return { ...form, submit: (body, write) => form.submit(structuredClone(body), write) }; },
    announcementStatus: () => 'Active', UI: { confirm: async () => true, toast: message => errors.push(message) }, saved() {}, load() {},
    compose: () => calls.push('edit-opened'), retractAnnouncement: () => calls.push('retract-opened'),
  });
  const action = vm.runInContext('(' + source.slice(start, end).trim() + ')', context);
  await action({ id: 3 }, name);
  return { calls, errors };
}
test('original announcement menu action refuses re-login during its deferred initial read', async () => {
  for (const name of ['edit', 'archive', 'retract']) {
    const result = await announcementAction({ changedSession: true, name });
    assert.equal(result.calls.length, 0, name + ' accepted a new session during initial GET');
    assert.match(result.errors[0], /session changed/i);
  }
});
test('demo archive retains its selected record revision', async () => {
  assert.equal((await announcementAction({ demo: true })).calls[0].expected_revision, 7);
});
