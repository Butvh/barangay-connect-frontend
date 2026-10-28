// Run from any directory: node /path/to/repository/tests/facility-pages.mjs
// Executes the real resident page modules; fixtures replace browser/API boundaries.
// These checks complement browser QA; they do not simulate layout or map geometry.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = fileURLToPath(import.meta.url);
const pageUrl = name => new URL(`../assets/js/pages/${name}`, import.meta.url);

// A small DOM fixture parses rendered markup, replaces descendants on innerHTML
// writes, and uses real EventTarget/once semantics. Detached map nodes therefore
// cannot make a page appear to recover after its error view replaces the layout.
class Element extends EventTarget {
  constructor(tagName = 'div', attributes = {}) {
    super();
    this.tagName = tagName;
    this.attributes = attributes;
    this.children = [];
    this.dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.classList = { add() {} };
    this.value = attributes.value || '';
    this.hidden = Object.hasOwn(attributes, 'hidden');
  }
  set innerHTML(markup) {
    this.markup = markup;
    this.children = [];
    const stack = [this];
    for (const match of markup.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)) {
      if (match[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const attributes = {};
      for (const attribute of match[2].matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        attributes[attribute[1]] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
      }
      const child = new Element(match[1].toLowerCase(), attributes);
      stack.at(-1).children.push(child);
      if (!['area', 'br', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr'].includes(child.tagName)) stack.push(child);
    }
  }
  get innerHTML() { return this.markup || ''; }
  querySelectorAll(selector) {
    const matches = element => selector.startsWith('#') ? element.attributes.id === selector.slice(1)
      : selector.startsWith('[') ? Object.hasOwn(element.attributes, selector.slice(1, -1))
        : element.tagName === selector;
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  click() { this.dispatchEvent(new Event('click')); }
  close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  }
}

function pageFixture({ mobile = false } = {}) {
  const main = new Element('main'), dialogs = [], maps = [], errors = [], pending = new Set(), subscriptions = new Map();
  const resident = { id: 4, full_name: 'Maria Santos', barangay_id: 1, household: { id: 1, address: '14 Riverside Street', map_x: 67, map_y: 53 } };
  const facility = { id: 1, type: 'EvacuationCenter', name: 'Sampaguita Elementary School', address: 'School Road', capacity: 250, contact: '(02) 8000-0000', status: 'Active', barangay_id: 1, map_x: 35, map_y: 25 };
  const state = { facilities: [facility], failRead: false };
  const track = promise => {
    const job = Promise.resolve(promise);
    pending.add(job);
    job.then(() => pending.delete(job), () => pending.delete(job));
    return job;
  };
  const subscribe = (entity, callback) => {
    if (!subscriptions.has(entity)) subscriptions.set(entity, new Set());
    subscriptions.get(entity).add(callback);
    return () => subscriptions.get(entity).delete(callback);
  };
  const dialog = (title, markup) => {
    const element = new Element('dialog');
    element.title = title;
    element.innerHTML = markup;
    element.open = true;
    dialogs.push(element);
    return element;
  };
  const Api = {
    subscribe,
    facilities: { list: async () => {
      if (state.failRead) throw new Error('Injected facility read failure');
      return structuredClone(state.facilities.filter(row => row.status !== 'Inactive'));
    } },
    alerts: { list: async () => [] },
    announcements: { list: async () => [] },
    barangays: { list: async () => [{ id: 1, name: 'Barangay Sampaguita' }] },
  };
  const BCMap = { mount(container, options) {
    assert.ok(container, 'A map must mount into a currently rendered container');
    const map = {
      container, markers: options.markers, destroyed: false,
      select(id) { this.selected = id; },
      setMarkers(rows) { this.markers = rows; },
      destroy() { this.destroyed = true; container.innerHTML = ''; },
      choose(id) {
        const marker = this.markers.find(row => row.id === id);
        assert.ok(marker, `Expected selectable map marker ${id}`);
        options.onSelect(marker);
      },
    };
    maps.push(map);
    return map;
  } };
  const shared = {
    Auth: { requireRole() {}, current: () => resident }, Api, BCMap,
    UI: { skeleton: () => '', badge: value => value, empty: ({ title, text }) => `<h3>${title}</h3><p>${text || ''}</p>` },
    Fmt: { date: String, dateTime: String, short: String }, Icons: { disaster: () => '' },
    e: String, icon: () => '', heading: title => `<h1>${title}</h1>`, tile: () => '', link: () => '', dialog,
    householdUser: async () => resident, verificationFor: async () => ({ review_status: 'Approved' }),
    // Availability/geometry rules are covered by the domain tests; this fixture
    // supplies the actual shape of their public map projection to the page.
    baseMarkers: (_, facilities) => [{ id: 'hall', kind: 'hall', label: 'Barangay hall' }, ...facilities.map(record => ({
      id: `facility-${record.id}`, kind: record.type === 'Hospital' ? 'hospital' : 'evacuation',
      x: record.map_x, y: record.map_y, label: record.name, record,
    }))],
    alertLabel: alert => `A-${alert.id}`,
    live: (entities, render) => {
      const update = () => track(render());
      entities.forEach(entity => subscribe(entity, update));
      return update;
    },
    errorView: (host, error, retry) => {
      errors.push(error);
      host.innerHTML = '<p role="alert">Unable to load this page</p><button data-retry>Try again</button>';
      host.querySelector('[data-retry]').addEventListener('click', () => track(retry()));
    },
  };
  const boundaries = {
    './resident-shared.js': shared,
    '../core/shell-resident.js': { Shell: { resident: () => main } },
    './resident-runtime.js': { Store: { now: () => '2026-10-28T12:00:00+08:00' } },
    './resident-dashboard-model.js': { latestHomeAnnouncement: () => null },
  };
  const context = vm.createContext({
    console, URLSearchParams, location: { search: '' },
    matchMedia: () => ({ matches: mobile }), window: new EventTarget(), document: new EventTarget(),
    clearTimeout, setTimeout,
  });
  return {
    main, dialogs, maps, errors, state,
    async mount(source, name) {
      const module = new vm.SourceTextModule(source, { context, identifier: pageUrl(name).href });
      await module.link(specifier => {
        const values = boundaries[specifier];
        assert.ok(values, `Declare fixture boundary for ${specifier}`);
        return new vm.SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context, identifier: specifier });
      });
      await module.evaluate();
      await this.flush();
    },
    async flush() { while (pending.size) await Promise.all([...pending]); },
    async emit(entity) {
      for (const callback of [...subscriptions.get(entity) || []]) track(callback());
      await this.flush();
    },
  };
}

export async function runFacilityPageTests({ readPage = name => readFile(pageUrl(name), 'utf8') } = {}) {
  let passed = 0, failed = 0;
  const test = async (name, run) => {
    try { await run(); passed++; console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack}`); }
  };
  const load = async (name, options) => {
    const fixture = pageFixture(options);
    await fixture.mount(await readPage(name), name);
    assert.equal(fixture.errors.length, 0, 'Initial page load must succeed before exercising the regression');
    return fixture;
  };

  await test('Resident map Retry restores a usable map after a failed live refresh', async () => {
    const f = await load('resident-map.js', { mobile: true });
    assert.ok(f.main.querySelector('#map'));
    f.state.failRead = true;
    await f.emit('facilities');
    assert.equal(f.errors.at(-1).message, 'Injected facility read failure');
    assert.ok(f.main.querySelector('[data-retry]'), 'A failed refresh must offer Retry');
    f.state.failRead = false;
    f.main.querySelector('[data-retry]').click();
    await f.flush();
    assert.equal(f.main.querySelector('[data-retry]'), null, 'Successful Retry must leave the error view');
    assert.ok(f.main.querySelector('#map'), 'Successful Retry must restore the map layout');
    assert.equal(f.errors.length, 1, 'Retry must not fail against detached DOM nodes');
    f.maps.at(-1).choose('facility-1');
    assert.ok(f.dialogs.at(-1).open, 'The recovered map must still open facility details');
    assert.match(f.dialogs.at(-1).innerHTML, /Sampaguita Elementary School/);
  });

  await test('Successful facility refresh keeps the current map and updates its selected details', async () => {
    const f = await load('resident-map.js');
    const map = f.maps.at(-1);
    map.choose('facility-1');
    f.state.facilities[0] = { ...f.state.facilities[0], name: 'Updated evacuation center', address: 'Updated address' };
    await f.emit('facilities');
    assert.equal(f.maps.length, 1, 'An ordinary refresh must retain the map instance and its zoom/pan state');
    assert.equal(map.destroyed, false);
    assert.match(f.main.querySelector('#nearby').innerHTML, /Updated evacuation center/);
    assert.match(f.main.querySelector('#nearby').innerHTML, /Updated address/);
  });

  await test('Mobile facility sheet closes when its destination becomes inactive', async () => {
    const f = await load('resident-map.js', { mobile: true });
    const map = f.maps.at(-1);
    map.choose('facility-1');
    const sheet = f.dialogs.at(-1);
    assert.ok(sheet.open);
    assert.match(sheet.innerHTML, /Sampaguita Elementary School/);
    f.state.facilities[0].status = 'Inactive';
    await f.emit('facilities');
    assert.equal(sheet.open, false, 'The visible sheet must stop presenting a deactivated destination');
    assert.equal(map.markers.some(marker => marker.id === 'facility-1'), false);
    assert.doesNotMatch(f.main.querySelector('#nearby').innerHTML, /Sampaguita Elementary School/);
    f.state.facilities[0].status = 'Active';
    await f.emit('facilities');
    map.choose('facility-1');
    assert.ok(f.dialogs.at(-1).open, 'Reactivated destinations must remain accessible');
  });

  await test('Emergency contacts closes on facility changes and reopens with current public information', async () => {
    const f = await load('resident-dashboard.js');
    f.main.querySelector('#contacts').click();
    const contacts = f.dialogs.at(-1);
    assert.ok(contacts.open);
    assert.match(contacts.innerHTML, /Sampaguita Elementary School/);
    f.state.facilities[0].status = 'Inactive';
    await f.emit('facilities');
    assert.equal(contacts.open, false, 'The open emergency panel must not retain a deactivated facility');
    f.main.querySelector('#contacts').click();
    assert.ok(f.dialogs.at(-1).open);
    assert.doesNotMatch(f.dialogs.at(-1).innerHTML, /Sampaguita Elementary School/);
  });

  console.log(`${passed} facility page regression tests passed, ${failed} failed.`);
  return { passed, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === here) {
  if (typeof vm.SourceTextModule !== 'function') {
    // Keep the package-free command usable on Node 20–24. Only this test child
    // needs VM modules; suppress their expected experimental API warning.
    const child = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', here], { stdio: 'inherit' });
    if (child.error) console.error(child.error.message);
    process.exitCode = child.status ?? 1;
  } else {
    const result = await runFacilityPageTests();
    if (result.failed) process.exitCode = 1;
  }
}
