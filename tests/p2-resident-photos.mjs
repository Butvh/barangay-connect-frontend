import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { UI } from '../assets/js/core/ui.js';
import { Fmt } from '../assets/js/core/format.js';
import { Icons } from '../assets/js/core/icons.js';
import { responseProgress } from '../assets/js/pages/resident-report-model.js';
import { facilityActive } from '../assets/js/core/facilities.js';

// The P1-owned helper is read unchanged from the exact owner composition.
const helper = await readFile(new URL('../assets/js/core/incident-photos.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../assets/js/pages/resident-alert.js', import.meta.url), 'utf8');
async function render({ enabled = true, access = true, photos = [{ id: 9, mime: 'image/png', bytes: 42 }], denied = false } = {}) {
  const main = { innerHTML: '', classList: { add() {} }, querySelector() { return {}; } };
  const context = vm.createContext({ URLSearchParams, location: { search: '?id=1' }, window: { addEventListener() {} } });
  const gallery = new vm.SourceTextModule(helper, { context });
  await gallery.link(() => new vm.SyntheticModule(['Runtime'], function () { this.setExport('Runtime', { mode: 'backend', operationalTest: enabled, photoTest: enabled }); }, { context }));
  await gallery.evaluate();
  const shared = { Auth: { requireRole() {}, current: () => ({ id: 1, barangay_id: 1 }) }, Api: { alerts: { async get() { if (denied) throw Error('Unavailable'); return { id: 1, status: 'Resolved', reported_at: '2026-11-05T01:00:00Z', photos, photo_access: access }; } } },
    UI, Fmt, e: UI.escape, icon: Icons.svg, tile: () => '', link: () => '', safety: () => '', live: (_, work) => work,
    errorView() { main.innerHTML = 'Unavailable'; }, BCMap: { mount: () => ({ destroy() {} }) } };
  const page = new vm.SourceTextModule(source, { context });
  await page.link(specifier => {
    if (specifier.endsWith('incident-photos.js')) return gallery;
    const values = specifier.endsWith('resident-shared.js') ? shared : specifier.endsWith('resident-report-model.js') ? { responseProgress } : specifier.endsWith('facilities.js') ? { facilityActive } : { Shell: { resident: () => main } };
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await page.evaluate();
  for (let n = 0; n < 4; n++) await new Promise(resolve => setImmediate(resolve));
  return main.innerHTML;
}
assert.match(await render(), /\/api\/v1\/incident-photos\/9\/download/);
assert.match(await render(), /<img/);
for (const options of [{ enabled: false }, { access: false }, { photos: [] }, { denied: true }]) assert.doesNotMatch(await render(options), /incident-photo-grid|<img/);
const malicious = await render({ photos: [{ id: '9" onerror="evil', mime: 'image/png', bytes: 42, upload_id: 'private-token', object_key: 'private/path' }, { id: 3, mime: 'text/html', bytes: 42 }] });
assert.doesNotMatch(malicious, /<img|private-token|private\/path|onerror|text\/html/);
console.log('PASS actual resident alert uses the existing safe P1 gallery for authorized resolved history; gated/empty/denied/invalid references render no private image');
