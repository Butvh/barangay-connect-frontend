import { Auth, Api, Store, UI, Fmt, e, dialog } from './official-shared.js';
import { announcementStatus, announcementPublishedAt } from '../core/announcements.js';

export const announcementAuthor = row => row.author ? `${row.author.is_captain ? 'Captain ' : row.author.is_secretary ? 'Secretary ' : ''}${row.author.full_name}` : 'Barangay official';
export const announcementBadge = row => {
  const status = announcementStatus(row, Store.now());
  return `<span class="announcement-status announcement-status-${status.toLowerCase()}"><span aria-hidden="true"></span>${e(status)}</span>`;
};
export function announcementTiming(row) {
  if (row.retracted_at) return `Retracted ${Fmt.dateTime(row.retracted_at)}`;
  if (row.archived_at && !row.expires_at) return `Archived ${Fmt.dateTime(row.archived_at)}`;
  if (row.expires_at) return `${Date.parse(row.expires_at) <= Date.parse(Store.now()) ? 'Expired' : 'Expires'} ${Fmt.dateTime(row.expires_at)}`;
  return 'No expiration';
}
export async function readAnnouncement(record, onClose = () => {}) {
  let row;
  try { row = await Api.announcements.get(record.id); }
  catch (error) { UI.toast(error.message, 'error'); onClose(); return null; }
  const history = row.history?.length ? `<details class="announcement-history"><summary>Publication history</summary><ol>${row.history.map(h => `<li><strong>${e(h.action)}</strong><small>${e(h.by_name || (h.by == null ? 'Automatic expiration' : 'Barangay official'))} · ${e(Fmt.dateTime(h.at))}</small>${h.reason ? `<p>${e(h.reason)}</p>` : ''}<details><summary>Content at this point</summary><h4>${e(h.title)}</h4><p class="official-long-copy">${e(h.content)}</p></details></li>`).join('')}</ol></details>` : '';
  const el = dialog('Announcement', `<article class="stack official-announcement-detail"><h3>${e(row.title)}</h3><small>${e(announcementAuthor(row))} · ${e(Fmt.dateTime(announcementPublishedAt(row)))}</small><div>${announcementBadge(row)}</div><p>${e(announcementTiming(row))}</p><p class="official-long-copy">${e(row.content)}</p>${row.retraction_reason ? `<section class="announcement-retraction-note"><h4>Reason for retraction</h4><p>${e(row.retraction_reason)}</p></section>` : ''}${history}<button type="button" class="btn" data-done>Done</button></article>`);
  el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
  el.addEventListener('close', onClose, { once: true }); return el;
}

const localExpiry = value => value ? new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16) : '';
export function composeAnnouncement({ row = null, barangay, onSaved }) {
  let busy = false, dirty = false, closing = false;
  const original = { title: row?.title || '', content: row?.content || '', expires_at: localExpiry(row?.expires_at) };
  const beforeClose = async () => {
    if (busy || closing) return false; if (!dirty) return true; closing = true;
    try { return await UI.confirm({ title: 'Discard announcement changes?', text: 'Your changes have not been saved.', confirmLabel: 'Discard changes', danger: true }); }
    finally { closing = false; }
  };
  const el = dialog(row ? 'Edit announcement' : 'New announcement', `<form class="stack-sm official-announcement-form" novalidate><p>${e(barangay || 'Your barangay')}</p><div class="banner banner-error" role="alert" data-save-error hidden></div><div class="field"><label for="announcement-title">Title</label><input class="input" id="announcement-title" name="title" required maxlength="200" value="${e(original.title)}" aria-describedby="announcement-title-error"><small class="error-text" id="announcement-title-error"></small></div><div class="field"><label for="announcement-content">Content</label><textarea class="textarea" id="announcement-content" name="content" required maxlength="5000" aria-describedby="announcement-content-help announcement-content-error">${e(original.content)}</textarea><small id="announcement-content-help">Write the information residents need to know. Up to 5,000 characters.</small><small class="error-text" id="announcement-content-error"></small></div><div class="field"><label for="announcement-expires_at">Expiration date and time (optional)</label><input class="input" type="datetime-local" id="announcement-expires_at" name="expires_at" value="${e(original.expires_at)}" aria-describedby="announcement-expiry-help announcement-expires_at-error"><small id="announcement-expiry-help">Manila time (UTC+8). Leave empty for no expiration.</small><small class="error-text" id="announcement-expires_at-error"></small></div><small>${row ? 'Originally published' : 'Posting'} as ${e(row ? announcementAuthor(row) : `${Auth.roleOf(Auth.current()) === 'captain' ? 'Captain' : 'Secretary'} ${Auth.current().full_name}`)} · ${e(Fmt.dateTime(row ? announcementPublishedAt(row) : Store.now()))}</small><div class="actions official-announcement-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${row ? 'Save changes' : 'Publish'}</button></div></form>`, { beforeClose });
  el.classList.add('official-announcement-composer');
  const form = el.querySelector('form'), saveError = form.querySelector('[data-save-error]'), save = form.querySelector('[type="submit"]');
  form.addEventListener('input', event => {
    dirty = Object.keys(original).some(name => form.elements[name].value !== original[name]);
    el.dataset.dirty = String(dirty);
    event.target.removeAttribute('aria-invalid'); const hint = form.querySelector(`#announcement-${event.target.name}-error`); if (hint) hint.textContent = ''; saveError.hidden = true;
  });
  form.querySelector('[data-cancel]').addEventListener('click', async () => { if (await beforeClose()) UI.closeDialog(el); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const title = form.elements.title.value.trim(), content = form.elements.content.value.trim(), local = form.elements.expires_at.value;
    const expires_at = row && local === original.expires_at ? row.expires_at : local ? `${local}:00+08:00` : null;
    let first;
    const errors = { title: !title ? 'Enter an announcement title.' : title.length > 200 ? 'Use 200 characters or fewer.' : '', content: !content ? 'Enter announcement content.' : content.length > 5000 ? 'Use 5,000 characters or fewer.' : '', expires_at: local && (!Number.isFinite(Date.parse(expires_at)) || Date.parse(expires_at) <= Date.parse(Store.now())) ? 'Choose a future date and time, or leave this empty.' : '' };
    for (const [name, message] of Object.entries(errors)) { const field = form.elements[name]; form.querySelector(`#announcement-${name}-error`).textContent = message; if (message) { field.setAttribute('aria-invalid', 'true'); first ||= field; } else field.removeAttribute('aria-invalid'); }
    if (first) { first.focus(); return; }
    busy = true; form.setAttribute('aria-busy', 'true'); el.querySelectorAll('input,textarea,button').forEach(c => c.disabled = true); save.textContent = row ? 'Saving…' : 'Publishing…'; saveError.hidden = true;
    try {
      const payload = { title, content, expires_at }, saved = row ? await Api.announcements.update(row.id, { ...payload, expected_revision: row.revision }) : await Api.announcements.create(payload);
      dirty = false; UI.closeDialog(el); await onSaved(saved, row ? 'edited' : 'published'); UI.toast(row ? 'Announcement updated.' : 'Announcement published.');
    } catch (err) {
      saveError.textContent = err.message; saveError.hidden = false; saveError.tabIndex = -1; saveError.focus();
      for (const [name, message] of Object.entries(err.fields || {})) { const hint = form.querySelector(`#announcement-${name}-error`); if (hint) { hint.textContent = message; form.elements[name]?.setAttribute('aria-invalid', 'true'); } }
    } finally { busy = false; form.removeAttribute('aria-busy'); el.querySelectorAll('input,textarea,button').forEach(c => c.disabled = false); save.textContent = row ? 'Save changes' : 'Publish'; }
  });
  return el;
}

export function retractAnnouncement(row, onSaved) {
  let busy = false;
  const el = dialog('Retract announcement', `<form class="stack announcement-retract-form" novalidate><div class="announcement-retract-preview"><h3>${e(row.title)}</h3><p>${e(row.content.slice(0, 180))}${row.content.length > 180 ? '…' : ''}</p></div><div class="field"><label for="retraction-reason">Reason for retraction</label><textarea class="textarea" id="retraction-reason" name="reason" required maxlength="500" placeholder="Enter the reason for retraction..." aria-describedby="retraction-error retraction-count retraction-help"></textarea><div class="spread"><small class="error-text" id="retraction-error"></small><small id="retraction-count">0 / 500</small></div></div><p id="retraction-help">The reason will be recorded in the announcement history. Residents will no longer see this announcement.</p><div class="banner banner-error" role="alert" data-error hidden></div><div class="actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-danger">Retract announcement</button></div></form>`, { sheet: false, beforeClose: () => !busy });
  el.classList.add('announcement-retract-dialog');
  const form = el.querySelector('form'), field = form.elements.reason, hint = form.querySelector('#retraction-error'), error = form.querySelector('[data-error]');
  field.addEventListener('input', () => { form.querySelector('#retraction-count').textContent = `${field.value.length} / 500`; hint.textContent = ''; field.removeAttribute('aria-invalid'); });
  form.querySelector('[data-cancel]').addEventListener('click', () => { if (!busy) UI.closeDialog(el); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; const reason = field.value.trim();
    if (!reason || reason.length > 500) { hint.textContent = !reason ? 'Enter a reason for retraction.' : 'Use 500 characters or fewer.'; field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
    busy = true; form.setAttribute('aria-busy', 'true'); el.querySelectorAll('button,textarea').forEach(c => c.disabled = true); error.hidden = true;
    try { const saved = await Api.announcements.retract(row.id, { reason, expected_revision: row.revision }); UI.closeDialog(el); await onSaved(saved, 'retracted'); UI.toast('Announcement retracted.'); }
    catch (err) { error.textContent = err.message; error.hidden = false; error.tabIndex = -1; error.focus(); }
    finally { busy = false; form.removeAttribute('aria-busy'); el.querySelectorAll('button,textarea').forEach(c => c.disabled = false); }
  });
  return el;
}
