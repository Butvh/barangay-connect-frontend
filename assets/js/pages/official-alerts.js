import { Auth, Api, UI, Icons, Fmt, e, typeIcon, alertName, victims, facts, pagination, live, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { ALERT_STATUSES, ALERT_TYPES } from '../core/alertMachine.js';
import { alertSummary } from './official-alert-actions.js';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open alerts', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } }); }
if (user) {
  const main = Shell.official({ active: 'Alerts' }), size = 10;
  let page = 1, rows = [], request = 0, timer;
  const options = (label, values) => `<option value="">${label}</option>${values.map(v => `<option value="${e(v)}">${e(v)}</option>`).join('')}`;
  main.innerHTML = `<header class="official-heading"><h1>Alerts</h1><p>Monitor and manage emergency incidents in your barangay.</p></header><form class="official-alert-filters" role="search"><div class="field official-search-field"><label class="sr-only" for="alert-search">Search alerts</label><div>${Icons.svg('search', { size: 20 })}<input class="input" type="search" id="alert-search" name="q" maxlength="200" placeholder="Search incidents by ID, type, or location…"></div></div><div class="field"><label class="sr-only" for="alert-status">Alert status</label><select class="select" id="alert-status" name="status">${options('All statuses', ALERT_STATUSES)}</select></div><div class="field"><label class="sr-only" for="alert-type">Disaster type</label><select class="select" id="alert-type" name="alert_type">${options('All disaster types', ALERT_TYPES)}</select></div><div class="field"><label class="sr-only" for="alert-sort">Sort alerts</label><select class="select" id="alert-sort" name="sort"><option value="newest">Sort by: Newest</option><option value="oldest">Sort by: Oldest</option></select></div></form><div id="alert-results" aria-live="polite">${UI.skeleton(3)}</div>`;
  const form = main.querySelector('form'), results = main.querySelector('#alert-results');
  function incident(a) {
    const assigned = a.status === 'Resolved' ? 'Closed' : a.assigned_rescuer ? `${a.assigned_rescuer.full_name} (Rescuer)` : a.assigned_responder ? `${a.assigned_responder.full_name} (Responder)` : 'Awaiting acknowledgement';
    return `<tr><td><div class="official-incident-overview"><span class="icon-tile ${a.status === 'Resolved' ? 'green' : ''}">${Icons.svg(typeIcon(a.alert_type), { size: 32 })}</span><div class="stack-sm"><h3>${e(alertName(a))}</h3>${UI.badge(a.status)}<p class="official-incident-description">${e(a.description || 'No description provided.')}</p></div></div></td><td>${facts([['Location', a.location_label], ['Reporter', a.resident?.full_name || 'Not provided'], ['Victims', victims(a.victim_count)]])}</td><td>${facts([['Assigned to', assigned], ['Reported at', Fmt.dateTime(a.created_at)]])}</td><td><a class="btn btn-primary official-incident-view" href="official-alert.html?id=${a.id}" data-alert="${a.id}">View alert details ${Icons.svg('chevron-right', { size: 20 })}</a></td></tr>`;
  }
  function show() {
    const pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.max(1, Math.min(page, pages));
    const visible = rows.slice((page - 1) * size, page * size), focused = results.contains(document.activeElement) ? document.activeElement.dataset.alert : null;
    results.innerHTML = `<section class="card official-incidents"><header class="official-incident-heading"><h2>All Barangay Incidents</h2><span class="official-result-count">${rows.length}</span></header>${rows.length ? `<table class="official-incident-table"><colgroup><col class="incident-overview-col"><col class="incident-location-col"><col class="incident-assignment-col"><col class="incident-action-col"></colgroup><caption class="sr-only">Barangay alerts, location, reporter, victims, assignment and time</caption><thead class="sr-only"><tr><th scope="col">Incident and status</th><th scope="col">Location, reporter and victims</th><th scope="col">Assignment and reported time</th><th scope="col">View</th></tr></thead><tbody>${visible.map(incident).join('')}</tbody></table>${pagination({ page, pages, total: rows.length, size, noun: 'alerts' })}` : UI.empty({ icon: 'triangle-alert', title: 'No matching alerts', text: 'Try another search or clear your filters.' }) + '<div class="official-empty-action"><button type="button" class="btn" data-clear-filters>Clear filters</button></div>'}</section>`;
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); show(); results.querySelector('h2').tabIndex = -1; results.querySelector('h2').focus(); }));
    results.querySelector('[data-clear-filters]')?.addEventListener('click', () => { form.reset(); page = 1; refresh(); form.elements.q.focus(); });
    results.querySelectorAll('[data-alert]').forEach(link => link.addEventListener('click', event => { if (matchMedia('(min-width:1024px)').matches || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); const alert = rows.find(a => a.id === Number(link.dataset.alert)); if (alert) alertSummary(alert); }));
    if (focused) results.querySelector(`[data-alert="${Number(focused)}"]`)?.focus();
  }
  async function refresh() {
    const version = ++request; results.setAttribute('aria-busy', 'true');
    try {
      const values = new FormData(form), q = String(values.get('q')).trim();
      // Search type/description locally too; the frozen API search covers ID/location/reporter.
      const alerts = await Api.alerts.list({ status: values.get('status'), alert_type: values.get('alert_type') }); if (version !== request) return;
      rows = alerts.filter(a => !q || [Fmt.alertId(a.id), a.alert_type, a.location_label, a.resident?.full_name, a.description].some(value => String(value || '').toLowerCase().includes(q.toLowerCase())));
      if (values.get('sort') === 'oldest') rows.reverse(); show();
    } catch (err) { if (version === request) errorView(results, err, refresh); }
    finally { if (version === request) results.removeAttribute('aria-busy'); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); page = 1; refresh(); });
  form.elements.q.addEventListener('input', () => { clearTimeout(timer); page = 1; timer = setTimeout(refresh, 180); });
  form.querySelectorAll('select').forEach(select => select.addEventListener('change', () => { page = 1; refresh(); }));
  live(['alerts'], refresh)(); window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
}
