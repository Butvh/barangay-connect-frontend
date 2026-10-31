// Run the real page controllers against isolated browser/API boundaries.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

async function run() {
  const model = await import('../assets/js/pages/official-verification-model.js');
  const { UI } = await import('../assets/js/core/ui.js');
  const { Fmt } = await import('../assets/js/core/format.js');
  const { Icons } = await import('../assets/js/core/icons.js');
  const settle = async () => { for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve)); };
  const base = { id: 2, user_id: 5, review_status: 'Pending', revision: 0, document_type: 'Proof', file_name: 'original.pdf', submitted_at: '2026-10-04T09:00:00+08:00', deadline_at: '2026-10-11T09:00:00+08:00', resident: { full_name: 'Jose Dela Cruz' }, household: { address: '8 Mabini Street' } };
  function surface() {
    const elements = new Map();
    function element(selector) {
      if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', value: '', dataset: {}, hidden: false, disabled: false, listeners: {}, setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; }, focus() { this.focused = true; }, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelector: element, querySelectorAll: () => ['[data-approve]', '[data-request-resubmission]', '[data-reject]'].map(element) });
      return elements.get(selector);
    }
    const main = element('main'); element('form').elements = { reason: element('#rejection-reason') };
    return { main, element, elements, async event(selector, type, extra = {}) { await element(selector).listeners[type]?.({ preventDefault() {}, currentTarget: element(selector), target: element(selector), ...extra }); await settle(); } };
  }
  async function page(name, shared, f, extra = {}) {
    const source = await readFile(new URL(`../assets/js/pages/${name}.js`, import.meta.url), 'utf8');
    const context = vm.createContext({ URLSearchParams, location: f.location, document: { querySelector: selector => ['#app', '#main'].includes(selector) ? f.main : f.element(selector), querySelectorAll: () => [], addEventListener() {} }, window: { addEventListener() {}, scrollTo() {} }, setInterval: () => 1, clearInterval() {}, ...extra });
    const module = new vm.SourceTextModule(source, { context });
    await module.link(async specifier => {
      let values;
      if (specifier.endsWith('shared.js')) values = shared;
      else if (specifier.endsWith('shell-official.js')) values = { Shell: { official: () => f.main } };
      else if (specifier.endsWith('verification-history.js')) values = await import('../assets/js/pages/verification-history.js');
      else values = model;
      return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
    });
    await module.evaluate(); await settle();
  }
  async function official(row = base) {
    const f = surface(), state = { row: structuredClone(row), reviews: [], confirmations: [], confirmed: false, destinations: [] };
    f.location = { search: '?id=2', assign: url => state.destinations.push(url) };
    const Api = { verification: { get: async () => structuredClone(state.row), expireOverdue: async () => 0, review: async (id, input) => { state.reviews.push({ id, ...input }); } }, barangays: { list: async () => [{ id: 1, name: 'Barangay Sampaguita' }] } };
    const shared = { Auth: { requireRole() {}, current: () => ({ id: 1, barangay_id: 1 }), logout() {} }, Api, Store: { now: () => '2026-10-04T14:20:00+08:00' }, UI: { ...UI, confirm: async input => { state.confirmations.push(input); return state.confirmOverride ? state.confirmOverride() : state.confirmed; } }, Icons, Fmt, e: UI.escape, facts: () => '', live: (entities, fn) => { state.refresh = fn; return fn; } };
    await page('official-verification', shared, f);
    return { ...f, state };
  }
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
  await check('Pending verification restores three balanced actions and shared notes copy', async () => {
    const f = await official();
    assert.match(f.main.innerHTML, /Reason or notes/); assert.match(f.main.innerHTML, /Request resubmission/);
    assert.ok(f.main.innerHTML.indexOf('data-approve') < f.main.innerHTML.indexOf('data-request-resubmission'));
    assert.ok(f.main.innerHTML.indexOf('data-request-resubmission') < f.main.innerHTML.indexOf('data-reject'));
    for (const key of ['[data-approve]', '[data-request-resubmission]', '[data-reject]']) assert.equal(f.element(key).disabled, false);
  });
  await check('Missing correction reason focuses the existing notes field and sends no request', async () => {
    const f = await official(); f.element('#rejection-reason').value = '  ';
    await f.event('[data-request-resubmission]', 'click');
    assert.match(f.element('#reason-error').textContent, /reason/i); assert.equal(f.element('#rejection-reason').focused, true);
    assert.equal(f.state.confirmations.length, 0); assert.equal(f.state.reviews.length, 0);
  });
  await check('Cancel preserves the note; Confirm sends the distinct decision and captured document revision', async () => {
    const f = await official(); f.element('#rejection-reason').value = '  Upload a readable address.  ';
    await f.event('[data-request-resubmission]', 'click');
    assert.equal(f.state.reviews.length, 0); assert.equal(f.element('#rejection-reason').value, '  Upload a readable address.  ');
    const modal = f.state.confirmations[0]; assert.equal(modal.title, 'Request document resubmission?'); assert.equal(modal.confirmLabel, 'Confirm request');
    assert.match(modal.text, /Jose Dela Cruz/); assert.match(modal.text, /Upload a readable address/); assert.match(modal.text, /notified/);
    f.state.confirmed = true; await f.event('[data-request-resubmission]', 'click');
    assert.deepEqual(f.state.reviews.map(r => ({ ...r })), [{ id: 2, decision: 'Resubmission requested', reason: 'Upload a readable address.', expected_revision: 0 }]);
    assert.match(f.state.destinations[0], /notice=Resubmission\+requested/);
  });
  await check('Live updates during confirmation cannot silently approve a replacement submission', async () => {
    const f = await official(); f.element('#rejection-reason').value = 'Replace proof.';
    f.state.confirmOverride = async () => { f.state.row.revision = 2; await f.state.refresh(); return true; };
    await f.event('[data-request-resubmission]', 'click');
    assert.equal(f.state.reviews[0].expected_revision, 0);
  });
  await check('Approved, Rejected and awaiting-correction details remain read-only', async () => {
    for (const review_status of ['Approved', 'Rejected', 'Resubmission requested']) {
      const f = await official({ ...base, review_status });
      for (const key of ['[data-approve]', '[data-request-resubmission]', '[data-reject]', '#rejection-reason']) assert.equal(f.element(key).disabled, true);
      await f.event('[data-request-resubmission]', 'click'); assert.equal(f.state.reviews.length, 0);
    }
  });
  await check('Approve and Reject retain separate decisions and reason requirements', async () => {
    const f = await official(); await f.event('[data-approve]', 'click');
    assert.equal(f.state.reviews[0].decision, 'Approved'); assert.equal(f.state.reviews[0].expected_revision, 0);
    const rejected = await official(); await rejected.event('form', 'submit'); assert.equal(rejected.state.reviews.length, 0);
    rejected.element('#rejection-reason').value = 'Not proof of residency.'; rejected.state.confirmed = true; await rejected.event('form', 'submit');
    assert.equal(rejected.state.reviews[0].decision, 'Rejected'); assert.equal(rejected.state.reviews[0].reason, 'Not proof of residency.');
  });
  await check('Correction upload uses the existing application and revision; invalid replacement cannot leave an old file selected', async () => {
    const f = surface(), calls = [], errors = [];
    f.location = { search: '?resubmit=1', href: '' };
    const shared = { Auth: { requireRole() {}, current: () => ({ id: 5, barangay_id: 1 }) }, Api: { barangays: { list: async () => [{ id: 1, name: 'Barangay Sampaguita' }] }, verification: { list: async () => [{ ...base, revision: 1, review_status: 'Resubmission requested', resubmission_reason: 'Show the full address.' }], submit: async (id, input) => calls.push({ id, ...input }) } }, UI: { ...UI, toast: message => errors.push(message) }, e: UI.escape, icon: Icons.svg, heading: (title, text) => title + text, field: () => '', tile: () => '', link: () => '', dialog: () => '', busy: async (button, fn) => fn() };
    await page('register', shared, f);
    assert.match(f.main.innerHTML, /Show the full address/);
    const choose = async (selector, file) => f.event(selector, 'change', { target: { files: [file], value: '' } });
    const good = name => ({ name, type: 'application/pdf', size: 42 });
    await choose('#valid-id', good('corrected-id.pdf')); await choose('#proof', good('proof.pdf'));
    await choose('#proof', { name: 'bad.exe', type: 'application/octet-stream', size: 42 });
    await f.event('#documents', 'submit'); assert.equal(calls.length, 0); assert.match(errors.at(-1), /both/);
    await choose('#proof', good('corrected-proof.pdf')); await f.event('#documents', 'submit');
    assert.equal(calls.length, 1); assert.equal(calls[0].verification_id, 2); assert.equal(calls[0].expected_revision, 1); assert.equal(calls[0].file_name, 'corrected-id.pdf; corrected-proof.pdf'); assert.equal(f.location.href, 'resident-verification.html');
  });
  console.log(`${passed} verification page regression tests passed.`);
}
if (typeof vm.SourceTextModule !== 'function') {
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' }); process.exitCode = result.status ?? 1;
} else { try { await run(); } catch (error) { console.error(error); process.exitCode = 1; } }
