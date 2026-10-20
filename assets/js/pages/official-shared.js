import { Auth } from '../core/auth.js';
import { Api } from '../core/api.js';
import { Store } from '../core/store.js';
import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
export { Auth, Api, Store, UI, Icons, Fmt };
export const e = UI.escape;
export const roleLabel = role => ({ secretary: 'Secretary', responder: 'Responder', rescuer: 'Rescuer' })[role] || 'Official';
// TODO(contract): enable each destination when its P1 implementation lands.
const ready = new Set(['official-dashboard.html']);
export const pageReady = href => ready.has(String(href).split('?')[0]);
export function destination(href, label, classes = '') {
  return pageReady(href) ? `<a class="btn ${classes}" href="${e(href)}">${e(label)}</a>` : `<button type="button" class="btn ${classes}" disabled title="This section is not available yet.">${e(label)}</button>`;
}
export function live(entities, render) {
  let running = false, queued = false, active = true;
  async function update() {
    if (!active) return;
    if (running) { queued = true; return; }
    running = true;
    try { await render(); } finally { running = false; if (queued && active) { queued = false; update(); } }
  }
  const offs = entities.map(entity => Api.subscribe(entity, update));
  window.addEventListener('pagehide', event => { if (event.persisted) return; active = false; offs.forEach(off => off()); }, { once: true });
  return update;
}
export function errorView(main, error, retry) {
  main.innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to load this page', text: error.message || 'Please try again.' }) + '<div class="actions"><button type="button" class="btn btn-primary" data-retry>Try again</button></div>';
  main.querySelector('[data-retry]').addEventListener('click', retry);
}
export function dialog(title, body, { sheet = true } = {}) {
  const el = document.createElement('dialog'); el.className = sheet ? 'sheet official-dialog' : 'official-dialog'; el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="dialog-head"><h2>${e(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${Icons.svg('x')}</button></div>${body}`;
  el.querySelector('[data-close]').addEventListener('click', () => UI.closeDialog(el));
  el.addEventListener('close', () => el.remove(), { once: true }); document.body.append(el); UI.openDialog(el); return el;
}
