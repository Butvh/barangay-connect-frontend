import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createSubmissionIntent } from '../assets/js/adapters/submission-intent.js';
import { createFormSubmission, configureOperationalSubmissions } from '../assets/js/adapters/p2-form-intent.js';
import { createOperations } from '../assets/js/adapters/operations.js';
import { UI } from '../assets/js/core/ui.js';
import { Icons } from '../assets/js/core/icons.js';
import { Fmt } from '../assets/js/core/format.js';
import { RESPONSE_TYPES } from '../assets/js/core/alertMachine.js';
import { facilityActive } from '../assets/js/core/facilities.js';
configureOperationalSubmissions({ createSubmissionIntent });

export function element() {
  const children = new Map();
  return { open: true, isConnected: true, dataset: {}, classList: { add() {} }, elements: {}, value: '', hidden: false,
    addEventListener(type, fn) { (this.events ||= {})[type] = fn; },
    querySelector(selector) { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
    querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, focus() {},
  };
}
export async function load(file, { request, role = 'responder', user = null, api: externalApi = null, facilities = null } = {}) {
  const dialogs = [], auth = { current: () => user || ({ id: 3, barangay_id: 1, role, full_name: 'Fixture' }), roleOf: value => value.role };
  const api = externalApi || createOperations({ request });
  const shared = { Auth: auth, Api: { ...api, subscribe: () => () => {}, facilities: { list: async () => facilities || [{ id: 17, name: 'Fixture shelter', type: 'Evacuation Center', active: true, is_active: true }] } },
    UI: { ...UI, confirm: async () => true, toast() {}, closeDialog(el) { el.open = false; el.events?.close?.(); } }, Icons, Fmt,
    Store: { now: () => '2026-11-03T10:00:00Z' }, e: UI.escape, roleLabel: value => value, alertName: () => 'Fixture alert', facts: () => '', facilityType: () => 'Shelter', facilityDetail: () => '',
    dialog() { const el = element(); dialogs.push(el); el.querySelector('form').elements.emergency_override = Object.assign(element(), { checked: false }); const choice = element(); choice.dataset.facility = String(facilities?.[0]?.id || 17); el.querySelectorAll = selector => selector === '[data-facility]' ? [choice] : []; el.choice = choice; return el; },
  };
  const context = vm.createContext({ setInterval: () => 1, clearInterval() {}, FormData: class { constructor(form) { this.form = form; } get(name) { return this.form.elements[name]?.value || ''; } } });
  const module = new vm.SourceTextModule(await readFile(new URL('../assets/js/pages/' + file, import.meta.url), 'utf8'), { context });
  await module.link(specifier => {
    const values = specifier.endsWith('official-shared.js') ? shared : specifier.endsWith('alertMachine.js') ? { RESPONSE_TYPES } : specifier.endsWith('facilities.js') ? { facilityActive } : specifier.endsWith('config.js') ? { Config: { DEMO_MODE: false } } : specifier.endsWith('p2-form-intent.js') ? { createFormSubmission: options => { const form = createFormSubmission({ ...options, demo: false }); return { ...form, submit: (input, write) => form.submit(structuredClone(input), write) }; } } : { assignmentCards: () => '' };
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { module: module.namespace, dialogs };
}
