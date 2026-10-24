import { Auth, Api, UI, Fmt, e, alertName, victims, pagination, live, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { ALERT_STATUSES, ALERT_TYPES } from '../core/alertMachine.js';
import { alertSummary } from './official-alert-actions.js';
import { alertWorkspace, alertsPage, incidentAssignment } from './official-alerts-model.js';
import { mountAlertSelect } from './official-alert-select.js';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open alerts', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } }); }
if (user) {
  const role = Auth.roleOf(user), secretary = role === 'secretary', main = Shell.official({ active: 'Alerts' }), size = 10;
  main.classList.add('alerts-page');
  let page = 1, records = [], request = 0, timer, area = '';
  const icon = (name, size = 24) => `<img src="assets/img/source/alert-${name}.svg" width="${size}" height="${size}" alt="" aria-hidden="true">`;
  const options = (label, items) => `<option value="">${label}</option>${items.map(v => `<option value="${e(v)}">${e(v)}</option>`).join('')}`;
  main.innerHTML = `<div class="alerts-introduction"><header class="official-heading"><h1>${secretary ? 'Alerts' : 'Assigned alerts'}</h1><p id="alerts-subtitle"></p></header><form class="alerts-filters${secretary ? ' alerts-filters-secretary' : ''}" role="search"><div class="field alerts-search"><label class="sr-only" for="alert-search">Search incidents</label><div>${icon('search', 20)}<input class="input" type="search" id="alert-search" name="q" maxlength="200" placeholder="Search incidents by ID, type, or location..."></div></div><div class="field"><label class="sr-only" for="alert-status">Alert status</label><select class="select" id="alert-status" name="status">${options('All statuses', ALERT_STATUSES)}</select></div>${secretary ? `<div class="field"><label class="sr-only" for="alert-type">Disaster type</label><select class="select" id="alert-type" name="alert_type">${options('All disaster types', ALERT_TYPES)}</select></div>` : ''}<div class="field"><label class="sr-only" for="alert-sort">Sort alerts</label><select class="select" id="alert-sort" name="sort"><option value="newest">Sort by: Newest</option><option value="oldest">Sort by: Oldest</option></select></div></form><div class="alerts-active-filters" hidden aria-label="Active filters"></div></div><div id="alert-results" aria-live="polite">${UI.skeleton(3)}</div>`;
  const form = main.querySelector('form'), results = main.querySelector('#alert-results'), activeFilters = main.querySelector('.alerts-active-filters');
  const selects = [...form.querySelectorAll('select')].map(mountAlertSelect);
  const sameSession = () => { const current = Auth.current(); return current?.id === user.id && current?.barangay_id === user.barangay_id && Auth.roleOf(current) === role; };
  const guardSession = () => { if (sameSession()) return true; records = []; results.replaceChildren(); location.reload(); return false; };
  const subtitle = () => { main.querySelector('#alerts-subtitle').textContent = secretary ? `Monitor and manage emergency incidents in ${area || 'your barangay'}` : `${role === 'responder' ? 'Responder' : 'Rescuer'} workspace · ${area || 'Your barangay'}`; }; subtitle();
  const values = () => Object.fromEntries(new FormData(form));
  const fact = (glyph, label, value, visible = false) => `<div class="incident-fact">${icon(glyph)}<div><dt${visible ? '' : ' class="sr-only"'}>${e(label)}</dt><dd>${e(value)}</dd></div></div>`;
  function incident(a) {
    const assignment = incidentAssignment(a, user), tone = a.status === 'Resolved' ? 'resolved' : a.status === 'Rescue in progress' ? 'rescue' : 'pending';
    const description = role === 'rescuer' ? [...(a.responses || [])].sort((x, y) => Date.parse(y.responded_at) - Date.parse(x.responded_at)).find(r => r.notes?.trim())?.notes || a.description : a.description;
    return `<article class="incident-row" aria-labelledby="incident-${a.id}"><div class="incident-overview"><span class="incident-indicator ${tone}">${icon(tone, 40)}</span><div class="incident-copy"><h3 id="incident-${a.id}">${e(alertName(a))}</h3>${UI.badge(a.status)}<p class="incident-description">${e(description || 'No description provided.')}</p></div></div><dl class="incident-location">${fact('pin', 'Location', a.location_label ? !area || a.location_label.includes(area) ? a.location_label : a.location_label + ', ' + area : 'Not provided')}${secretary ? fact('user', 'Reporter', a.resident?.full_name || 'Not provided') : ''}${fact('users', 'Victims', a.victim_count == null ? 'Victims not confirmed' : victims(a.victim_count))}</dl><dl class="incident-assignment">${fact('user', 'Assigned to:', assignment.person, true)}${fact('clock', assignment.timeLabel, assignment.at ? Fmt.dateTime(assignment.at) : 'Not recorded', true)}</dl><div class="incident-action"><a class="btn btn-primary" href="official-alert.html?id=${a.id}" data-alert="${a.id}" aria-label="${secretary ? 'View alert details' : 'Open incident details'}: ${e(alertName(a))}"><span>${secretary ? 'View alert details' : 'Open incident details'}</span>${icon('action-chevron')}</a></div></article>`;
  }
  function clearFilters() { clearTimeout(timer); form.reset(); selects.forEach(control => control.sync()); page = 1; refresh(); form.elements.q.focus(); }
  function showFilters() {
    const { q, status, alert_type, sort } = values();
    const labels = [q.trim() && `Search: ${q.trim()}`, status, alert_type, sort === 'oldest' && 'Oldest first'].filter(Boolean);
    activeFilters.hidden = !labels.length;
    activeFilters.innerHTML = labels.map(label => `<span>${e(label)}</span>`).join('') + '<button type="button" class="btn btn-ghost btn-small">Clear filters</button>';
    activeFilters.querySelector('button').addEventListener('click', clearFilters);
  }
  function show() {
    if (!guardSession()) return;
    const data = alertsPage(records, user, { ...values(), page, size }); page = data.page;
    const focused = results.contains(document.activeElement) ? document.activeElement.dataset.alert : null;
    results.innerHTML = `<section class="alerts-incidents" aria-labelledby="incidents-title"><header class="alerts-list-heading"><h2 id="incidents-title">${secretary ? 'All Barangay Incidents' : 'My assigned incidents'}</h2><span class="alerts-result-count" aria-label="${data.total} matching incidents">${data.total}</span></header>${data.total ? data.rows.map(incident).join('') + pagination({ ...data, size, noun: 'alerts' }) : UI.empty({ icon: 'triangle-alert', title: 'No matching incidents', text: secretary ? 'Try another search or clear your filters.' : 'No assigned incidents match these filters.' }) + '<div class="official-empty-action"><button type="button" class="btn" data-clear-filters>Clear filters</button></div>'}</section>`;
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); show(); const heading = results.querySelector('h2'); heading.tabIndex = -1; heading.focus(); }));
    results.querySelector('[data-clear-filters]')?.addEventListener('click', clearFilters);
    results.querySelectorAll('[data-alert]').forEach(link => link.addEventListener('click', async event => {
      if (matchMedia('(min-width:1024px)').matches || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (!guardSession()) return;
      try { const alert = await Api.alerts.get(Number(link.dataset.alert)); if (guardSession()) alertSummary(alert); }
      catch (error) { UI.toast(error.message, 'error'); refresh(); }
    }));
    if (focused) results.querySelector(`[data-alert="${Number(focused)}"]`)?.focus(); showFilters();
  }
  async function refresh() {
    if (!guardSession()) return;
    const version = ++request; results.setAttribute('aria-busy', 'true');
    try { const data = await alertWorkspace(Api, user); if (version !== request || !guardSession()) return; records = data.alerts; area = data.area; subtitle(); show(); }
    catch (error) { if (version === request && guardSession()) errorView(results, error, refresh); }
    finally { if (version === request) results.removeAttribute('aria-busy'); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); page = 1; refresh(); });
  form.elements.q.addEventListener('input', () => { clearTimeout(timer); page = 1; timer = setTimeout(refresh, 180); });
  form.querySelectorAll('select').forEach(select => select.addEventListener('change', () => { clearTimeout(timer); page = 1; refresh(); }));
  live(['alerts', 'users'], refresh)();
  window.addEventListener('pagehide', event => { clearTimeout(timer); selects.forEach(control => event.persisted ? control.close() : control.destroy()); }, { once: true });
}
