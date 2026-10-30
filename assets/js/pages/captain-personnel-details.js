import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
import { roleLabel, sourceLabel } from './captain-personnel-model.js';

const e = UI.escape;
// These two local line icons follow the existing SVG icon style.
function icon(name, size = 20) {
  const paths = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a23 23 0 0 0 18 0M10 12h4v3h-4z"/>',
  };
  return paths[name] ? `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>` : Icons.svg(name, { size });
}
const status = row => `<span class="cp-details-status${row.status === 'Active' ? ' is-active' : ''}"><i aria-hidden="true"></i>${e(row.status)}</span>`;
const facts = entries => `<dl class="cp-details-facts">${entries.map(([label, value, html = false]) => `<div><dt>${e(label)}</dt><dd>${html ? value : e(value || 'Not recorded')}</dd></div>`).join('')}</dl>`;
const columns = (left, right) => `<div class="cp-details-columns">${facts(left)}${facts(right)}</div>`;
const section = (name, subtitle, symbol, content) => `<section class="cp-details-section"><header><span class="cp-details-icon">${icon(symbol, 24)}</span><div><h3>${e(name)}</h3><p>${e(subtitle)}</p></div></header>${content}</section>`;

function history(row) {
  if (!row.history.length) return `<div class="cp-details-empty"><span aria-hidden="true">${icon('calendar', 28)}</span><div><strong>No appointment history recorded yet.</strong><p>Future role changes will preserve their effective date and responsible Captain.</p></div></div>`;
  return `<ol class="cp-details-history">${[...row.history].reverse().map(h => `<li><span class="cp-details-history-icon">${icon('calendar', 18)}</span><div><h4>${e(h.action)}${h.to_role ? ` · ${e(roleLabel(h.to_role))}` : h.from_role ? ` · ${e(roleLabel(h.from_role))}` : ''}</h4>${h.from_role && h.to_role ? `<p>${e(roleLabel(h.from_role))} to ${e(roleLabel(h.to_role))}</p>` : ''}<dl><div><dt>Effective date</dt><dd>${e(h.effective_date ? Fmt.date(h.effective_date) : 'Not recorded')}</dd></div><div><dt>Assigned by</dt><dd>${e(h.by_name || 'Not recorded')}</dd></div></dl><small>Recorded ${e(h.at ? Fmt.dateTime(h.at) : 'date not recorded')} · ${e(h.status || 'Status not recorded')}</small>${h.notes ? `<p class="cp-long-copy">${e(h.notes)}</p>` : ''}</div></li>`).join('')}</ol>`;
}

/** Presentation only: consumes the Captain API projection without changing staffing state. */
export function personnelDetails(row, barangay) {
  const appointment = row.history.filter(h => h.to_role === row.role && row.role).at(-1);
  const source = sourceLabel(row), barangayName = barangay || `Barangay #${row.barangay_id}`;
  const busy = row.busy_alert_ids?.length ? `<div class="banner banner-error"><div><p>This person is assigned to unresolved incidents. Complete, reassign, or cancel these responsibilities before changing the role.</p><div class="cp-busy-links">${row.busy_alert_ids.map(id => `<a href="official-alert.html?id=${Number(id)}">${e(Fmt.alertId(id))}</a>`).join('')}</div></div></div>` : '';
  return `<div class="cp-details-content" role="region" aria-label="Personnel information" tabindex="0">
    <div class="cp-details-profile"><span class="cp-avatar" aria-hidden="true">${e(Fmt.initials(row.full_name))}</span><div><h3>${e(row.full_name)}</h3><div class="cp-details-badges"><span class="cp-details-badge">${icon('user', 16)}${e(roleLabel(row.role))}</span><span class="cp-details-badge ${row.status === 'Active' ? 'green' : 'gray'}">${status(row)}</span><span class="cp-details-badge gray">${icon('users', 16)}${e(source)}</span></div><p>${icon('building-2', 16)}${e(barangayName)}</p></div></div>
    ${section('Personal information', 'Basic details about this personnel.', 'user', columns([['Full name', row.full_name], ['Home address', row.address]], [['Barangay', barangayName]]))}
    ${section('Contact information', 'Contact details for communication and emergencies.', 'mail', columns([['Email', row.email], ['Contact number', row.contact_number]], [['Emergency contact', row.emergency_contact]]))}
    ${section('Role details', 'Current role assignment and status.', 'briefcase', columns([['Assigned role', roleLabel(row.role)], ['Source', row.legacy ? null : source], ['Status', status(row), true]], [['Appointment date', row.appointed_at ? Fmt.date(row.appointed_at) : null], ['Assigned by', appointment?.by_name], ...(row.assignment_limit ? [['Active assignments', `${row.assignment_workload} of ${row.assignment_limit}`]] : [])]) + busy)}
    ${row.requirements.length || row.notes ? section('Requirements and notes', 'Recorded supporting documents and personnel notes.', 'file-text', `${row.requirements.length ? `<ul class="cp-file-list">${row.requirements.map(file => `<li>${e(file.name)} · ${Math.ceil(file.size / 1024)} KB</li>`).join('')}</ul><p class="cp-form-help">File details are recorded; file contents are not stored in this demo.</p>` : ''}${row.notes ? `<p class="cp-long-copy">${e(row.notes)}</p>` : ''}`) : ''}
    ${section('Appointment history', 'Record of role assignments and changes.', 'calendar', history(row))}
  </div><footer class="cp-dialog-footer cp-details-footer"><button type="button" class="btn" data-done>Close</button>${row.role ? '<button type="button" class="btn" data-detail-reassign>Reassign role</button><button type="button" class="btn cp-danger-outline" data-detail-remove>Remove from role</button>' : ''}</footer>`;
}
