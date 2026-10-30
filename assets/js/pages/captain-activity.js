import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
import { reportTimestamp } from './captain-reports-model.js';

const e = UI.escape;
const icon = (name, size = 20) => Icons.svg(name, { size });
const types = { alert: 'Alert', response: 'Response', rescue: 'Rescue', verification: 'Verification', announcement: 'Announcement', feedback: 'Feedback', personnel: 'Personnel', facility: 'Facility' };
const type = value => Object.hasOwn(types, value) ? types[value] : 'Activity';
const symbol = row => ({ alert: 'triangle-alert', response: 'activity', rescue: 'life-buoy', verification: 'shield-check', announcement: 'megaphone', feedback: 'message-square', personnel: 'users', facility: 'building-2' })[row.entity] || 'file-text';
const tone = row => row.entity === 'rescue' ? 'green' : row.entity === 'response' ? 'purple' : row.entity === 'feedback' ? 'amber' : '';
const evidence = row => row.source === 'audit' ? 'Recorded audit event' : row.source === 'record' ? 'Recorded source timestamp' : 'Not recorded';
const validDate = at => Number.isFinite(reportTimestamp(at));
const date = at => validDate(at) ? Fmt.dateTime(at) : 'Not recorded';
const time = at => validDate(at) ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(at)) : '';
const safeHref = href => /^(?:official-(?:alerts?|verifications?|feedback|announcements|map|facilities)|captain-(?:reports|personnel))\.html(?:\?[^#]*)?$/.test(String(href || '')) ? String(href) : null;

/** Same activity filters as Reports, with a presentation-only date sort and ten-row pages. */
export function activityPageData(activity, { q = '', entity = '', actor = '', range = '', sort = 'newest', page = 1 } = {}, { period, at } = {}) {
  const query = String(q).trim().toLowerCase();
  const filtered = activity.filter(row => (!entity || row.entity === entity) && (!actor || String(row.actor_id) === String(actor)) && (!range || (range === 'month' ? validDate(row.at) && new Date(reportTimestamp(row.at) + 8 * 3600000).toISOString().slice(0, 7) === period : reportTimestamp(row.at) >= reportTimestamp(at) - 7 * 86400000)) && (!query || [row.title, row.summary, row.actor, row.record_id].some(value => String(value ?? '').toLowerCase().includes(query))));
  filtered.sort((a, b) => (sort === 'oldest' ? 1 : -1) * (reportTimestamp(a.at) - reportTimestamp(b.at)) || String(a.id).localeCompare(String(b.id)));
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / 10)), selected = Math.max(1, Math.min(pages, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((selected - 1) * 10, selected * 10), total, pages, page: selected, size: 10 };
}

export function activityRows(rows) {
  if (!rows.length) return '<div class="activity-empty" role="status"><p>No recorded activity matches these filters.</p><small>Try another search, activity type, responsible user, or date range.</small></div>';
  return `<ol class="captain-activity-list">${rows.map(row => `<li><button type="button" data-activity="${e(row.id)}" aria-label="View ${e(row.title)} details"><span class="activity-icon ${tone(row)}">${icon(symbol(row), 24)}</span><span class="activity-row-copy"><strong>${e(row.title)}</strong><span>${e(row.summary || 'No additional details recorded.')}</span><span>By ${e(row.actor || 'Not recorded')}${row.actor_role ? ` · ${e(row.roleLabel)}` : ''}</span></span><span class="activity-row-date">${icon('clock')}<time${validDate(row.at) ? ` datetime="${e(row.at)}"` : ''}>${validDate(row.at) ? e(Fmt.date(row.at)) : 'Not recorded'}<span>${e(time(row.at))}</span></time></span>${icon('chevron-right', 18)}</button></li>`).join('')}</ol>`;
}

export function activityPagination({ page, pages, total, size = 10 }) {
  const start = Math.max(1, Math.min(page - 2, pages - 4)), end = Math.min(pages, start + 4), numbers = [];
  if (start > 1) numbers.push(1);
  if (start > 2) numbers.push(null);
  for (let i = start; i <= end; i++) numbers.push(i);
  if (end < pages - 1) numbers.push(null);
  if (end < pages) numbers.push(pages);
  const button = (value, label, disabled) => `<button type="button" class="btn" data-page="${value}"${disabled ? ' disabled' : ''}>${label}</button>`;
  return `<footer class="activity-pagination"><p role="status">Showing ${total ? (page - 1) * size + 1 : 0}–${Math.min(page * size, total)} of ${total} activities</p><nav aria-label="Activity pagination">${button(page - 1, 'Previous', page <= 1)}${numbers.map(i => i === null ? '<span aria-hidden="true">…</span>' : i === page ? `<span class="activity-current-page" aria-current="page" aria-label="Page ${i} of ${pages}">${i}</span>` : button(i, String(i), false)).join('')}${button(page + 1, 'Next', page >= pages)}</nav></footer>`;
}

export function activityDetails(row, recordLabel) {
  const href = safeHref(row.href), label = recordLabel || (row.record_id == null ? 'Linked record' : `${type(row.entity)} #${row.record_id}`);
  const fields = entries => `<dl>${entries.map(([name, value]) => `<div><dt>${e(name)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`;
  return `<p class="activity-detail-subtitle">Review audit information and the linked record.</p><div class="activity-detail-scroll" role="region" aria-label="Activity information and linked record" tabindex="0">
    <section class="activity-detail-summary"><span class="activity-icon ${tone(row)}">${icon(symbol(row), 28)}</span><div><h3>${e(row.title)}</h3><div class="activity-detail-badges"><span>${icon('user', 16)}${e(row.roleLabel && row.roleLabel !== 'Not recorded' ? row.roleLabel : 'Role not recorded')}</span><span>${icon('activity', 16)}${e(type(row.entity))}</span>${row.source ? `<span>${icon('clipboard-check', 16)}${e(evidence(row))}</span>` : ''}</div></div><time${validDate(row.at) ? ` datetime="${e(row.at)}"` : ''}>${icon('calendar', 16)}${e(date(row.at))}</time></section>
    <section class="activity-detail-section"><h3>Activity information</h3><div class="activity-info-columns">${fields([['Responsible user', row.actor || 'Not recorded'], ['Date and time', date(row.at)], ['Affected record', row.record_id == null ? 'Not recorded' : `#${row.record_id}`]])}${fields([['Role at action', row.roleLabel || 'Not recorded'], ['Activity type', type(row.entity)], ['Evidence', evidence(row)]])}</div></section>
    <section class="activity-detail-section"><h3>Linked record</h3>${href ? `<a class="activity-linked-record" data-open-affected href="${e(href)}"><span class="activity-icon">${icon('file-text', 24)}</span><span><strong>${e(label)}</strong><small>Open the associated ${e(type(row.entity).toLowerCase())} record</small></span>${icon('chevron-right', 18)}</a>` : '<p class="activity-detail-note">No linked record is available for this activity.</p>'}</section>
    <section class="activity-detail-section activity-event-description">${icon('file-text', 24)}<div><h3>Event description</h3><p>${e(row.summary || 'No additional details were recorded.')}</p></div></section>
  </div><footer class="activity-detail-footer">${href ? `<a class="btn btn-primary" data-open-affected href="${e(href)}">Open affected record</a>` : ''}<button type="button" class="btn" data-done>Close</button></footer>`;
}
