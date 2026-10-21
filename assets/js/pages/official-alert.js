import { Auth, Api, UI, Icons, Fmt, e, typeIcon, alertName, victims, facts, roleLabel, live, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { BCMap } from '../core/map.js';
import { canTransition } from '../core/alertMachine.js';
import { logAlert, resolveAlert } from './official-alert-actions.js';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open the alert', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } }); }
if (user) {
  const main = Shell.official({ active: 'Alerts' }), id = Number(new URLSearchParams(location.search).get('id')), role = Auth.roleOf(user);
  let mapView, current, rendering = 0;
  main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading alert…</p>' + UI.skeleton(3);
  const allowed = (a, action) => canTransition(a, action, user) && (action !== 'logResponse' || a.assigned_responder_id === user.id) && (action !== 'logRescue' || a.assigned_rescuer_id === user.id);
  function actionCard(a) {
    const action = ['acknowledge', 'logResponse', 'logRescue', 'resolve'].find(action => allowed(a, action));
    const label = { acknowledge: 'Acknowledge', logResponse: 'Log response', logRescue: 'Log rescue', resolve: 'Resolve' };
    const waiting = a.status === 'Resolved' ? 'This alert is resolved.' : a.status === 'Pending' ? 'Awaiting acknowledgement by the Secretary.' : a.status === 'Acknowledged' ? `Awaiting a response log${a.assigned_responder ? ` from ${a.assigned_responder.full_name}` : ''}.` : a.status === 'Responding' ? `Awaiting a rescue log${a.assigned_rescuer ? ` from ${a.assigned_rescuer.full_name}` : ''}.` : 'Awaiting resolution by the Secretary.';
    return `<section class="card official-person-action"><p>${e(roleLabel(role))} ${e(user.full_name)}</p>${action ? `<button class="btn ${action === 'resolve' ? 'btn-danger' : 'btn-primary'}" type="button" data-workflow="${action}">${label[action]}</button>` : `<small>${e(waiting)}</small>`}</section>`;
  }
  function logs(a, rescue = false) {
    const rows = rescue ? a.rescues : a.responses;
    return `<section class="card official-section"><h3>${rescue ? 'Rescue log' : 'Response log'}</h3>${rows.length ? `<ul class="official-log-records">${rows.map(r => `<li>${facts(rescue ? [['Rescuer', r.rescuer?.full_name], ['Destination facility', r.facility?.name], ['Status', r.rescue_status], ['Time', Fmt.dateTime(r.rescued_at)]] : [['Responder', r.responder?.full_name], ['Response type', r.response_type], ['Status', r.response_status], ['Time', Fmt.dateTime(r.responded_at)]])}${r.notes ? `<p class="official-long-copy">${e(r.notes)}</p>` : ''}</li>`).join('')}</ul>` : `<small>${rescue ? 'Rescuer · Destination facility · Status · Time' : 'Responder · Response type · Status · Time'}</small><p>No ${rescue ? 'rescue' : 'response'} logged yet.</p>`}</section>`;
  }
  async function saved() { await render(); main.focus(); }
  async function render() {
    const version = ++rendering;
    try {
      const a = await Api.alerts.get(id), resident = a.resident ? await Api.users.get(a.resident.id) : null; if (version !== rendering) return;
      current = a; mapView?.destroy(); document.title = `${Fmt.alertId(a.id)} · ${a.status} — Barangay Connect`;
      main.innerHTML = `<header class="official-heading"><h1>Alert Detail</h1></header><div class="official-alert-heading"><h2>${Icons.svg(typeIcon(a.alert_type))}${e(alertName(a))}</h2><div>${UI.badge(a.status)}<a class="btn" href="official-alerts.html">Back to alerts</a></div></div>${actionCard(a)}<div class="official-detail-grid"><div class="official-section"><section class="card official-section"><h2>Emergency details</h2>${facts([['Reporter', a.resident?.full_name || 'Not provided'], ['Household', a.household?.address || 'Not provided'], ['Location', a.location_label], ['Victims', a.victim_count ?? 'Not confirmed'], ['Reported', Fmt.dateTime(a.created_at)]])}${resident ? `<div class="official-verification-line"><small>Verification</small>${UI.badge(resident.verification?.review_status || "Pending")}</div>` : ""}<p class="official-long-copy">${e(a.description || 'No description provided.')}</p><div class="official-photo-placeholder">${Icons.svg('camera')}<span>${a.photo_name ? `Photo preview · ${e(a.photo_name)}` : 'No photo provided.'}</span><small>Photos are represented by file names in this demo.</small></div></section><div class="official-detail-logs">${logs(a)}${logs(a, true)}</div></div><aside class="card official-section official-timeline"><h2>Status timeline</h2><ol>${a.timeline.map(t => `<li${t.current ? ' aria-current="step" class="current"' : ''}>${UI.badge(t.status)}<span>${t.current ? 'Current · ' : ''}${t.at ? `<time datetime="${e(t.at)}">${e(Fmt.short(t.at))}</time>` : 'Not reached'}</span></li>`).join('')}</ol><div class="official-mini-map" id="alert-map"></div><small>Approximate incident location.</small></aside></div>`;
      main.querySelector('[data-workflow]')?.addEventListener('click', async event => {
        const action = event.currentTarget.dataset.workflow, button = event.currentTarget;
        if (action === 'acknowledge') {
          button.disabled = true; button.textContent = 'Acknowledging…';
          try { await Api.alerts.acknowledge(id); UI.toast(`${Fmt.alertId(id)} acknowledged.`); await saved(); }
          catch (err) { UI.toast(err.message, 'error'); await saved(); }
        } else if (action === 'resolve') resolveAlert(current, saved);
        else logAlert(current, action === 'logRescue' ? 'rescue' : 'response', saved);
      });
      mapView = BCMap.mount(main.querySelector('#alert-map'), { barangay_id: a.barangay_id, markers: [{ id: a.id, kind: 'alert', status: a.status, x: a.map_x, y: a.map_y, label: `${Fmt.alertId(a.id)} · ${a.location_label}`, selected: true }], controls: false, interactive: false });
    } catch (err) {
      if (version !== rendering) return; mapView?.destroy();
      if (['NOT_FOUND', 'FORBIDDEN'].includes(err.code)) main.innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Alert unavailable', text: err.message, action: { href: 'official-alerts.html', label: 'Back to alerts' } });
      else errorView(main, err, render);
    } finally { if (version === rendering) main.removeAttribute('aria-busy'); }
  }
  live(['alerts', 'verification', 'users'], render)(); window.addEventListener('pagehide', event => { if (!event.persisted) mapView?.destroy(); }, { once: true });
}
