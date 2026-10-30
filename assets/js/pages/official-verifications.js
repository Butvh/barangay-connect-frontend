import { Auth, Api, Store, UI, Icons, Fmt, e, pagination, live } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { VERIFICATION_STATUSES, verificationPage, verificationStats } from './official-verification-model.js';

let user;
try { Auth.requireRole(['secretary', 'captain']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open verifications', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Verifications' }), initial = new URLSearchParams(location.search), size = 10;
  const state = { q: (initial.get('q') || '').slice(0, 200), status: VERIFICATION_STATUSES.includes(initial.get('status')) ? initial.get('status') : '', sort: initial.get('sort') === 'oldest' ? 'oldest' : 'newest', page: Math.max(1, Number(initial.get('page')) || 1) };
  let records = [], barangay = '', version = 0, loaded = false;
  const notice = ['Approved', 'Rejected'].includes(initial.get('notice')) ? initial.get('notice') : null;
  main.innerHTML = `<header class="official-heading"><h1>Verification queue</h1><p>Review resident account submissions and household legitimacy documents.</p></header>${notice ? `<div class="banner banner-success" role="status" data-review-notice><span class="grow">Verification ${notice.toLowerCase()}.</span><button type="button" class="icon-btn" aria-label="Dismiss saved message">${Icons.svg('x')}</button></div>` : ''}<div class="official-review-stats" aria-label="Verification summary">${UI.skeleton(3)}</div><form class="card official-verification-filters" role="search" novalidate><div class="field official-review-search"><label for="verification-search" class="sr-only">Search resident name or household address</label><div>${Icons.svg('search', { size: 20 })}<input class="input" id="verification-search" name="q" type="search" maxlength="200" placeholder="Search resident name or household address…" value="${e(state.q)}"><button type="button" class="icon-btn" data-clear-search aria-label="Clear search"${state.q ? '' : ' hidden'}>${Icons.svg('x', { size: 20 })}</button></div></div><div class="field"><label for="verification-status">Status</label><select class="select" id="verification-status" name="status"><option value="">All statuses</option>${VERIFICATION_STATUSES.map(s => `<option${s === state.status ? ' selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="verification-sort">Sort by</label><select class="select" id="verification-sort" name="sort"><option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Newest first</option><option value="oldest"${state.sort === 'oldest' ? ' selected' : ''}>Oldest first</option></select></div></form><div class="banner banner-error" role="alert" data-review-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><section class="card official-verification-records" aria-label="Verification records" aria-busy="true"><p class="sr-only" role="status">Loading verification records…</p>${UI.skeleton(3)}</section>`;
  const results = main.querySelector('.official-verification-records'), stats = main.querySelector('.official-review-stats'), form = main.querySelector('form'), error = main.querySelector('[data-review-error]');
  main.querySelector('[data-review-notice] button')?.addEventListener('click', () => { main.querySelector('[data-review-notice]').remove(); form.elements.q.focus(); });
  function query() { const p = new URLSearchParams(); if (state.q) p.set('q', state.q); if (state.status) p.set('status', state.status); if (state.sort !== 'newest') p.set('sort', state.sort); if (state.page > 1) p.set('page', state.page); return p; }
  function summary() {
    const values = verificationStats(records, Store.now());
    stats.innerHTML = [['clock', 'Pending review', values.pending, 'Waiting for your review', 'amber'], ['calendar', 'Due today', values.due, 'Need action today', 'red'], ['circle-check', 'Reviewed today', values.reviewed, 'Approved or rejected', 'green']].map(([icon, title, count, hint, tone]) => `<section class="card official-review-stat"><span class="icon-tile round ${tone}">${Icons.svg(icon, { size: 28 })}</span><div><p>${title}</p><strong>${count}</strong><small>${hint}</small></div></section>`).join('');
  }
  function record(row, back) {
    const pending = row.review_status === 'Pending', deadline = pending ? Fmt.countdown(row.deadline_at, Store.now()) : '—';
    return `<tr><td data-label="Resident"><strong>${e(row.resident?.full_name || 'Not provided')}</strong><small>Resident account</small></td><td data-label="Household address"><span>${e(row.household?.address || 'Not provided')}</span><small>${e(barangay)}</small></td><td data-label="Submitted date"><time datetime="${e(row.submitted_at)}">${e(Fmt.dateTime(row.submitted_at))}</time></td><td data-label="Deadline"><span>${e(deadline)}</span><small>${pending ? e(Fmt.date(row.deadline_at)) : row.reviewed_at ? `Reviewed ${e(Fmt.date(row.reviewed_at))}` : `Deadline ${e(Fmt.date(row.deadline_at))}`}</small></td><td data-label="Document type">${e(row.document_type)}</td><td data-label="Status">${UI.badge(row.review_status)}</td><td data-label="Action"><a class="btn btn-ghost" data-verification="${row.id}" href="official-verification.html?id=${row.id}${back ? `&${e(back)}` : ''}" aria-label="View details for ${e(row.resident?.full_name || 'resident')}">View details ${Icons.svg('chevron-right', { size: 20 })}</a></td></tr>`;
  }
  function render() {
    if (!loaded) return;
    const focused = results.contains(document.activeElement) ? document.activeElement.dataset.verification : null;
    const value = verificationPage(records, { ...state, size }); state.page = value.page; const p = query(); history.replaceState(null, '', `official-verifications.html${p.size ? `?${p}` : ''}`);
    const back = p.toString();
    results.classList.toggle('official-empty-results', !value.total);
    results.innerHTML = value.total ? `<table class="official-review-table"><caption class="sr-only">Residents awaiting or completing residency verification</caption><colgroup><col style="width:16%"><col style="width:17%"><col style="width:13%"><col style="width:14%"><col style="width:15%"><col style="width:12%"><col style="width:13%"></colgroup><thead><tr>${['Resident', 'Household address', 'Submitted date', 'Deadline', 'Document type', 'Status', 'Action'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${value.rows.map(row => record(row, back)).join('')}</tbody></table>${pagination({ ...value, size, noun: 'verifications' })}` : `${UI.empty({ icon: 'clipboard-check', title: records.length ? 'No matching verifications' : 'No verifications yet', text: records.length ? 'Try another resident name, address or status.' : 'New resident submissions will appear here.' })}${records.length ? '<div class="official-empty-action"><button type="button" class="btn" data-clear-filters>Clear filters</button></div>' : ''}`;
    form.querySelector('[data-clear-search]').hidden = !form.elements.q.value;
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { state.page = Number(button.dataset.page); render(); results.tabIndex = -1; results.focus(); }));
    results.querySelector('[data-clear-filters]')?.addEventListener('click', () => { Object.assign(state, { q: '', status: '', sort: 'newest', page: 1 }); form.elements.q.value = ''; form.elements.status.value = ''; form.elements.sort.value = 'newest'; render(); form.elements.q.focus(); });
    if (focused) results.querySelector(`[data-verification="${Number(focused)}"]`)?.focus({ preventScroll: true });
  }
  function updateFilters() { state.q = form.elements.q.value.trim(); state.status = form.elements.status.value; state.sort = form.elements.sort.value; state.page = 1; render(); }
  form.addEventListener('submit', event => { event.preventDefault(); updateFilters(); });
  form.elements.q.addEventListener('input', event => { if (!event.isComposing) updateFilters(); }); form.elements.q.addEventListener('compositionend', updateFilters);
  form.querySelectorAll('select').forEach(select => select.addEventListener('change', updateFilters));
  form.querySelector('[data-clear-search]').addEventListener('click', () => { form.elements.q.value = ''; updateFilters(); form.elements.q.focus(); });
  async function load() {
    const request = ++version;
    try { await Api.verification.expireOverdue(); const [rows, barangays] = await Promise.all([Api.verification.list(), Api.barangays.list()]); if (request !== version) return; records = rows; barangay = barangays.find(b => b.id === user.barangay_id)?.name || ''; loaded = true; error.hidden = true; summary(); render(); }
    catch (err) { if (request !== version) return; error.querySelector('.grow').textContent = loaded ? `The queue could not refresh. Records may be out of date. ${err.message}` : `Unable to load verifications. ${err.message}`; error.hidden = false; if (!loaded) { results.innerHTML = UI.empty({ icon: 'clipboard-check', title: 'Queue unavailable', text: 'Use Try again to reload the verification queue.' }); stats.innerHTML = ''; } }
    finally { if (request === version) results.removeAttribute('aria-busy'); }
  }
  main.querySelector('[data-retry]').addEventListener('click', load);
  const refresh = live(['verification', 'users'], load); refresh(); const timer = setInterval(refresh, 60000);
  window.addEventListener('pagehide', event => { if (!event.persisted) { version++; clearInterval(timer); } }, { once: true });
}
