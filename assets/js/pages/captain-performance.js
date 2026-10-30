import { captainReportData } from './captain-reports-model.js';
import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';

const e = UI.escape;
const icon = (name, size = 20) => Icons.svg(name, { size });
const roles = { responder: { label: 'Responders', singular: 'Responder', icon: 'users', key: 'completedResponses', metric: 'Completed responses' }, rescuer: { label: 'Rescuers', singular: 'Rescuer', icon: 'life-buoy', key: 'completedRescues', metric: 'Completed rescues' }, secretary: { label: 'Secretaries', singular: 'Secretary', icon: 'user', key: 'reviewed', metric: 'Verifications reviewed' } };
const monthLabel = (period, short = false) => new Intl.DateTimeFormat('en-US', { month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }), timeZone: 'Asia/Manila' }).format(new Date(`${period}-01T00:00:00+08:00`));
const count = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0);

/** Presentation-only aggregation: use the same scoped, dated records as Reports. */
export function personnelPerformanceData(snapshot, options = {}, projection = null) {
  const role = Object.hasOwn(roles, options.role) ? options.role : 'responder';
  const current = projection || captainReportData(snapshot, options), config = roles[role];
  const trend = current.trend.map(row => ({ period: row.period, value: row[config.key] }));
  const rows = current.performance[role], value = count(rows, config.key), previous = trend.at(-2)?.value || 0;
  const third = role === 'responder'
    ? { value: current.metrics.responseSampleSize, label: 'Incidents with response time', note: 'across all responders', icon: 'clock' }
    : role === 'rescuer'
      ? { value: current.metrics.peopleAssisted, label: 'Known people assisted', note: `${current.metrics.unknownVictimIncidents} completed case${current.metrics.unknownVictimIncidents === 1 ? '' : 's'} with unknown counts`, icon: 'users' }
      : { value: count(rows, 'announcements'), label: 'Announcements published', note: 'this month', icon: 'megaphone' };
  return { role, period: current.period, rows, trend, counts: Object.fromEntries(Object.keys(roles).map(key => [key, current.performance[key].length])), metrics: [
    { value: rows.length, label: 'Total personnel', note: 'with available records', icon: config.icon },
    { value, label: config.metric, note: 'this month', icon: 'clipboard-check', previous, change: previous ? (value - previous) / previous * 100 : null },
    third,
  ] };
}

function tabs(p) {
  return `<div class="pp-tabs" role="tablist" aria-label="Personnel performance role">${Object.entries(roles).map(([key, config]) => `<button type="button" role="tab" id="reports-role-${key}" data-role="${key}" aria-selected="${p.role === key}" aria-controls="reports-performance-results" tabindex="${p.role === key ? 0 : -1}">${icon(config.icon)}<span>${config.label}</span><span class="pp-tab-count">${p.counts[key]}</span></button>`).join('')}</div>`;
}

function summary(metric, index) {
  const comparison = metric.change === undefined ? '' : `<span class="pp-comparison">${metric.change === null ? '<small>No previous-month baseline</small>' : `<span class="pp-change${metric.change < 0 ? ' pp-change-down' : ''}">${metric.change > 0 ? '↑ ' : metric.change < 0 ? '↓ ' : ''}${Math.abs(Math.round(metric.change))}%</span><small>vs. last month (${metric.previous})</small>`}</span>`;
  const decoration = index === 0 ? `<span class="pp-decoration" aria-hidden="true">${icon('users', 64)}</span>` : index === 2 ? '<span class="pp-decoration pp-decoration-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : '';
  return `<section class="pp-summary pp-summary-${index}"><span class="pp-summary-icon">${icon(metric.icon, 28)}</span><span class="pp-summary-copy"><strong>${metric.value}</strong><span>${e(metric.label)}</span><small>${e(metric.note)}</small></span>${comparison}${decoration}</section>`;
}

function trendChart(p) {
  const title = `${roles[p.role].metric} trend`, step = Math.max(2, Math.ceil(Math.max(0, ...p.trend.map(row => row.value)) / 3)), max = step * 3;
  return `<section class="pp-trend"><h3>${e(title)}</h3><figure><div class="pp-chart" role="img" aria-label="${e(`${title}. ${p.trend.map(row => `${monthLabel(row.period)}: ${row.value}`).join('; ')}`)}"><div class="pp-chart-axis" aria-hidden="true">${[3, 2, 1, 0].map(i => `<span>${i * step}</span>`).join('')}</div><div class="pp-chart-plot" aria-hidden="true"><div class="pp-chart-grid">${[0, 1, 2, 3].map(() => '<i></i>').join('')}</div><div class="pp-chart-columns">${p.trend.map(row => `<div class="pp-chart-column${row.period === p.period ? ' is-selected' : ''}"><div class="pp-chart-track"><span class="pp-chart-bar" style="height:${row.value / max * 100}%">${row.period === p.period ? `<strong>${row.value}</strong>` : ''}</span></div><span class="pp-chart-month">${e(monthLabel(row.period, true))}</span></div>`).join('')}</div></div></div><table class="sr-only"><caption>${e(title)}</caption><thead><tr><th scope="col">Month</th><th scope="col">${e(roles[p.role].metric)}</th></tr></thead><tbody>${p.trend.map(row => `<tr><th scope="row">${e(monthLabel(row.period))}</th><td>${row.value}</td></tr>`).join('')}</tbody></table></figure></section>`;
}

function overview(p) {
  return `<section class="pp-overview"><div class="pp-overview-heading"><span>${icon('calendar')}</span><h3>Monthly overview<small>${e(monthLabel(p.period))}</small></h3></div><dl>${p.metrics.map((metric, index) => `<div><dt>${e(metric.label)}${index === 0 ? ` (${roles[p.role].label})` : ''}</dt><dd>${metric.value}</dd></div>`).join('')}</dl></section>`;
}

function people(p) {
  const config = roles[p.role];
  return `<section class="pp-personnel"><div class="pp-personnel-heading"><h3>Personnel (${config.label})</h3><small>${p.rows.length} personnel</small></div>${p.rows.length ? `<ul>${p.rows.map(row => `<li><button type="button" class="pp-person" data-person="${row.id}" aria-label="View ${e(row.full_name)} performance"><span class="pp-avatar">${e(Fmt.initials(row.full_name))}</span><span class="pp-person-name"><strong>${e(row.full_name)}</strong><small>${config.singular}</small></span><span class="pp-status${row.status === 'Active' ? ' is-active' : ''}"><i aria-hidden="true"></i>${e(row.status)}</span><span class="pp-person-metric"><strong>${row[config.key]}</strong><small>${e(config.metric.toLowerCase())}${p.role === 'secretary' ? ` · ${row.announcements} published` : ''}</small></span>${icon('chevron-right', 18)}</button></li>`).join('')}</ul>` : '<p class="pp-empty">No personnel records are available for this role.</p>'}</section>`;
}

export function personnelPerformancePage(p) {
  const note = p.role === 'secretary' ? 'Reviews use recorded decisions and review dates. Publications use the recorded author and publication date.' : p.role === 'responder' ? 'Completed responses use actual Completed response logs and their recorded dates.' : 'Completed rescues use actual Completed rescue logs. Known people counts exclude unknown counts and count each incident once.';
  return `${tabs(p)}<div id="reports-performance-results" role="tabpanel" aria-labelledby="reports-role-${p.role}" tabindex="0"><div class="pp-summaries">${p.metrics.map(summary).join('')}</div><div class="pp-chart-overview">${trendChart(p)}${overview(p)}</div>${people(p)}<p class="pp-note">${icon('info', 16)}<span>${e(monthLabel(p.period))}. ${e(note)} Historical staff remain visible when work was recorded.</span></p></div>`;
}
