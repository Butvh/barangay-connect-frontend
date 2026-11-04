import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Execute the original submit listener; the boundary pauses staging while real form state changes.
const source = await readFile(new URL('../assets/js/pages/resident-report.js', import.meta.url), 'utf8');
const line = source.split('\n').find(value => value.startsWith("main.querySelector('#details').addEventListener('submit',"));
assert.ok(line, 'Original details submission listener must remain testable.');
const listener = line.slice(line.indexOf('async evt=>'), line.lastIndexOf(');'));
let release, began;
const staged = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { began = resolve; });
const draft = { description: 'Original description', location_label: 'Original location' }, writes = [];
const initialFile = new File(['fictional bytes'], 'original.png', { type: 'image/png' });
const context = vm.createContext({
  main: { querySelector: () => ({}) }, FormData: class { constructor() { this.values = { ...draft }; } get(name) { return this.values[name]; } },
  busy: async (_, work) => work(), notSure: { checked: false }, victims: { value: '1' },
  photoEnabled: true, photo: initialFile, type: 'Fire', point: { x: 10, y: 10 }, pinKnown: true,
  uploadPhoto: { async stage(file) { assert.equal(file, initialFile); began(); return staged; } },
  submission: { async submit(body, write) { writes.push(body); await write(body, { idempotencyKey: 'original-details-key' }); } },
  Api: { alerts: { stagePhoto() {}, addDetails: async () => ({ id: 7 }) } },
  Config: { DEMO_MODE: false }, a: { photo_name: null }, id: 7, goStatus() {},
});
const submit = vm.runInContext(listener, context);
const pending = submit({ preventDefault() {}, currentTarget: {} });
await ready;
draft.description = 'Changed description'; draft.location_label = 'Changed location';
context.type = 'Flood'; context.point.x = 99; context.point.y = 99; context.victims.value = '8';
context.photo = new File(['changed bytes'], 'changed.png', { type: 'image/png' });
release({ upload_id: '11111111-1111-4111-8111-111111111111' }); await pending;
assert.equal(writes.length, 1);
assert.deepEqual(structuredClone(writes[0]), { alert_type: 'Fire', description: 'Original description', location_label: 'Original location',
  map_x: 10, map_y: 10, victim_count: 1, upload_ids: ['11111111-1111-4111-8111-111111111111'] });
console.log('PASS original details listener freezes the entire draft/file before asynchronous staging');
