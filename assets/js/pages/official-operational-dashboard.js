import { facilityActive, facilityLocated } from '../core/facilities.js';
import { UI, Icons, Fmt, e, dialog, victims, typeIcon, alertName, facilityType, facilityDetail } from './official-shared.js';
import { BCMap } from '../core/map.js';
import { canTransition } from '../core/alertMachine.js';
import { logAlert } from './official-alert-actions.js';

const icon = (name, size = 20) => Icons.svg(name, { size });
const alertUrl = a => `official-alert.html?id=${a.id}`;
const mapUrl = a => `official-map.html${a ? `?alert=${a.id}` : ''}`;
const forward = (href, label, className = '') => `<a class="${className}" href="${e(href)}"><span>${e(label)}</span>${icon('chevron-right')}</a>`;
const unavailable = text => `<span class="badge badge-gray">${icon('info', 16)}${e(text)}</span>`;

function metric({ label, value, supporting, tone, symbol, href, action }) {
  const tag = href ? 'a' : 'button';
  return `<${tag} class="card responder-metric" ${href ? `href="${e(href)}"` : `type="button" data-responder-action="${action}"`}>
    <span class="responder-tile responder-tone-${tone}">${icon(symbol, 30)}</span>
    <span class="responder-metric-copy"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(supporting)}</small></span>
    ${icon('chevron-right', 16)}</${tag}>`;
}

function activityList(rows, limit = rows.length, rescue = false) {
  return rows.length ? `<ol class="responder-activity-list">${rows.slice(0, limit).map((row, i) => `<li>
    <span class="responder-activity-dot${i === 0 ? ' current' : ''}" aria-hidden="true"></span>
    <div><strong>${e(row.title)}</strong><small>${e(row.actor)} · ${e(Fmt.alertId(row.alert.id))}</small></div>
    <time datetime="${e(row.at)}">${e(Fmt.short(row.at))}</time></li>`).join('')}</ol>`
    : UI.empty({ icon: 'activity', title: rescue ? 'No rescue activity yet' : 'No response activity yet', text: `Assignments and saved ${rescue ? 'rescue' : 'response'} records will appear here.` });
}

export function renderOperationalDashboard({ main, facilities, user, barangay, refreshed, data, kind = 'response' }) {
  const rescue = kind === 'rescue', current = data.current, availableFacilities = facilities.filter(facilityActive);
  const canRespond = current && canTransition(current, rescue ? 'logRescue' : 'logResponse', user);
  const recordTime = rescue ? 'rescued_at' : 'responded_at', recordStatus = rescue ? 'rescue_status' : 'response_status';
  const response = data.records.filter(r => r.alert.id === current?.id && Number.isFinite(Date.parse(r[recordTime])))
    .sort((a, b) => Date.parse(b[recordTime]) - Date.parse(a[recordTime]))[0];
  const currentFacility = rescue && response ? facilities.find(f => f.id === response.facility_id) : null;
  const destinationFacility = response?.facility || currentFacility;
  const assignedAt = rescue ? data.currentAssignedAt : current?.responder_assigned_at ?? current?.acknowledged_at;
  const title = rescue ? 'Rescuer Dashboard' : 'Responder Dashboard';
  const activityTitle = rescue ? 'Rescue activity log' : 'Response activity log';
  const updateLabel = rescue ? 'Update rescue status' : 'Update status';
  const sectionArrow = rescue ? '<img src="assets/img/source/secretary-section-arrow.svg" width="16" height="16" alt="">' : icon('arrow-right', 16);
  const metrics = [
    { label: rescue ? 'Active rescues' : 'Active incidents', value: data.active.length, supporting: 'Priority unavailable', tone: 'red', symbol: 'triangle-alert', href: 'official-alerts.html' },
    { label: 'Assigned today', value: data.assignedToday, supporting: `${data.inProgressToday} in progress · ${data.finishedToday} completed`, tone: 'blue', symbol: 'clipboard-check', href: 'official-alerts.html' },
    { label: rescue ? 'Pending transport check-ins' : 'Pending check-ins', value: '—', supporting: 'Check-ins unavailable', tone: 'amber', symbol: 'clock', action: 'check-ins' },
    { label: rescue ? 'Completed rescues' : 'Completed responses', value: data.completedToday, supporting: 'Today', tone: 'green', symbol: 'circle-check', action: 'completed' },
  ];
  const quick = (label, symbol, action, href, primary = false, disabled = false) => {
    const content = `${icon(symbol, 24)}<span>${e(label)}</span>${icon('chevron-right')}`;
    return href ? `<a class="btn responder-quick${primary ? ' btn-primary' : ''}" href="${e(href)}">${content}</a>`
      : `<button type="button" class="btn responder-quick${primary ? ' btn-primary' : ''}" data-responder-action="${action}"${disabled ? ` disabled aria-describedby="rescue-action-help"` : ''}>${content}</button>`;
  };
  main.classList.add('responder-dashboard');
  if (rescue) main.classList.add('rescuer-dashboard');
  main.innerHTML = `<header class="official-heading"><h1>${title}</h1><p>${rescue ? 'Rescue operations overview' : 'Operations overview'} for ${e(barangay)}</p></header>
    <div class="responder-metrics" aria-label="${rescue ? 'Rescue' : 'Response'} overview">${metrics.map(metric).join('')}</div>
    <div class="responder-operations">
      <section class="card responder-panel responder-assignment" aria-labelledby="responder-assignment-title">
        <div class="responder-panel-heading"><h2 id="responder-assignment-title">Current ${rescue ? 'rescue assignment' : 'assignment'}</h2>${current ? UI.badge(current.status) : ''}
          ${current ? `<a class="icon-btn responder-assignment-more" href="${alertUrl(current)}" aria-label="More assignment details" title="More assignment details">${icon('ellipsis-vertical')}</a>` : ''}</div>
        ${current ? `<h3>${e(alertName(current))}</h3><div class="responder-assignment-facts">
          <p>${rescue ? '<img src="assets/img/source/secretary-location.svg" width="24" height="24" alt="">' : icon('map-pin')}<span>${e(current.location_label)}, ${e(barangay)}</span></p>
          <p>${icon('users')}<span>${e(victims(current.victim_count))}</span></p>
          <p>${icon('user')}<span>Assigned to: ${e(user.full_name)} (You)</span></p>
          <p>${icon('clock')}<span>Assigned at: ${assignedAt ? `<time datetime="${e(assignedAt)}">${e(Fmt.short(assignedAt))}</time>` : 'Not recorded'}</span></p>
        </div><p class="responder-responsibilities">${rescue ? 'Assist residents and transport them safely to the selected destination facility.' : 'Provide first aid, assess the situation and log your response. Coordinate with barangay officials for evacuation if needed.'}</p>
        ${forward(alertUrl(current), rescue ? 'View alert details' : 'Open incident details', 'btn btn-primary responder-details-link')}`
          : UI.empty({ icon: 'circle-check', title: 'No active assignment', text: rescue ? 'An alert appears here when the Responder logs a response and it is assigned to you.' : 'An alert appears here when the Secretary acknowledges and assigns it to you.', action: { href: 'official-alerts.html', label: 'View assigned alerts' } })}
      </section>
      <section class="card responder-panel responder-route" aria-labelledby="responder-route-title">
        <div class="responder-panel-heading"><h2 id="responder-route-title">Route and status</h2>${current ? UI.badge(current.status) : unavailable('No assignment')}</div>
        <div class="responder-map-wrap"><div id="responder-dashboard-map" class="responder-map" aria-label="Operational map"></div>
          <a class="icon-btn responder-map-expand" href="${mapUrl(current)}" aria-label="Open full map" title="Open full map">${rescue ? '<img src="assets/img/source/secretary-maximize.svg" width="24" height="24" alt="">' : icon('map')}</a></div>
        ${destinationFacility ? `<a class="rescue-destination-callout" href="official-map.html?facility=${destinationFacility.id}" aria-label="View destination ${e(destinationFacility.name)} on map"><strong>${e(destinationFacility.name)}</strong><small>${e(facilityType(destinationFacility))}</small>${currentFacility && !facilityActive(currentFacility) ? '<small class="error-text">Destination is currently inactive. Original assignment retained.</small>' : ''}</a>` : ''}
        <ol class="responder-progress" aria-label="Travel stages unavailable; completion uses your ${rescue ? 'rescue' : 'response'} record">
          ${(rescue ? ['En route', 'Picking up', 'Transporting', 'Completed'] : ['En route', 'On site', 'Assisting', 'Completed']).map((stage, i) => `<li${i === 3 && response?.[recordStatus] === 'Completed' ? ' class="recorded"' : ''}>
            <span aria-hidden="true"></span><strong>${stage}</strong><small>${i === 3 && response?.[recordStatus] === 'Completed' ? e(Fmt.short(response[recordTime])) : '<span aria-hidden="true">—</span><span class="sr-only">Not recorded</span>'}</small></li>`).join('')}
        </ol><small class="responder-map-note">${rescue && !destinationFacility ? 'Destination not selected · ' : ''}Travel tracking unavailable · Approximate locations · No routing</small>
      </section>
      <section class="card responder-panel responder-actions" aria-labelledby="responder-actions-title"><h2 id="responder-actions-title">Quick actions</h2>
        ${quick(updateLabel, 'pencil', 'update', null, true, rescue && !canRespond)}${rescue ? `${quick('Mark victims picked up', 'users', 'pickup', null, false, true)}${quick('Confirm drop-off', 'circle-check', 'dropoff', null, false, true)}` : quick('Request backup', 'users', 'backup')}${quick('Open map', 'map', null, mapUrl(current))}
        ${rescue ? `<small id="rescue-action-help" class="rescue-action-help">${!canRespond ? 'Rescue logging requires an assigned alert in Responding. ' : ''}Pickup and drop-off tracking unavailable.</small>` : ''}
      </section>
    </div>
    <div class="responder-records">
      <section class="card responder-panel"><div class="responder-panel-heading"><h2>${activityTitle}</h2><button class="responder-text-action" type="button" data-responder-action="activity">View all ${sectionArrow}</button></div>${activityList(data.activity, 4, rescue)}</section>
      <section class="card responder-panel"><div class="responder-panel-heading"><h2>${rescue ? 'Destination facilities' : 'Nearby facilities'}</h2><a class="responder-text-action" href="official-map.html">View on map ${sectionArrow}</a></div>
        ${availableFacilities.length ? `<ul class="responder-record-list">${availableFacilities.map(f => `<li><a class="responder-record" href="official-map.html?facility=${f.id}">
          <span class="responder-tile responder-tone-${f.type === 'Hospital' ? 'red' : 'green'}">${icon(f.type === 'Hospital' ? 'hospital' : 'school', 24)}</span>
          <span class="responder-record-copy"><strong>${e(f.name)}</strong><small>${e(facilityType(f))}</small></span>
          <span class="responder-facility-info">${e(facilityDetail(f))}</span>${icon('chevron-right', 16)}</a></li>`).join('')}</ul><small>Travel estimates unavailable.</small>`
          : UI.empty({ icon: 'hospital', title: 'No facilities available', text: 'Available hospitals and evacuation centers will appear here.' })}
      </section>
      <section class="card responder-panel"><div class="responder-panel-heading"><h2>${rescue ? 'Recent rescue alerts' : 'Recent alerts'}</h2><a class="responder-text-action" href="official-alerts.html">View all ${sectionArrow}</a></div>
        ${data.recent.length ? `<ul class="responder-record-list">${data.recent.map(a => `<li><a class="responder-record responder-recent" href="${alertUrl(a)}">
          <span class="responder-tile responder-tone-blue">${icon(typeIcon(a.alert_type), 24)}</span>
          <span class="responder-record-copy"><strong>${e(alertName(a))}</strong><small>${e(a.location_label)} · ${e(victims(a.victim_count))}</small></span>
          <span class="responder-recent-meta"><time datetime="${e(a.created_at)}">${e(Fmt.short(a.created_at))}</time>${unavailable('Unrated')}<span class="sr-only">Priority unavailable</span></span></a></li>`).join('')}</ul>`
          : UI.empty({ icon: 'triangle-alert', title: 'No assigned alerts', text: 'Your assigned incidents will appear here.' })}
      </section>
    </div>`;

  function restoreAction(el, action) {
    el.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) main.querySelector(`[data-responder-action="${action}"]`)?.focus({ preventScroll: true });
    }, { once: true });
  }
  function showActivity(completed = false) {
    const rows = completed ? data.activity.filter(a => data.completedRecords.some(r => a.key === `${kind}-${r.id}`)) : data.activity;
    const content = rescue && completed && !rows.length ? UI.empty({ icon: 'circle-check', title: 'No completed rescues today', text: 'Completed rescue records for today will appear here.' }) : activityList(rows, rows.length, rescue);
    const el = dialog(completed ? (rescue ? 'Completed rescues' : 'Completed responses') : activityTitle, `<div class="responder-activity-dialog">${content}<button type="button" class="btn btn-primary" data-done>Done</button></div>`);
    el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
    restoreAction(el, completed ? 'completed' : 'activity');
  }
  function showUnavailable(title, text, action) {
    const el = dialog(title, `<div class="stack">${current ? `<h3>${e(alertName(current))}</h3><p>${e(current.location_label)} · ${e(victims(current.victim_count))}</p>` : ''}<div class="banner">${icon('info')}<p>${e(text)}</p></div><button type="button" class="btn" data-done>Close</button></div>`);
    el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
    restoreAction(el, action);
  }
  main.querySelectorAll('[data-responder-action]').forEach(button => button.addEventListener('click', async () => {
    switch (button.dataset.responderAction) {
      case 'activity': showActivity(); break;
      case 'completed': showActivity(true); break;
      case 'check-ins': showUnavailable('Check-ins unavailable', rescue ? 'Transport check-ins are not recorded in this version. Rescue records retain In progress or Completed; neither records a pickup or drop-off check-in.' : 'Check-ins are not recorded in this version. Use Update status to log a response when an assigned alert is Acknowledged.', 'check-ins'); break;
      case 'backup': showUnavailable('Request backup', 'Backup requests are unavailable in this version. No request has been sent.', 'backup'); break;
      case 'update':
        if (canRespond) restoreAction(await logAlert(current, kind, refreshed), 'update');
        else showUnavailable(updateLabel, current ? `This alert is ${current.status}. A ${rescue ? 'rescue' : 'response'} can be logged only while your assigned alert is ${rescue ? 'Responding' : 'Acknowledged'}. View incident details for the latest records.` : 'There is no active assignment. New assignments will appear after the Secretary acknowledges an alert.', 'update');
        break;
    }
  }));
  const markers = [
    ...data.active.map(a => ({ id: `alert-${a.id}`, kind: 'alert', status: a.status, x: a.map_x, y: a.map_y, label: `${Fmt.alertId(a.id)} · ${a.location_label}`, selected: a.id === current?.id })),
    ...availableFacilities.filter(facilityLocated).map(f => ({ id: `facility-${f.id}`, kind: f.type === 'Hospital' ? 'hospital' : 'evacuation', x: f.map_x, y: f.map_y, label: f.name })),
  ];
  const map = BCMap.mount(main.querySelector('#responder-dashboard-map'), { barangay_id: user.barangay_id, markers, controls: true, interactive: true,
    onSelect: marker => { location.assign(marker.id.startsWith('facility-') ? `official-map.html?facility=${marker.id.slice(9)}` : `official-map.html?alert=${marker.id.slice(6)}`); } });
  return map;
}
