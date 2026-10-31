// Exercise the real Report page module with isolated browser/API boundaries.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

async function run() {
  const model = await import('../assets/js/pages/resident-report-model.js');
  const { UI } = await import('../assets/js/core/ui.js');
  const { Fmt } = await import('../assets/js/core/format.js');
  const { Icons } = await import('../assets/js/core/icons.js');
  const source = await readFile(new URL('../assets/js/pages/resident-report.js', import.meta.url), 'utf8');
  const settle = async () => { for (let n = 0; n < 8; n++) await new Promise(resolve => setImmediate(resolve)); };
  async function load({ status = null, search = '', approved = true, reused = false } = {}) {
    const elements = new Map(), maps = [], redirects = [], errors = [];
    const household = { address: '14 Riverside Street', map_x: 0, map_y: 100 };
    const user = { id: 4, barangay_id: 1, household };
    const state = { alert: status ? { id: 1045, status, alert_type: 'Other', household } : null, creates: 0 };
    const main = { classList: { add() {} }, innerHTML: '', querySelectorAll: () => [], querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { value: '1', checked: true, disabled: false, addEventListener(type, fn) { this[type] = fn; }, setAttribute() {} });
      return elements.get(selector);
    } };
    const location = { search, href: '', replace(url) { redirects.push(url); } };
    const Api = {
      barangays: { list: async () => [{ id: 1, name: 'Barangay Sampaguita' }] },
      alerts: {
        list: async () => state.alert ? [state.alert] : [],
        get: async id => { if (!state.alert || id !== state.alert.id) throw new Error('Alert unavailable'); return state.alert; },
        create: async () => { state.creates++; state.alert = { id: 1046, status: 'Pending', alert_type: 'Other', household, map_x: 0, map_y: 100 }; return { ...state.alert, was_created: !reused }; },
      },
    };
    const shared = {
      Auth: { requireRole() {}, current: () => user }, Api, UI, Fmt, e: UI.escape, icon: Icons.svg,
      BCMap: { mount: (target, options) => { maps.push(options); return { destroy() {}, setMarkers() {} }; } },
      heading: (title, subtitle) => `<header><h1>${UI.escape(title)}</h1><p>${UI.escape(subtitle)}</p></header>`,
      tile: name => Icons.svg(name), field: () => '', textarea: () => '',
      link: (href, label) => `<a href="${href}">${label}</a>`,
      busy: async (button, task) => task(), errorView: (main, error) => errors.push(error.message),
      householdUser: async () => user, verificationFor: async () => ({ review_status: approved ? 'Approved' : 'Pending' }),
      baseMarkers: () => [{ id: 'home', kind: 'own_household', x: 0, y: 100 }],
    };
    const context = vm.createContext({ URLSearchParams, location, history: { replaceState(a, b, url) { location.search = new URL(url, 'http://localhost').search; } }, window: { addEventListener() {} } });
    const page = new vm.SourceTextModule(source, { context });
    await page.link(specifier => {
      const values = specifier.endsWith('resident-shared.js') ? shared : specifier.endsWith('shell-resident.js') ? { Shell: { resident: () => main } } : specifier.endsWith('icons.js') ? { Icons } : model;
      return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
    });
    await page.evaluate(); await settle();
    return { main, state, maps, redirects, errors, location, async click(selector) { await main.querySelector(selector).click?.({ currentTarget: main.querySelector(selector) }); await settle(); } };
  }
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
  await check('A second-tab submission reused by the API opens status instead of replaying confirmation', async () => {
    const f = await load({ reused: true }); await f.click('#send');
    assert.deepEqual(f.redirects, ['resident-alert.html?id=1046']);
    assert.doesNotMatch(f.main.innerHTML, /Your SOS is now Pending/);
  });
  await check('Report navigation opens every own active SOS directly without creating another record', async () => {
    for (const status of ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress']) {
      const f = await load({ status });
      assert.deepEqual(f.redirects, ['resident-alert.html?id=1045']);
      assert.doesNotMatch(f.main.innerHTML, /You have an active SOS/);
      assert.equal(f.state.creates, 0); assert.deepEqual(f.errors, []);
    }
  });
  await check('Existing Pending and Resolved links open status; active details remain available', async () => {
    for (const status of ['Pending', 'Resolved']) {
      const f = await load({ status, search: '?id=1045' });
      assert.deepEqual(f.redirects, ['resident-alert.html?id=1045']);
    }
    const details = await load({ status: 'Pending', search: '?step=details&id=1045' });
    assert.match(details.main.innerHTML, /Add details to A-1045/); assert.deepEqual(details.redirects, []); assert.deepEqual(details.errors, []);
    const resolved = await load({ status: 'Resolved', search: '?step=details&id=1045' });
    assert.deepEqual(resolved.redirects, ['resident-alert.html?id=1045']);
  });
  await check('Unverified residents stay locked and malformed/foreign links cannot display success', async () => {
    const locked = await load({ status: 'Pending', approved: false });
    assert.match(locked.main.innerHTML, /SOS is locked/); assert.deepEqual(locked.redirects, []);
    for (const search of ['?id=bad', '?id=9999']) {
      const f = await load({ status: 'Pending', search });
      assert.equal(f.errors.length, 1); assert.doesNotMatch(f.main.innerHTML, /Your SOS is now Pending/);
    }
  });
  await check('A new submission shows the two confirmation cards, actual ID and saved edge pin', async () => {
    const f = await load(); assert.match(f.main.innerHTML, /Send an SOS alert/);
    await f.click('#send');
    assert.match(f.main.innerHTML, /Alert sent/); assert.match(f.main.innerHTML, /Your SOS is now Pending/);
    assert.match(f.main.innerHTML, /A-1046/); assert.match(f.main.innerHTML, /What happens next/);
    assert.match(f.main.innerHTML, /14 Riverside Street/); assert.deepEqual(f.errors, []);
    assert.equal(f.state.creates, 1);
    assert.ok(f.maps.at(-1).markers.some(m => m.kind === 'own_household' && m.x === 0 && m.y === 100));
    await f.click('#view-status'); assert.equal(f.location.href, 'resident-alert.html?id=1046');
    const added = await load(); await added.click('#send'); await added.click('#add-details');
    assert.match(added.main.innerHTML, /Add details to A-1046/); assert.deepEqual(added.errors, []);
  });
  console.log(`${passed} resident SOS page regression tests passed.`);
}

if (typeof vm.SourceTextModule !== 'function') {
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} else {
  try { await run(); } catch (error) { console.error(error); process.exitCode = 1; }
}
