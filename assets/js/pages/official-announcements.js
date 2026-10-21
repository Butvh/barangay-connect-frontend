import { Auth, Api, Store, UI, Fmt, Icons, e, dialog, pagination, live } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { announcementAuthor, readAnnouncement } from './official-announcement-actions.js';

let user;
try { Auth.requireRole(['secretary']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open announcements', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Announcements' }), params = new URLSearchParams(location.search), size = 10;
  let page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1), rows = [], barangay = '', version = 0, loaded = false, requested = params.has('id') ? Number(params.get('id')) : null, composer;
  main.innerHTML = `<header class="official-heading"><h1>Announcements</h1></header><div class="actions"><button type="button" class="btn btn-primary official-new-announcement" data-compose>New announcement</button></div><div class="banner banner-error" role="alert" data-load-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><div class="banner banner-error" role="alert" data-link-error hidden><span class="grow">This announcement is unavailable in your barangay.</span><button type="button" class="icon-btn" aria-label="Dismiss unavailable announcement">${Icons.svg('x')}</button></div><section class="official-announcements-list" aria-label="Published announcements" aria-busy="true">${UI.skeleton(3)}</section>`;
  const results = main.querySelector('.official-announcements-list'), error = main.querySelector('[data-load-error]');
  function url(id) { const p = new URLSearchParams(); if (page > 1) p.set('page', page); if (id) p.set('id', id); history.replaceState(null, '', `official-announcements.html${p.size ? `?${p}` : ''}`); }
  function open(row) { url(row.id); return readAnnouncement(row, () => url()); }
  function render() {
    const focused = results.contains(document.activeElement) ? document.activeElement.dataset.read : null, pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(page, pages);
    results.innerHTML = rows.length ? `${rows.slice((page - 1) * size, page * size).map(row => `<article class="card official-announcement-row"><div><h2>${e(row.title)}</h2><small>${e(announcementAuthor(row))} · ${e(Fmt.date(row.created_at))}</small></div><button type="button" class="btn" data-read="${row.id}" aria-label="Read announcement: ${e(row.title)}">Read announcement</button></article>`).join('')}${pagination({ page, pages, size, total: rows.length, noun: 'announcements' })}` : `<section class="card">${UI.empty({ icon: 'megaphone', title: 'No announcements yet', text: 'Publish an update to share it with residents.' })}</section>`;
    results.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', () => open(rows.find(row => row.id === Number(button.dataset.read)))));
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); url(); render(); results.tabIndex = -1; results.focus(); }));
    if (focused) results.querySelector(`[data-read="${Number(focused)}"]`)?.focus({ preventScroll: true });
  }
  async function load() {
    const request = ++version;
    try {
      const [records, areas] = await Promise.all([Api.announcements.list(), Api.barangays.list()]); if (request !== version) return; rows = records; barangay = areas.find(b => b.id === user.barangay_id)?.name || 'Your barangay'; loaded = true; error.hidden = true; render();
      if (requested !== null) { const row = rows.find(r => r.id === requested); requested = null; if (row) open(row); else { url(); main.querySelector('[data-link-error]').hidden = false; } }
    } catch (err) { if (request !== version) return; error.querySelector('.grow').textContent = loaded ? `Announcements could not refresh. Displayed updates may be out of date. ${err.message}` : `Unable to load announcements. ${err.message}`; error.hidden = false; if (!loaded) results.innerHTML = UI.empty({ icon: 'megaphone', title: 'Announcements unavailable', text: 'Use Try again to reload published updates.' }); }
    finally { if (request === version) results.removeAttribute('aria-busy'); }
  }
  function compose() {
    if (composer?.open) return;
    let busy = false, dirty = false, closing = false;
    const beforeClose = async () => { if (busy || closing) return false; if (!dirty) return true; closing = true; try { return await UI.confirm({ title: 'Discard announcement?', text: 'This announcement has not been published.', confirmLabel: 'Discard changes', danger: true }); } finally { closing = false; } };
    const el = dialog('New announcement', `<form class="stack-sm official-announcement-form" novalidate><p>${e(barangay || 'Your barangay')}</p><div class="banner banner-error" role="alert" data-save-error hidden></div><div class="field"><label for="announcement-title">Title</label><input class="input" id="announcement-title" name="title" required maxlength="200" aria-describedby="announcement-title-error"><small class="error-text" id="announcement-title-error"></small></div><div class="field"><label for="announcement-content">Content</label><textarea class="textarea" id="announcement-content" name="content" required maxlength="5000" aria-describedby="announcement-content-help announcement-content-error"></textarea><small id="announcement-content-help">Write the information residents need to know. Up to 5,000 characters.</small><small class="error-text" id="announcement-content-error"></small></div><small>Posting as Secretary ${e(user.full_name)} · <time data-posting-date>${e(Fmt.date(Store.now()))}</time></small><div class="actions official-announcement-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Publish</button></div></form>`, { beforeClose });
    composer = el; el.classList.add('official-announcement-composer');
    const form = el.querySelector('form'), saveError = form.querySelector('[data-save-error]');
    el.addEventListener('close', () => { composer = null; }, { once: true });
    form.addEventListener('input', event => { dirty = Boolean(form.elements.title.value || form.elements.content.value); const name = event.target.name; event.target.removeAttribute('aria-invalid'); form.querySelector(`#announcement-${name}-error`).textContent = ''; saveError.hidden = true; });
    form.querySelector('[data-cancel]').addEventListener('click', async () => { if (await beforeClose()) UI.closeDialog(el); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const title = form.elements.title.value.trim(), content = form.elements.content.value.trim(); let first;
      for (const [name, value, max] of [['title', title, 200], ['content', content, 5000]]) { const field = form.elements[name], hint = form.querySelector(`#announcement-${name}-error`), message = !value ? `Enter ${name === 'title' ? 'an announcement title' : 'announcement content'}.` : value.length > max ? `Use ${max.toLocaleString('en-US')} characters or fewer.` : ''; hint.textContent = message; if (message) { field.setAttribute('aria-invalid', 'true'); first ||= field; } else field.removeAttribute('aria-invalid'); }
      if (first) { first.focus(); return; }
      busy = true; form.setAttribute('aria-busy', 'true'); el.querySelectorAll('input,textarea,button').forEach(control => control.disabled = true); const publish = form.querySelector('[type="submit"]'); publish.textContent = 'Publishing…'; saveError.hidden = true;
      try { const saved = await Api.announcements.create({ title, content }); dirty = false; UI.closeDialog(el); page = 1; url(); await load(); UI.toast('Announcement published.'); const heading = results.querySelector(`[data-read="${saved.id}"]`)?.closest('article').querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus(); } }
      catch (err) { saveError.textContent = err.message; saveError.hidden = false; saveError.tabIndex = -1; saveError.focus(); for (const [name, message] of Object.entries(err.fields || {})) { const hint = form.querySelector(`#announcement-${name}-error`); if (hint) { hint.textContent = message; form.elements[name]?.setAttribute('aria-invalid', 'true'); } } }
      finally { busy = false; form.removeAttribute('aria-busy'); el.querySelectorAll('input,textarea,button').forEach(control => control.disabled = false); publish.textContent = 'Publish'; }
    });
  }
  main.querySelector('[data-compose]').addEventListener('click', compose); main.querySelector('[data-retry]').addEventListener('click', load); main.querySelector('[data-link-error] button').addEventListener('click', () => { main.querySelector('[data-link-error]').hidden = true; main.querySelector('[data-compose]').focus(); });
  window.addEventListener('beforeunload', event => { if (composer?.open && (composer.querySelector('[aria-busy="true"]') || composer.querySelector('input').value || composer.querySelector('textarea').value)) { event.preventDefault(); event.returnValue = ''; } });
  live(['announcements'], load)(); window.addEventListener('pagehide', event => { if (!event.persisted) version++; }, { once: true });
}
