import { Auth, Api, Store, UI, Icons, Fmt, e, facts, live } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { VERIFICATION_STATUSES, reviewable } from './official-verification-model.js';

let user;
try { Auth.requireRole(['secretary']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open verification', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Verifications' }), params = new URLSearchParams(location.search), id = Number(params.get('id'));
  const back = new URLSearchParams(); if (params.get('q')) back.set('q', params.get('q').slice(0, 200)); if (VERIFICATION_STATUSES.includes(params.get('status'))) back.set('status', params.get('status')); if (params.get('sort') === 'oldest') back.set('sort', 'oldest'); if (Number(params.get('page')) > 1) back.set('page', Math.trunc(Number(params.get('page'))));
  const queue = () => `official-verifications.html${back.size ? `?${back}` : ''}`;
  let current, busy = false, confirming = false, dirty = false, unavailable = true, version = 0, leaving = false, original = '';
  main.innerHTML = `<header class="official-heading"><h1>Verification detail</h1><p>Review resident identity and household legitimacy documents.</p></header><div class="banner banner-error" role="alert" data-page-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><div class="official-verification-detail"><section class="card official-section"><div data-resident-summary aria-busy="true"><p role="status">Loading resident information…</p>${UI.skeleton(2)}</div><form class="official-review-decision" novalidate><h3>Review decision</h3><p data-readonly hidden></p><div class="field"><label for="rejection-reason">Reason for rejection</label><textarea class="textarea" id="rejection-reason" name="reason" maxlength="1000" aria-describedby="reason-help reason-error" disabled></textarea><small id="reason-help">Required when rejecting. Explain what the resident needs to correct.</small><small class="error-text" role="alert" id="reason-error"></small></div><div class="banner banner-error" role="alert" data-save-error hidden></div><div class="actions official-review-actions"><button type="button" class="btn btn-primary" data-approve disabled>Approve</button><button type="submit" class="btn btn-danger" data-reject disabled>Reject</button></div></form></section><section class="card official-section" data-document-preview aria-busy="true"><h2>Proof of residence</h2>${UI.skeleton(3)}</section></div><div class="actions"><a class="btn" href="${e(queue())}" data-back>Back to verification queue</a></div>`;
  const summary = main.querySelector('[data-resident-summary]'), preview = main.querySelector('[data-document-preview]'), form = main.querySelector('form'), reason = form.elements.reason, pageError = main.querySelector('[data-page-error]'), saveError = form.querySelector('[data-save-error]');
  function controls() {
    const allowed = !unavailable && reviewable(current, Store.now());
    form.querySelectorAll('button').forEach(button => button.disabled = busy || !allowed); reason.disabled = busy || !allowed;
    form.querySelector('[data-readonly]').hidden = allowed; form.querySelector('[data-readonly]').textContent = unavailable ? 'Review actions are unavailable until the latest record is loaded.' : `This verification is ${current?.review_status || 'unavailable'}. It cannot be reviewed again.`;
    form.querySelector('[data-approve]').textContent = busy && form.dataset.decision === 'Approved' ? 'Approving…' : 'Approve'; form.querySelector('[data-reject]').textContent = busy && form.dataset.decision === 'Rejected' ? 'Rejecting…' : 'Reject';
  }
  function render(row, barangay) {
    current = row; unavailable = false;
    document.title = `${row.resident?.full_name || 'Resident'} · ${row.review_status} — Verification`;
    summary.innerHTML = `<small>Resident information</small><h2>${e(row.resident?.full_name || 'Not provided')}</h2>${UI.badge(row.review_status)}<p class="row">${Icons.svg('map-pin', { size: 20 })}<span>${e(row.household?.address || 'Household address not provided')}<br>${e(barangay)}</span></p><hr class="divider">${facts([['Submitted', Fmt.dateTime(row.submitted_at)], ['Deadline', `${Fmt.date(row.deadline_at)}${row.review_status === 'Pending' ? ` · ${Fmt.countdown(row.deadline_at, Store.now())}` : ''}`], ['Document type', row.document_type], ...(row.reviewed_at ? [['Reviewed', Fmt.dateTime(row.reviewed_at)]] : [])])}${row.review_status === 'Rejected' ? `<div class="banner banner-error"><div><strong>Reason for rejection</strong><p class="official-long-copy">${e(row.rejection_reason)}</p></div></div>` : ''}`;
    const files = String(row.file_name || '').split('; ').filter(Boolean);
    preview.innerHTML = `<header class="spread"><div class="official-section"><h2>${e(row.document_type)}</h2><small>Submitted document preview</small></div><span class="official-document-label">Demo preview</span></header><div class="official-document-preview"><p>Document preview<br>${e(row.resident?.full_name)} · ${e(row.document_type)}</p>${files.map(file => `<p>${Icons.svg('file-text', { size: 20 })} ${e(file)}</p>`).join('')}</div><hr class="divider"><p class="row caption">${Icons.svg('info', { size: 20 })}<span>Fictional document placeholder. Only file names are stored in this demo.</span></p>`;
    summary.removeAttribute('aria-busy'); preview.removeAttribute('aria-busy'); controls();
  }
  reason.addEventListener('input', () => { dirty = reason.value !== original; reason.removeAttribute('aria-invalid'); form.querySelector('#reason-error').textContent = ''; saveError.hidden = true; });
  async function review(decision) {
    if (busy || confirming || unavailable || !reviewable(current, Store.now())) return;
    const note = reason.value.trim();
    if (decision === 'Rejected' && !note) { form.querySelector('#reason-error').textContent = 'Enter a reason for rejection so the resident knows what to correct.'; reason.setAttribute('aria-invalid', 'true'); reason.focus(); return; }
    if (decision === 'Rejected') {
      confirming = true;
      try { if (!await UI.confirm({ title: 'Reject verification?', text: `Reject ${current.resident?.full_name || 'this resident'}’s verification? Reason: ${note}`, confirmLabel: 'Reject', danger: true })) return; }
      finally { confirming = false; }
    }
    busy = true; form.dataset.decision = decision; form.setAttribute('aria-busy', 'true'); saveError.hidden = true; controls();
    try { await Api.verification.review(id, { decision, reason: decision === 'Rejected' ? note : '' }); dirty = false; leaving = true; const next = new URLSearchParams(back); next.set('notice', decision); location.assign(`official-verifications.html?${next}`); }
    catch (err) { saveError.textContent = err.message; saveError.hidden = false; saveError.tabIndex = -1; saveError.focus(); if (err.fields?.reason) { form.querySelector('#reason-error').textContent = err.fields.reason; reason.setAttribute('aria-invalid', 'true'); } await load(); }
    finally { busy = false; form.removeAttribute('aria-busy'); controls(); }
  }
  form.querySelector('[data-approve]').addEventListener('click', () => review('Approved'));
  form.addEventListener('submit', event => { event.preventDefault(); review('Rejected'); });
  async function load() {
    const request = ++version;
    try { await Api.verification.expireOverdue(); const [row, areas] = await Promise.all([Api.verification.get(id), Api.barangays.list()]); if (request !== version) return; pageError.hidden = true; render(row, areas.find(b => b.id === user.barangay_id)?.name || ''); }
    catch (err) { if (request !== version) return; unavailable = true; pageError.querySelector('.grow').textContent = err.message; pageError.hidden = false; if (!current) { summary.innerHTML = UI.empty({ icon: 'clipboard-check', title: 'Verification unavailable', text: 'This record could not be loaded. Return to the queue or try again.' }); preview.innerHTML = '<h2>Document preview</h2><p>No document is available.</p>'; summary.removeAttribute('aria-busy'); preview.removeAttribute('aria-busy'); } controls(); }
  }
  main.querySelector('[data-retry]').addEventListener('click', load);
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]'); if (!link || leaving || (!dirty && !busy) || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.getAttribute('href').startsWith('#')) return;
    event.preventDefault(); event.stopPropagation(); if (busy || confirming) return;
    confirming = true;
    try { if (await UI.confirm({ title: 'Discard review notes?', text: 'Your rejection reason has not been saved.', confirmLabel: 'Discard changes', danger: true })) { leaving = true; dirty = false; location.assign(link.href); } }
    finally { confirming = false; }
  }, true);
  document.querySelectorAll('[data-sign-out]').forEach(button => button.addEventListener('click', async event => {
    if (leaving || (!dirty && !busy)) return; event.preventDefault(); event.stopImmediatePropagation(); if (busy || confirming) return; confirming = true;
    try { if (await UI.confirm({ title: 'Discard review notes?', text: 'Your rejection reason has not been saved.', confirmLabel: 'Discard changes', danger: true })) { dirty = false; leaving = true; Auth.logout(); location.assign('login.html'); } }
    finally { confirming = false; }
  }, true));
  window.addEventListener('beforeunload', event => { if (!leaving && (dirty || busy)) { event.preventDefault(); event.returnValue = ''; } });
  const refresh = live(['verification', 'users'], load); refresh(); const timer = setInterval(refresh, 60000);
  window.addEventListener('pagehide', event => { if (!event.persisted) { version++; clearInterval(timer); } }, { once: true });
}
