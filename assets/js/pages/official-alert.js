import { Auth, Api, UI, Fmt, e, live, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { BCMap } from '../core/map.js';
import { logAlert, resolveAlert } from './official-alert-actions.js';
import { assignAlert, cancelAlertAssignment } from './official-assignment.js';
import { alertDetail } from './official-alert-view.js';

let user;
try { Auth.requireRole(['captain', 'secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open the alert', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } }); }
if (user) {
  const main = Shell.official({ active: 'Alerts' }), id = Number(new URLSearchParams(location.search).get('id'));
  let mapView, current, rendering = 0;
  main.classList.add('alert-detail-page');
  main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading alert…</p>' + UI.skeleton(3);
  async function saved() { await render(); main.focus(); }
  async function render() {
    const version = ++rendering;
    try {
      const a = await Api.alerts.get(id); if (version !== rendering) return;
      current = a; mapView?.destroy(); document.title = `${Fmt.alertId(a.id)} · ${a.status} — Barangay Connect`;
      main.innerHTML = alertDetail(a, user);
      main.querySelectorAll('[data-workflow]').forEach(button => button.addEventListener('click', event => {
        const action = event.currentTarget.dataset.workflow;
        if (action === 'acknowledge') assignAlert(current, { role: 'responder', mode: 'acknowledge', saved });
        else if (action === 'resolve') resolveAlert(current, saved);
        else logAlert(current, action === 'logRescue' ? 'rescue' : 'response', saved);
      }));
      main.querySelectorAll('[data-assign]').forEach(button => button.addEventListener('click', () => assignAlert(current, { role: button.dataset.assign, saved })));
      main.querySelectorAll('[data-reassign]').forEach(button => button.addEventListener('click', () => assignAlert(current, { role: button.dataset.reassign, mode: 'reassign', saved })));
      main.querySelectorAll('[data-cancel-assignment]').forEach(button => button.addEventListener('click', () => cancelAlertAssignment(current, button.dataset.cancelAssignment, saved)));
      mapView = BCMap.mount(main.querySelector('#alert-map'), { barangay_id: a.barangay_id, markers: [{ id: a.id, kind: 'alert', status: a.status, x: a.map_x, y: a.map_y, label: `${Fmt.alertId(a.id)} · ${a.location_label}`, selected: true }], controls: false, interactive: false });
    } catch (err) {
      if (version !== rendering) return; mapView?.destroy();
      if (['NOT_FOUND', 'FORBIDDEN'].includes(err.code)) main.innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Alert unavailable', text: err.message, action: { href: 'official-alerts.html', label: 'Back to alerts' } });
      else errorView(main, err, render);
    } finally { if (version === rendering) main.removeAttribute('aria-busy'); }
  }
  live(['facilities', 'alerts', 'verification', 'users'], render)(); window.addEventListener('pagehide', event => { if (!event.persisted) mapView?.destroy(); }, { once: true });
}
