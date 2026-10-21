import { Auth, Api, UI, Icons, Fmt, Store, e, roleLabel, destination, live, errorView, dialog, victims, typeIcon, alertName } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { BCMap } from '../core/map.js';
import { logAlert } from './official-alert-actions.js';
import { mountSecretaryDashboard } from './secretary-dashboard.js?v=secretary-dashboard-1';
import { renderResponderDashboard } from './official-responder-dashboard.js';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) {
  if (!['AUTH', 'FORBIDDEN'].includes(error.code)) {
    document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open the workspace', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } });
  }
}
if (user) {
const role = Auth.roleOf(user), main = Shell.official({ role, active: 'Dashboard' });
if (role === 'secretary') { mountSecretaryDashboard(main, user); } else {
main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading dashboard…</p>' + UI.skeleton(3);
let miniMaps = [];
function metric(label, value, supporting, icon, success = false) {
  return `<article class="card official-stat">${Icons.svg(icon, { size: 24 })}<span>${e(label)}</span><strong${success ? ' class="text-green"' : ''}>${Number(value)}</strong><small>${e(supporting)}</small></article>`;
}
function alertCard(a, assigned = false) {
  return `<article class="card official-alert-card${a.id === 1042 ? ' primary-alert' : ''}"><h3 class="official-alert-title">${Icons.svg(typeIcon(a.alert_type))}<span>${e(alertName(a))}</span></h3>${UI.badge(a.status)}<p>${e(a.location_label)} · ${e(a.resident?.full_name || 'Reporter not provided')}<br>${e(victims(a.victim_count))} · ${e(Fmt.dateTime(a.created_at))}</p>${assigned ? `<p>Assigned to ${e(user.full_name)}</p>` : ''}${destination(`official-alert.html?id=${a.id}`, assigned ? 'View assigned alert' : 'View alert')}</article>`;
}
function list(items, content, emptyText) { return items.length ? `<ul class="official-record-list">${items.map(item => `<li>${content(item)}</li>`).join('')}</ul>` : `<p>${e(emptyText)}</p>`; }
function map(container, barangay, alerts, facilities = []) {
  if (!container) return;
  const markers = [...alerts.map(a => ({ id: `alert-${a.id}`, kind: 'alert', status: a.status, x: a.map_x, y: a.map_y, label: `${Fmt.alertId(a.id)} · ${a.location_label}`, selected: a.id === alerts[0]?.id })), ...facilities.map(f => ({ id: `facility-${f.id}`, kind: f.type === 'Hospital' ? 'hospital' : 'evacuation', x: f.map_x, y: f.map_y, label: f.name }))];
  miniMaps.push(BCMap.mount(container, { barangay_id: barangay, markers, controls: false, interactive: false, onSelect: marker => dialog('Map location', `<div class="stack"><p>${e(marker.label)}</p><small>Approximate location on the barangay illustration.</small>${destination('official-map.html', 'Open map monitoring')}</div>`) }));
}
async function render() {
  try {
    const [stats, alerts, facilities, barangays] = await Promise.all([Api.dashboard.officialStats(), Api.alerts.list(), Api.facilities.list(), Api.barangays.list()]);
    const barangay = barangays.find(b => b.id === user.barangay_id)?.name || 'Your barangay', today = Store.now().slice(0, 10);
    miniMaps.forEach(m => m.destroy()); miniMaps = [];
    if (role === 'responder') {
      document.title = 'Responder dashboard — Barangay Connect';
      miniMaps.push(renderResponderDashboard({ main, alerts, facilities, user, barangay, now: Store.now(), refreshed: async () => { await render(); main.focus(); } }));
    } else {
      document.title = 'Rescuer dashboard — Barangay Connect';
      const assigned = alerts.filter(a => a.assigned_rescuer_id === user.id), active = assigned.filter(a => a.status !== 'Resolved'), current = active[0], logs = assigned.flatMap(a => a.rescues.filter(r => r.rescuer_id === user.id).map(r => ({ ...r, alert: a }))), pending = logs.filter(r => r.rescue_status === 'In progress'), completed = logs.filter(r => r.rescue_status === 'Completed' && r.rescued_at.slice(0, 10) === today);
      main.innerHTML = `<header class="official-heading"><h1>Rescuer Dashboard</h1><p>Rescue operations overview for ${e(barangay)}</p></header><div class="official-stats">${metric('Active rescues', active.length, 'Assigned alerts being handled', 'triangle-alert')}${metric('Assigned today', assigned.filter(a => a.responses.some(r => r.responded_at.slice(0, 10) === today)).length, 'Rescue assignments', 'file-text')}${metric('Pending transport check-ins', pending.length, 'Rescue records in progress', 'clock')}${metric('Completed rescues', completed.length, 'Today', 'circle-check', true)}</div><div class="official-rescuer-grid"><section class="card official-section"><div class="official-section-header"><h3>Current rescue assignment</h3>${current ? UI.badge(current.status) : ''}</div>${current ? `<h3>${e(alertName(current))}</h3><div class="official-assignment-details"><p class="row">${Icons.svg('map-pin', { size: 20 })}${e(current.location_label)}, ${e(barangay)}</p><p class="row">${Icons.svg('users', { size: 20 })}${e(victims(current.victim_count))}</p><p class="row">${Icons.svg('user', { size: 20 })}Assigned to: ${e(user.full_name)} (You)</p><p class="row">${Icons.svg('clock', { size: 20 })}${e(Fmt.short(current.responses.at(-1)?.responded_at || current.created_at))}</p></div><p>Assist residents and transport them safely to the selected destination facility.</p>${destination(`official-alert.html?id=${current.id}`, 'View alert details', 'btn-primary')}` : UI.empty({ icon: 'circle-check', title: 'No active rescue assignment', text: 'New rescue assignments will appear here.' })}</section><section class="card official-section"><h3>Location and status</h3><div class="official-mini-map" id="rescue-map"></div>${current ? `<p>${e(current.rescues.at(-1)?.facility?.name || 'Destination not selected')}</p>${UI.badge(current.status)}` : '<p>No active rescue location.</p>'}</section><section class="card official-section"><h3>Quick actions</h3><div class="official-quick-actions"><button type="button" class="btn btn-primary" ${current?.status === "Responding" ? "data-log-rescue" : 'disabled title="Requires an assigned alert in Responding status."'}>Update rescue status</button><button type="button" class="btn" ${current?.status === "Responding" ? "data-log-rescue" : 'disabled title="Requires an assigned alert in Responding status."'}>Mark victims picked up</button><button type="button" class="btn" ${current?.status === "Responding" ? "data-log-rescue" : 'disabled title="Requires an assigned alert in Responding status."'}>Confirm drop-off</button>${destination('official-map.html', 'Open map')}<p>Rescue actions are available through the assigned alert when it is Responding.</p></div></section></div><div class="official-rescuer-lower"><section class="card official-section"><h3>Rescue activity log</h3>${list(logs.slice(0, 4), r => `<span class="official-notice-icon">${Icons.svg('circle-check', { size: 20 })}</span><div class="grow"><p>${e(r.rescue_status)} · ${e(Fmt.alertId(r.alert.id))}</p><small>${e(user.full_name)} · ${e(Fmt.short(r.rescued_at))}</small></div>`, 'No rescue entries yet.')}</section><section class="card official-section"><h3>Destination facilities</h3>${list(facilities, f => `${Icons.svg(f.type === 'Hospital' ? 'hospital' : 'school', { size: 24 })}<div class="grow"><strong>${e(f.name)}</strong><p>${e(f.type === 'Hospital' ? 'Hospital' : 'Evacuation Center')}</p><small>${e(f.type === 'Hospital' ? f.contact : `Capacity ${f.capacity}`)}</small></div>`, 'No destination facilities available.')}</section><section class="card official-section"><h3>Recent rescue alerts</h3>${list(assigned.slice(0, 3), a => `<div class="grow"><p>${e(alertName(a))}</p><small>${e(a.location_label)} · ${e(victims(a.victim_count))}</small></div>${UI.badge(a.status)}`, 'No rescue alerts yet.')}</section></div>`;
      map(main.querySelector('#rescue-map'), user.barangay_id, current ? [current] : [], facilities);
      main.querySelectorAll("[data-log-rescue]").forEach(button => button.addEventListener("click", () => logAlert(current, "rescue", async () => { await render(); main.focus(); })));
    }
  } catch (err) { miniMaps.forEach(m => m.destroy()); miniMaps = []; errorView(main, err, render); }
  finally { main.removeAttribute('aria-busy'); }
}
live(['alerts', 'announcements', 'verification', 'feedback', 'users'], render)();
window.addEventListener('pagehide', event => { if (!event.persisted) miniMaps.forEach(m => m.destroy()); }, { once: true });
}
}
