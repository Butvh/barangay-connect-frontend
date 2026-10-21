import { Auth, Api, Store, UI, Fmt, e, dialog, pagination, live } from './official-shared.js';
import { Icons } from '../core/icons.js?v=feedback-summary-1';
import { Shell } from '../core/shell-official.js';
import { FEEDBACK_TYPES, FEEDBACK_STATUSES, feedbackText, feedbackPage, feedbackStats, feedbackRequestId } from './official-feedback-model.js?v=feedback-summary-1';

let user;
try { Auth.requireRole(['secretary']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open feedback', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Feedback' }), params = new URLSearchParams(location.search), size = 10;
  let type = Object.hasOwn(FEEDBACK_TYPES, params.get('type')) ? params.get('type') : 'complaint', records = [], version = 0, loaded = false, stale = false, saving = false, requested = feedbackRequestId(location.search);
  const states = Object.fromEntries(Object.keys(FEEDBACK_TYPES).map(key => [key, { q: '', status: '', sort: 'newest', page: 1, id: null }]));
  Object.assign(states[type], { q: (params.get('q') || '').slice(0, 200), status: type !== 'general' && FEEDBACK_STATUSES.includes(params.get('status')) ? params.get('status') : '', sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest', page: Math.max(1, Math.trunc(Number(params.get('page'))) || 1) });
  main.innerHTML = `<header class="official-heading"><h1>Feedback</h1><p>Review concerns, suggestions, and resident feedback submissions.</p></header><div class="tabs official-feedback-tabs" role="tablist" aria-label="Feedback type">${Object.entries(FEEDBACK_TYPES).map(([key, label]) => `<button type="button" class="tab" role="tab" id="tab-${key}" data-value="${key}" aria-controls="feedback-${key}" aria-selected="${key === type}" tabindex="${key === type ? 0 : -1}">${label}</button>`).join('')}</div><div class="banner banner-error" role="alert" data-load-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><div class="banner banner-error" role="alert" data-link-error hidden><span class="grow">The requested feedback is unavailable or no longer matches these filters. Select a visible submission to continue.</span><button type="button" class="icon-btn" aria-label="Dismiss unavailable feedback">${Icons.svg('x')}</button></div>${Object.keys(FEEDBACK_TYPES).map(key => `<section role="tabpanel" id="feedback-${key}" aria-labelledby="tab-${key}"${key !== type ? ' hidden' : ''}></section>`).join('')}`;
  const error = main.querySelector('[data-load-error]'), tabs = main.querySelector('[role="tablist"]');
  let panel, results, detail, form, summaryAt;
  const state = () => states[type];
  function url() { const s = state(), p = new URLSearchParams({ type }); if (s.q) p.set('q', s.q); if (s.status && type !== 'general') p.set('status', s.status); if (s.sort === 'oldest') p.set('sort', s.sort); if (s.page > 1) p.set('page', s.page); if (s.id !== null) p.set('id', s.id); history.replaceState(null, '', `official-feedback.html?${p}`); }
  function rating(row) { return `<span class="official-feedback-rating">${Icons.svg('star', { size: 20 })}<span>${Number(row.rating)} of 5</span></span>`; }
  function summary() {
    if (!loaded) return;
    try { summaryAt = Store.now(); } catch { /* Use the last known reference while load errors offer recovery. */ }
    if (!summaryAt) { panel.querySelector('[data-stats]').innerHTML = '<p>Summary unavailable until feedback loads.</p>'; return; }
    const stats = feedbackStats(records, summaryAt), values = stats[type], general = type === 'general';
    const cards = type === 'complaint'
      ? [[values.Pending, 'Pending complaints', 'Needs action', 'file-text', 'amber'], [values.Assigned, 'Assigned complaints', 'Sent to Tanod', 'users', ''], [values.Resolved, 'Resolved complaints', 'Marked resolved', 'circle-check', 'green']]
      : type === 'suggestion'
        ? [[values.new, 'New suggestions', 'Submitted this week', 'lightbulb', ''], [values.review, 'Under review', 'Awaiting action', 'clock', 'amber'], [values.implemented, 'Implemented', 'Marked as implemented', 'check', 'green']]
        : [[values.average === null ? '—' : values.average.toFixed(1), 'Average rating', 'out of 5', 'star', ''], [values.received, 'Feedback received', 'this month', 'message-circle', ''], [values.positive === null ? '—' : `${values.positive}%`, 'Positive responses', 'rated 4–5', 'thumbs-up', 'green']];
    panel.querySelector('[data-stats]').innerHTML = cards.map(([value, title, hint, icon, tone]) => `<section class="card official-review-stat" aria-label="${title}"><span class="icon-tile round ${tone}${icon === 'star' ? ' official-feedback-stat-star' : ''}">${Icons.svg(icon, { size: 28 }).replace('icons.svg#thumbs-up', 'icons.svg?v=feedback-summary-1#thumbs-up')}</span><div><p>${title}</p><div class="official-feedback-stat-value"><strong>${value}</strong>${general ? `<small>${hint}</small>` : ''}</div>${general ? '' : `<small>${hint}</small>`}</div></section>`).join('');
  }
  function build() {
    panel = main.querySelector(`#feedback-${type}`);
    const general = type === 'general', s = state();
    panel.className = 'official-feedback-panel';
    panel.innerHTML = `<div class="official-review-stats official-feedback-stats" data-stats aria-label="${FEEDBACK_TYPES[type]} summary">${Array.from({ length: 3 }, () => '<div class="skeleton" aria-hidden="true"></div>').join('')}</div><div class="official-feedback-grid"><section class="card official-feedback-list"><form class="official-feedback-filters" novalidate><div class="field official-review-search"><label class="sr-only" for="search-${type}">Search ${FEEDBACK_TYPES[type].toLowerCase()}</label><div>${Icons.svg('search', { size: 20 })}<input class="input" type="search" id="search-${type}" name="q" maxlength="200" value="${e(s.q)}" placeholder="Search ${FEEDBACK_TYPES[type].toLowerCase()}…"><button type="button" class="icon-btn" data-clear-search aria-label="Clear search"${s.q ? '' : ' hidden'}>${Icons.svg('x')}</button></div></div>${!general ? `<div class="field"><label class="sr-only" for="status-${type}">Status</label><select class="select" name="status" id="status-${type}"><option value="">All statuses</option>${FEEDBACK_STATUSES.map(v => `<option${s.status === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}<div class="field"><label class="sr-only" for="sort-${type}">Sort feedback</label><select class="select" name="sort" id="sort-${type}"><option value="newest">Newest first</option><option value="oldest"${s.sort === 'oldest' ? ' selected' : ''}>Oldest first</option></select></div></form><div data-results aria-busy="true">${UI.skeleton(2)}</div></section><aside class="card official-feedback-detail" aria-label="Selected feedback"></aside></div>`;
    form = panel.querySelector('form'); results = panel.querySelector('[data-results]'); detail = panel.querySelector('aside');
    function filter(keepSelection = false) { Object.assign(state(), { q: form.elements.q.value.trim(), status: form.elements.status?.value || '', sort: form.elements.sort.value, page: 1, id: keepSelection === true ? state().id : null }); render(); }
    form.addEventListener('submit', event => { event.preventDefault(); filter(); }); form.elements.q.addEventListener('input', event => { if (!event.isComposing) filter(); }); form.elements.q.addEventListener('compositionend', filter);
    form.querySelectorAll('select').forEach(select => select.addEventListener('change', () => filter(select.name === 'sort'))); form.querySelector('[data-clear-search]').addEventListener('click', () => { form.elements.q.value = ''; filter(); form.elements.q.focus(); });
    if (loaded) render();
    else if (stale) panel.querySelector('[data-stats]').innerHTML = '<p>Summary unavailable until feedback loads.</p>';
  }
  function renderDetail(row) {
    if (!row) { detail.innerHTML = '<p>Select a submission to read its details.</p>'; return; }
    const general = row.type === 'general';
    detail.innerHTML = `<h2 tabindex="-1">${general ? 'General Feedback' : e(feedbackText(row))}</h2><p class="official-feedback-meta"><span>${Icons.svg('user', { size: 20 })}${e(row.resident?.full_name || 'Not provided')}</span><span>${Icons.svg('calendar', { size: 20 })}${e(Fmt.dateTime(row.created_at))}</span></p>${general ? `<hr class="divider">${rating(row)}<p class="official-long-copy">${e(row.comment)}</p>` : `<hr class="divider"><div class="stack-sm"><small>Status</small>${UI.badge(row.status)}</div><hr class="divider"><div class="stack-sm"><h3>Details</h3><p class="official-long-copy">${e(row.description)}</p><small>Category: ${e(row.category)}<br>Location: ${e(row.location || 'Not provided')}</small></div><hr class="divider"><div class="stack-sm"><small>Assigned Tanod</small><p>${row.assigned_tanod ? `Tanod ${e(row.assigned_tanod.full_name)}` : 'Unassigned'}</p></div>${row.status !== 'Resolved' ? `<div class="stack-sm" data-actions>${row.status === 'Pending' ? `<button type="button" class="btn btn-primary" data-assign${stale || saving ? ' disabled' : ''}>${Icons.svg('users', { size: 20 })}Assign Tanod</button>` : ''}<button type="button" class="btn" data-resolve${stale || saving ? ' disabled' : ''}>${Icons.svg('check', { size: 20 })}Mark resolved</button></div>` : '<p>Resolved feedback is read-only.</p>'}`}<div class="banner banner-error" role="alert" data-action-error hidden></div>`;
    detail.querySelector('[data-assign]')?.addEventListener('click', () => assign(row)); detail.querySelector('[data-resolve]')?.addEventListener('click', () => resolve(row));
  }
  function render() {
    if (!loaded) return;
    const s = state(), selectedFocus = results.contains(document.activeElement) ? document.activeElement.dataset.record : null, value = feedbackPage(records, { ...s, type, size }); s.page = value.page;
    const selected = value.selected; if (selected) s.id = selected.id;
    s.reveal = false; s.q = value.q; s.status = value.status;
    if (value.filtersCleared) { form.elements.q.value = s.q; if (form.elements.status) form.elements.status.value = s.status; UI.toast('Search and status filters cleared to show the linked feedback.'); }
    main.querySelector('[data-link-error]').hidden = !value.selectionMissing; url(); summary();
    const general = type === 'general', complaint = type === 'complaint', labels = [general ? 'Comment' : 'Title', 'Resident', 'Date', ...(complaint ? ['Assignee'] : []), general ? 'Rating' : 'Status'];
    results.innerHTML = value.total ? `<table class="official-feedback-table"><caption class="sr-only">${FEEDBACK_TYPES[type]} submitted by residents</caption><thead><tr>${labels.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${value.rows.map(row => `<tr class="${row.id === s.id ? 'is-selected' : ''}"><td data-label="${labels[0]}"><button type="button" class="official-feedback-record" data-record="${row.id}" aria-label="View details: ${e(feedbackText(row))}" aria-pressed="${row.id === s.id}">${e(feedbackText(row))}</button></td><td data-label="Resident">${e(row.resident?.full_name || 'Not provided')}</td><td data-label="Date">${e(Fmt.date(row.created_at))}</td>${complaint ? `<td data-label="Assignee">${e(row.assigned_tanod?.full_name || 'Unassigned')}</td>` : ''}<td data-label="${labels.at(-1)}">${general ? rating(row) : UI.badge(row.status)}</td></tr>`).join('')}</tbody></table>${pagination({ ...value, size, noun: FEEDBACK_TYPES[type].toLowerCase() })}` : `${UI.empty({ icon: 'message-square', title: records.some(row => row.type === type) ? 'No matching feedback' : 'No submissions yet', text: 'Resident submissions in this category will appear here. Try changing your search or status filter.' })}${s.q || s.status ? '<button type="button" class="btn" data-clear-filters>Clear filters</button>' : ''}`;
    results.removeAttribute('aria-busy'); form.querySelector('[data-clear-search]').hidden = !form.elements.q.value;
    results.querySelectorAll('[data-record]').forEach(button => button.addEventListener('click', () => { s.id = Number(button.dataset.record); render(); detail.querySelector('h2')?.focus(); }));
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { s.page = Number(button.dataset.page); s.id = null; render(); results.tabIndex = -1; results.focus(); }));
    results.querySelector('[data-clear-filters]')?.addEventListener('click', () => { Object.assign(s, { q: '', status: '', page: 1, id: null }); form.elements.q.value = ''; if (form.elements.status) form.elements.status.value = ''; render(); form.elements.q.focus(); });
    renderDetail(selected); if (selectedFocus) results.querySelector(`[data-record="${Number(selectedFocus)}"]`)?.focus({ preventScroll: true });
  }
  function actionError(err) { const box = detail.querySelector('[data-action-error]'); if (!box) { UI.toast(err.message, 'error'); return; } box.textContent = err.message; box.hidden = false; box.tabIndex = -1; box.focus(); }
  async function assign(row) {
    if (saving || stale) return;
    const el = dialog('Assign Tanod', '<div class="stack" data-assignment><p>Loading the barangay Tanod…</p></div>', { beforeClose: () => !saving });
    try {
      // This prototype has one seeded Tanod (DATA-MODEL.md), not a staff directory.
      const tanod = await Api.users.get(6); if (!el.open) return;
      if (!tanod.is_tanod || tanod.barangay_id !== user.barangay_id) throw new Error('No Tanod is available in this barangay.');
      const body = el.querySelector('[data-assignment]'); body.innerHTML = `<p>Assign this ${row.type} to a barangay Tanod. The resident will receive an update.</p><div class="field"><label for="feedback-tanod">Tanod</label><select class="select" id="feedback-tanod"><option value="${tanod.id}">Tanod ${e(tanod.full_name)}</option></select></div><div class="banner banner-error" role="alert" data-save-error hidden></div><div class="actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn btn-primary" data-save>Assign Tanod</button></div>`;
      body.querySelector('[data-cancel]').addEventListener('click', () => UI.closeDialog(el));
      body.querySelector('[data-save]').addEventListener('click', async () => { if (saving) return; saving = true; el.setAttribute('aria-busy', 'true'); el.querySelectorAll('button,select').forEach(c => c.disabled = true);
        try { await Api.feedback.assignTanod(row.id, Number(body.querySelector('select').value)); UI.closeDialog(el); await load(); UI.toast('Feedback assigned to Tanod.'); detail.querySelector('h2')?.focus(); }
        catch (err) { const box = body.querySelector('[data-save-error]'); box.textContent = err.message; box.hidden = false; box.tabIndex = -1; box.focus(); await load(); }
        finally { saving = false; el.removeAttribute('aria-busy'); el.querySelectorAll('button,select').forEach(c => c.disabled = false); render(); if (!el.open) detail.querySelector('h2')?.focus(); }
      });
    } catch (err) { el.querySelector('[data-assignment]').innerHTML = `<p role="alert">${e(err.message)}</p><button type="button" class="btn" data-done>Done</button>`; el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el)); }
  }
  async function resolve(row) {
    if (saving || stale) return; saving = true;
    try { if (!await UI.confirm({ title: 'Mark feedback resolved?', text: `Mark this ${row.type} as resolved? The resident will receive an update and this record will become read-only.`, confirmLabel: 'Mark resolved' })) return; await Api.feedback.resolve(row.id); await load(); UI.toast('Feedback marked resolved.'); detail.querySelector('h2')?.focus(); }
    catch (err) { await load(); actionError(err); }
    finally { saving = false; detail.querySelectorAll('[data-actions] button').forEach(button => button.disabled = stale); }
  }
  async function load() {
    const request = ++version;
    try { const rows = await Api.feedback.list(); if (request !== version) return; records = rows; loaded = true; stale = false; error.hidden = true;
      if (requested !== null) { const row = rows.find(r => r.id === requested), id = requested; requested = null; if (row) type = row.type; Object.assign(states[type], { id, reveal: true }); tabs.querySelector(`[data-value="${type}"]`).click(); }
      render(); refreshSummaryClock();
    } catch (err) { if (request !== version) return; stale = true; error.querySelector('.grow').textContent = `${loaded ? 'Feedback could not refresh. Displayed records may be out of date.' : 'Unable to load feedback.'} ${err.message}`; error.hidden = false; if (loaded) render(); else { panel.querySelector('[data-stats]').innerHTML = '<p>Summary unavailable until feedback loads.</p>'; results.removeAttribute('aria-busy'); results.innerHTML = UI.empty({ icon: 'message-square', title: 'Feedback unavailable', text: 'Use Try again to reload submissions.' }); } }
  }
  UI.tabs(tabs); tabs.addEventListener('tabchange', event => { type = event.detail; build(); url(); }); build();
  main.querySelector('[data-retry]').addEventListener('click', load); main.querySelector('[data-link-error] button').addEventListener('click', () => { main.querySelector('[data-link-error]').hidden = true; tabs.querySelector('[aria-selected="true"]').focus(); });
  let summaryTimer;
  const refreshSummaryClock = () => {
    clearTimeout(summaryTimer);
    if (document.hidden) return;
    summary();
    let now;
    try { now = Date.parse(Store.now()); } catch { return; }
    const day = 86400000;
    if (Number.isFinite(now)) summaryTimer = setTimeout(refreshSummaryClock, day - ((now + 8 * 3600000) % day) + 25);
  };
  document.addEventListener('visibilitychange', refreshSummaryClock);
  refreshSummaryClock();
  window.addEventListener('pagehide', () => clearTimeout(summaryTimer), { once: true });
  live(['feedback', 'users'], load)(); window.addEventListener('pagehide', event => { if (!event.persisted) version++; }, { once: true });
}
