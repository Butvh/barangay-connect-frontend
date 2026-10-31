import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
import { roleOf } from '../core/permissions.js';
import { canTransition } from '../core/alertMachine.js';
import { facilityActive } from '../core/facilities.js';
import { responseProgress } from './resident-report-model.js';

const e = UI.escape;
const administrative = role => ['secretary', 'captain'].includes(role);
const time = at => at && Number.isFinite(Date.parse(at)) ? `<time datetime="${e(at)}">${e(Fmt.dateTime(at))}</time>` : 'Not recorded';
const title = (icon, text) => `<h2>${Icons.svg(icon)}<span>${text}</span></h2>`;

/** One action slot, using the existing transition and assignment ownership gates. */
export function primaryAction(a, user) {
  const role = roleOf(user), admin = administrative(role);
  if (admin && a.status !== 'Resolved') {
    if (canTransition(a, 'acknowledge', user)) return { workflow: 'acknowledge', label: 'Acknowledge' };
    if (a.can_assign_responder) return { assign: 'responder', label: 'Assign responder' };
    if (a.can_assign_rescuer) return { assign: 'rescuer', label: 'Assign a rescuer' };
    if (canTransition(a, 'resolve', user)) return { workflow: 'resolve', label: 'Resolve' };
  }
  for (const [action, kind, label] of [['logResponse', 'responder', 'Log response'], ['logRescue', 'rescuer', 'Log rescue']]) {
    if (a[`assigned_${kind}_id`] === user.id && canTransition(a, action, user)) return { workflow: action, label };
  }
  return null;
}

function personnel(a, role) {
  const rows = ['responder', 'rescuer'].map(kind => {
    const person = a[`assigned_${kind}`], active = a.status !== 'Resolved' && a[`active_${kind}_assignment`];
    return `<div class="alert-person"><div class="alert-person-heading"><div><small>Assigned ${kind}</small><p>${e(person?.full_name || 'Not assigned yet')}</p></div>${role === 'captain' && active ? `<div class="alert-person-actions"><button type="button" class="btn btn-small" data-reassign="${kind}" aria-label="Reassign ${kind}">${Icons.svg('arrow-right', { size: 16 })}Reassign</button><button type="button" class="btn btn-small" data-cancel-assignment="${kind}" aria-label="Cancel ${kind} assignment">${Icons.svg('x', { size: 16 })}Cancel</button></div>` : ''}</div>${person ? `<small class="alert-person-provenance">${e(a[`${kind}_assignment_status`] || 'Status not recorded')} · ${time(a[`${kind}_assigned_at`])}${a[`${kind}_assigned_by_name`] ? ` · By ${e(a[`${kind}_assigned_by_name`])}` : ' · Assigned by: Not recorded'}</small>` : ''}</div>`;
  }).join('');
  const history = administrative(role) && a.assignments?.length ? `<details class="assignment-history"><summary>${Icons.svg('file-text', { size: 20 })}<span>Assignment history (${a.assignments.length})</span>${Icons.svg('chevron-right', { size: 18 })}</summary><ol>${a.assignments.map(row => `<li><strong>${e(row.personnel_name)} · ${e(row.role)}</strong><small>${e(row.status)} · ${time(row.assigned_at)} · By ${e(row.assigned_by_name || 'Not recorded')}</small>${row.ended_at ? `<small>Ended ${time(row.ended_at)} · ${e(row.end_reason || '')}</small>` : ''}${row.override_reason ? `<small>Captain override: ${e(row.override_reason)}</small>` : ''}</li>`).join('')}</ol></details>` : '';
  return `<section class="card alert-detail-card alert-personnel">${title('users', 'Assigned personnel')}${rows}${history}</section>`;
}

function logs(a, rescue = false) {
  const records = (rescue ? a.rescues : a.responses) || [];
  const columns = rescue ? ['Rescuer', 'Destination facility', 'Status', 'Time'] : ['Responder', 'Status', 'Time'];
  const rows = records.map(r => {
    const values = rescue ? [r.rescuer?.full_name, r.facility?.name, r.rescue_status] : [r.responder?.full_name, r.response_status];
    const assessment = !rescue ? `${e(r.response_type || 'Response type not recorded')} · Rescue needed: ${typeof r.rescue_required === 'boolean' ? r.rescue_required ? 'Yes' : 'No' : 'Not recorded'}` : '';
    const inactive = rescue && r.current_facility && !facilityActive(r.current_facility);
    return `<tr>${values.map(value => `<td>${e(value || 'Not recorded')}</td>`).join('')}<td>${time(rescue ? r.rescued_at : r.responded_at)}</td></tr>${assessment || r.notes || inactive ? `<tr class="alert-log-detail"><td colspan="${columns.length}">${assessment ? `<p>${assessment}</p>` : ''}${r.notes ? `<p>${e(r.notes)}</p>` : ''}${inactive ? '<p class="banner">Destination is currently inactive. Original assignment retained.</p>' : ''}</td></tr>` : ''}`;
  }).join('');
  return `<section class="card alert-detail-card alert-log">${title(rescue ? 'life-buoy' : 'clipboard-check', rescue ? 'Rescue log' : 'Response log')}<div class="alert-log-scroll"><table><thead><tr>${columns.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${columns.length}" class="alert-log-empty">No ${rescue ? 'rescue' : 'response'} logged yet.</td></tr>`}</tbody></table></div></section>`;
}

function timeline(a) {
  // Reuse the Resident projection: a later status is not evidence of an earlier stage.
  return `<section class="card alert-detail-card alert-status-timeline">${title('clock', 'Status timeline')}<ol>${responseProgress(a).reverse().map(t => `<li data-stage="${e(t.status)}" data-phase="${t.phase}" data-tone="${t.tone}"${t.phase === 'current' ? ' aria-current="step"' : ''}><span class="alert-stage-dot">${t.phase === 'current' ? Icons.svg(t.icon, { size: 16 }) : ''}</span><span class="alert-stage-name">${e(t.status)}<span class="sr-only"> · ${t.phase}</span></span><span class="alert-stage-time">${t.at ? time(t.at) : t.phase === 'upcoming' ? 'Not reached' : e(t.timeLabel)}</span></li>`).join('')}</ol></section>`;
}

export function alertDetail(a, user) {
  const action = primaryAction(a, user), role = roleOf(user);
  const incidentName = `${Fmt.alertId(a.id)} · ${a.alert_type}${a.incident_name ? ` · ${a.incident_name}` : a.alert_type === 'Other' && /fallen tree/i.test(a.description) ? ' · Fallen tree' : ''}`;
  const waiting = a.status === 'Resolved' ? 'This alert is resolved.' : a.status === 'Pending' ? 'Awaiting acknowledgement by a barangay official.' : a.rescue_required && !a.assigned_rescuer_id ? 'Awaiting manual rescuer assignment.' : a.response_completed ? 'Response completed. Awaiting remaining incident actions.' : 'Awaiting the next response update.';
  const summary = [
    ['circle-check', 'Status', UI.badge(a.status)], ['calendar', 'Reported', time(a.created_at)],
    ['house', 'Household', e(a.household?.address || 'Not provided')], ['map-pin', 'Location', e(a.location_label || 'Not provided')],
    ['users', 'Victims', a.victim_count == null ? 'Not confirmed' : `${e(a.victim_count)} ${a.victim_count === 1 ? 'victim' : 'victims'}`],
  ];
  return `<div class="alert-detail-layout"><div class="alert-detail-main">
    <header class="alert-detail-header"><a class="alert-back" href="official-alerts.html">${Icons.svg('chevron-left', { size: 18 })}Back to alerts</a><h1>Alert Detail</h1><div class="alert-incident-heading"><h2>${Icons.svg(Icons.disaster(a.alert_type), { size: 28 })}${e(incidentName)}</h2>${action ? `<button type="button" class="btn btn-primary" ${action.workflow ? `data-workflow="${action.workflow}"` : `data-assign="${action.assign}"`}>${action.label}</button>` : `<p class="alert-workflow-waiting">${waiting}</p>`}</div></header>
    <section class="card alert-summary" aria-label="Alert summary">${summary.map(([icon, label, value]) => `<div class="alert-summary-item">${Icons.svg(icon)}<div><small>${label}</small><div>${value}</div></div></div>`).join('')}</section>
    <section class="card alert-detail-card alert-reporter">${title('user', 'Reporter information')}<div class="alert-reporter-columns"><dl><div><dt>Name</dt><dd>${e(a.resident?.full_name || 'Not provided')}</dd></div><div><dt>Contact number</dt><dd>${e(a.resident?.contact_number || 'Not provided')}</dd></div></dl><dl><div class="alert-reporter-icon">${Icons.svg('calendar', { size: 20 })}<div><dt>Reported</dt><dd>${time(a.created_at)}</dd></div></div><div class="alert-reporter-icon">${Icons.svg('phone', { size: 20 })}<div><dt>Reporting channel</dt><dd>${e(a.reporting_channel || 'Not recorded')}</dd></div></div></dl></div></section>
    <section class="card alert-detail-card alert-description">${title('message-square', 'Description')}<p>${e(a.description || 'No description provided.')}</p></section>
    <section class="card alert-detail-card alert-photo">${title('camera', 'Uploaded photo')}<div class="alert-photo-area"><span class="alert-camera-art" aria-hidden="true">${Icons.svg('camera', { size: 32 })}</span><h3>${a.photo_name ? 'Uploaded photo' : 'No photo provided.'}</h3><p>${a.photo_name ? e(a.photo_name) : 'No images were uploaded for this incident.'}</p><small>Photos are represented by file names in this demo.</small></div></section>
    <div class="alert-detail-logs">${logs(a)}${logs(a, true)}</div>
  </div><aside class="alert-detail-rail" aria-label="Alert progress and assignments">
    ${timeline(a)}
    <section class="card alert-detail-card alert-location"><div class="alert-card-heading">${title('map-pin', 'Incident location')}<a class="btn btn-small" href="official-map.html?alert=${a.id}">View on map${Icons.svg('map', { size: 16 })}</a></div><div id="alert-map" class="alert-detail-map"></div><p>Approximate incident location.</p></section>
    ${personnel(a, role)}
  </aside></div>`;
}
