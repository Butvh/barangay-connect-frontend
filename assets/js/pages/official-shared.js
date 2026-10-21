import { Auth } from '../core/auth.js';
import { Api } from '../core/api.js';
import { Store } from '../core/store.js';
import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
export { Auth, Api, Store, UI, Icons, Fmt };
export const e = UI.escape;
// Revalidate per-tab auth and data after a browser back/forward-cache restore.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
export const roleLabel = role => ({ secretary: 'Secretary', responder: 'Responder', rescuer: 'Rescuer' })[role] || 'Official';
// TODO(contract): enable each destination when its P1 implementation lands.
const ready = new Set(['official-dashboard.html', 'official-alerts.html', 'official-alert.html']);
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
export function dialog(title, body, { sheet = true, beforeClose } = {}) {
  const el = document.createElement('dialog'); el.className = sheet ? 'sheet official-dialog' : 'official-dialog'; el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="dialog-head"><h2>${e(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${Icons.svg('x')}</button></div>${body}`;
  const close = async () => { if (!beforeClose || await beforeClose()) UI.closeDialog(el); };
  el.querySelector('[data-close]').addEventListener('click', close);
  if (beforeClose) {
    el.addEventListener('cancel', event => { event.preventDefault(); close(); });
    el.addEventListener('click', event => { if (event.target !== el) return; const r = el.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) { event.stopImmediatePropagation(); close(); } }, true);
  }
  el.addEventListener('close', () => el.remove(), { once: true }); document.body.append(el); UI.openDialog(el); return el;
}

export const typeIcon = type => Icons.disaster(type);
export const alertName = a => `${Fmt.alertId(a.id)} · ${a.alert_type}${a.incident_name ? ` · ${a.incident_name}` : a.alert_type === 'Other' && /fallen tree/i.test(a.description) ? ' · Fallen tree' : ''}`;
export const victims = n => n == null ? 'Not confirmed' : `${n} ${n === 1 ? 'victim' : 'victims'}`;
export const facilityType = f => f.type === 'Hospital' ? 'Hospital' : 'Evacuation Center';
export const facilityDetail = f => f.type === 'Hospital' ? `Contact ${f.contact || 'not provided'}` : `Capacity ${f.capacity ?? 'not provided'}`;
export function facts(items) { return `<dl class="official-facts">${items.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value ?? 'Not provided')}</dd></div>`).join('')}</dl>`; }
export function pagination({ page, pages, total, size, noun = 'records' }) {
  const first = total ? (page - 1) * size + 1 : 0, last = Math.min(page * size, total);
  return `<div class="official-pagination"><p role="status">Showing ${first}–${last} of ${total} ${e(noun)}</p><nav aria-label="Pagination"><button type="button" class="btn btn-small" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>Previous</button><span class="official-page-number" aria-current="page" aria-label="Page ${page} of ${pages}">${page}</span><button type="button" class="btn btn-small" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Next</button></nav></div>`;
}
