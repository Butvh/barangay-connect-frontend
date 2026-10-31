import { facilityActive } from '../core/facilities.js';
import { Auth, Api, UI, Fmt, BCMap, e, icon, tile, link, live, errorView, safety } from './resident-shared.js';
import { responseProgress } from './resident-report-model.js';
import { Shell } from '../core/shell-resident.js';

Auth.requireRole(['resident']);
const user = Auth.current();
if (user) {
  const main = Shell.resident({ active: 'Report' });
  main.classList.add('resident-alert-main');
  main.innerHTML = UI.skeleton(3);
  let map;

  async function render() {
    try {
      const id = Number(new URLSearchParams(location.search).get('id'));
      if (!id) throw new Error('Choose an alert from your dashboard.');
      const a = await Api.alerts.get(id), steps = responseProgress(a);
      const destinationLog = a.rescues?.findLast(r => r.facility), destination = destinationLog?.facility;
      const resolved = a.status === 'Resolved', current = steps.find(s => s.phase === 'current');
      const summary = resolved ? 'Your alert has been resolved. Review the response timeline and destination details below.'
        : a.status === 'Pending' ? 'Your SOS has been sent. It is waiting for acknowledgement from barangay officials.'
          : current.description + (current.at ? ' Latest stage: ' + Fmt.short(current.at) + '.' : '');
      map?.destroy();
      main.innerHTML = '<header class="page-heading"><div class="resident-alert-title"><h1>' + e(Fmt.alertId(a.id) + ' · ' + a.status) + '</h1>' + UI.badge(a.status) + '</div><p>' +
        e((a.incident_name || a.alert_type) + ' · ' + (a.location_label || 'Location not provided') + ' · ' + (a.victim_count == null ? 'Victims not confirmed' : a.victim_count + ' victim' + (a.victim_count === 1 ? '' : 's'))) + '</p></header>' +
        '<div class="alert-layout"><section class="card card-plain stack response-progress-card"><div class="stack-sm"><h2>Response progress</h2><p>' + e(summary) + '</p></div>' +
        '<ol class="timeline resident-sos-timeline" aria-label="SOS response progress">' + steps.map(step =>
          '<li class="' + step.phase + '" data-tone="' + step.tone + '"' + (step.phase === 'current' ? ' aria-current="step"' : '') + '><span class="timeline-icon" aria-hidden="true">' + icon(step.icon, { size: 20 }) +
          '</span><div><h3>' + e(step.status) + '<span class="sr-only"> · ' + e(step.phase) + '</span></h3><p>' + e(step.description) + '</p>' +
          (step.at ? '<time class="caption" datetime="' + e(step.at) + '">' + e(step.timeLabel) + '</time>' : '<span class="caption">' + e(step.timeLabel) + '</span>') + '</div></li>').join('') + '</ol>' +
        '<div class="assignment-rows"><div class="row">' + icon('user', { size: 20 }) + '<span>Responder: ' + e(a.assigned_responder?.full_name || 'Not assigned yet') + '</span></div>' +
        '<div class="row">' + icon('users', { size: 20 }) + '<span>Rescuer: ' + e(a.assigned_rescuer?.full_name || 'Not assigned yet') + '</span></div>' +
        '<div class="row">' + icon('building-2', { size: 20 }) + '<span>Destination facility: ' + e(destination?.name || 'Not assigned yet') + '</span></div></div>' +
        (destinationLog?.current_facility && !facilityActive(destinationLog.current_facility) ? '<p class="banner">Your recorded destination is currently inactive. Contact barangay responders for guidance.</p>' : '') +
        (!a.description && !resolved ? link('resident-report.html?step=details&id=' + a.id, 'Add details') : '') + '</section>' +
        '<div class="stack"><section class="card card-plain stack-sm"><h3>Your household and rescue area</h3><div class="row alert-location">' + icon('map-pin') + '<p>' + e(a.location_label || a.household?.address || 'Approximate area') + '<br>Barangay Sampaguita</p></div>' +
        '<div class="mini-map" id="alert-map"></div></section><section class="card card-plain safety-card stack-sm"><h3>' + (resolved ? a.rescues?.length ? 'After your rescue' : 'After your response' : 'While waiting') + '</h3><div class="row">' + tile('shield-check', 'round', 28) + '<p>' +
        e(resolved ? 'Follow barangay guidance before returning home. Contact the barangay office if you need further assistance.' : safety(a)) + '</p></div></section></div></div>' +
        '<div class="actions resident-alert-actions">' + link('resident-dashboard.html', 'Back to dashboard') + (resolved ? link('resident-notifications.html', 'Notifications', 'btn-primary') : '') + '</div>';
      map = BCMap.mount(main.querySelector('#alert-map'), { barangay_id: user.barangay_id,
        markers: [{ id: 'home', kind: 'own_household', x: a.map_x ?? a.household?.map_x ?? 45, y: a.map_y ?? a.household?.map_y ?? 57, label: 'My household' }], controls: false, interactive: false });
    } catch (err) { errorView(main, err, render); }
  }

  live(['facilities', 'alerts'], render)();
  window.addEventListener('pagehide', event => { if (!event.persisted) map?.destroy(); }, { once: true });
}
