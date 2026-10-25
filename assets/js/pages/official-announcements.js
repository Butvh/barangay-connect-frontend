import { Auth, Api, Store, UI, Fmt, Icons, e, pagination, live } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { announcementAuthor, announcementBadge, announcementTiming, readAnnouncement, composeAnnouncement, retractAnnouncement } from './official-announcement-actions.js';
import { announcementPage } from './official-announcements-model.js';
import { announcementStatus, announcementPublishedAt, nextAnnouncementExpiry } from '../core/announcements.js';

let user;
try { Auth.requireRole(['secretary', 'captain']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open announcements', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Announcements' }), params = new URLSearchParams(location.search), size = 10;
  main.classList.add('announcements-main');
  let page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1), q = params.get('q') || '', status = ['Active', 'Archived', 'Retracted'].includes(params.get('status')) ? params.get('status') : '';
  let rows = [], barangay = '', version = 0, loaded = false, requested = params.has('id') ? Number(params.get('id')) : null, composer, expiryTimer, menu, menuTrigger;
  main.innerHTML = `<header class="official-heading announcements-heading"><div><h1>Announcements</h1><p>Manage and share important announcements with the community.</p></div><button type="button" class="icon-btn announcement-add" data-compose aria-label="New announcement" title="New announcement">${Icons.svg('plus')}</button></header><div class="announcement-toolbar"><div class="announcement-filters" role="group" aria-label="Announcement status">${['All', 'Active', 'Archived', 'Retracted'].map(label => `<button type="button" data-status="${label === 'All' ? '' : label}" aria-pressed="false">${label}</button>`).join('')}</div><form class="announcement-search" role="search"><label class="sr-only" for="announcement-search">Search announcements</label>${Icons.svg('search', { size: 20 })}<input id="announcement-search" name="q" type="search" placeholder="Search announcements..." value="${e(q)}" maxlength="200"></form></div><div class="banner banner-error" role="alert" data-load-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><div class="banner banner-error" role="alert" data-link-error hidden><span class="grow">This announcement is unavailable in your barangay.</span><button type="button" class="icon-btn" aria-label="Dismiss unavailable announcement">${Icons.svg('x')}</button></div><section class="official-announcements-list" aria-label="Announcements" aria-busy="true">${UI.skeleton(3)}</section>`;
  const results = main.querySelector('.official-announcements-list'), error = main.querySelector('[data-load-error]'), search = main.querySelector('[name="q"]');
  function url(id) { const p = new URLSearchParams(); if (status) p.set('status', status); if (q) p.set('q', q); if (page > 1) p.set('page', page); if (id) p.set('id', id); history.replaceState(null, '', `official-announcements.html${p.size ? `?${p}` : ''}`); }
  function open(row) { url(row.id); return readAnnouncement(row, () => url()); }
  function closeMenu(restore = false) { menu?.remove(); menu = null; menuTrigger?.setAttribute('aria-expanded', 'false'); if (restore && menuTrigger?.isConnected) menuTrigger.focus(); menuTrigger = null; }
  async function saved(row, action) {
    if (action === 'published') { page = 1; q = ''; status = 'Active'; search.value = ''; }
    url(); await load();
    const target = results.querySelector(`[data-record="${row.id}"] h2`) || results; target.tabIndex = -1; target.focus({ preventScroll: action !== 'published' });
  }
  function compose(row = null) { if (composer?.open) return; composer = composeAnnouncement({ row, barangay, onSaved: saved }); composer.addEventListener('close', () => { composer = null; }, { once: true }); }
  async function action(row, name) {
    try {
      if (name === 'view') { await open(row); return; }
      const current = await Api.announcements.get(row.id), state = announcementStatus(current, Store.now());
      if (name === 'edit') { if (state !== 'Active') throw new Error('Only active announcements can be edited.'); compose(current); }
      if (name === 'archive') {
        if (state !== 'Active') throw new Error('Only active announcements can be archived.');
        if (await UI.confirm({ title: 'Archive announcement?', text: `Residents will no longer see “${current.title}”. The record and publication history will be preserved.`, confirmLabel: 'Archive' })) { const archived = await Api.announcements.archive(current.id, { expected_revision: current.revision }); await saved(archived, 'archived'); UI.toast('Announcement archived.'); }
      }
      if (name === 'retract') { if (!['Active', 'Archived'].includes(state)) throw new Error('This announcement cannot be retracted.'); retractAnnouncement(current, saved); }
    } catch (err) { UI.toast(err.message, 'error'); await load(); }
  }
  function openMenu(button, row) {
    const same = menuTrigger === button; closeMenu(); if (same) return;
    const state = announcementStatus(row, Store.now()), actions = [['view', 'eye', 'View'], ...(state === 'Active' ? [['edit', 'pencil', 'Edit'], ['archive', 'archive', 'Archive']] : []), ...(['Active', 'Archived'].includes(state) ? [['retract', 'ban', 'Retract']] : [])];
    menuTrigger = button; button.setAttribute('aria-expanded', 'true');
    menu = document.createElement('div'); menu.className = 'announcement-menu'; menu.id = 'announcement-action-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `Actions for ${row.title}`);
    menu.innerHTML = actions.map(([key, icon, label]) => `<button type="button" role="menuitem" data-action="${key}"${key === 'retract' ? ' class="is-danger"' : ''}>${Icons.svg(icon, { size: 20 })}<span>${label}</span></button>`).join('');
    document.body.append(menu); const r = button.getBoundingClientRect(), width = Math.min(200, innerWidth - 16); menu.style.width = `${width}px`; menu.style.left = `${Math.max(8, Math.min(r.right - width, innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, r.bottom + menu.offsetHeight + 4 <= innerHeight - 8 ? r.bottom + 4 : r.top - menu.offsetHeight - 4)}px`;
    menu.querySelectorAll('button').forEach(item => item.addEventListener('click', () => { const name = item.dataset.action; closeMenu(true); action(row, name); }));
    menu.addEventListener('keydown', event => { const items = [...menu.querySelectorAll('button')], index = items.indexOf(document.activeElement); if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); } if (event.key === 'Tab') closeMenu(); });
    menu.querySelector('button').focus();
  }
  function render() {
    const focused = results.contains(document.activeElement) ? document.activeElement.closest('[data-record]')?.dataset.record : null; closeMenu();
    const value = announcementPage(rows, { q, status, page, size, at: Store.now() }); page = value.page;
    main.querySelectorAll('[data-status]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.status === status)));
    results.innerHTML = value.total ? value.rows.map(row => `<article class="card announcement-row" data-record="${row.id}"><div class="announcement-copy"><h2>${e(row.title)}</h2><p class="announcement-preview">${e(row.content)}</p><div class="announcement-byline"><span class="announcement-author-avatar" aria-hidden="true">${e(Fmt.initials(row.author?.full_name))}</span><span>${e(announcementAuthor(row))}</span><span aria-hidden="true">·</span><time datetime="${e(announcementPublishedAt(row))}">${e(Fmt.dateTime(announcementPublishedAt(row)))}</time></div></div><div class="announcement-state"><div>${announcementBadge(row)}</div><p>${Icons.svg('clock', { size: 16 })}<span>${e(announcementTiming(row))}</span></p></div><button type="button" class="icon-btn announcement-menu-trigger" data-menu="${row.id}" aria-label="Actions for ${e(row.title)}" aria-haspopup="menu" aria-expanded="false" aria-controls="announcement-action-menu">${Icons.svg('ellipsis-vertical', { size: 20 })}</button></article>`).join('') + pagination({ page, pages: value.pages, size, total: value.total, noun: 'announcements' }) : `<section class="card">${UI.empty({ icon: 'megaphone', title: q || status ? 'No matching announcements' : 'No announcements yet', text: q || status ? 'Try another search or status filter.' : 'Publish an update to share it with residents.' })}</section>`;
    results.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', () => openMenu(button, rows.find(row => row.id === Number(button.dataset.menu)))));
    results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); url(); render(); results.tabIndex = -1; results.focus(); }));
    if (focused) results.querySelector(`[data-menu="${Number(focused)}"]`)?.focus({ preventScroll: true });
    url();
  }
  async function load() {
    const request = ++version;
    try {
      await Api.announcements.expireOverdue();
      const [records, areas] = await Promise.all([Api.announcements.list(), Api.barangays.list()]); if (request !== version) return;
      rows = records; barangay = areas.find(b => b.id === user.barangay_id)?.name || 'Your barangay'; loaded = true; error.hidden = true; render();
      clearTimeout(expiryTimer); const next = nextAnnouncementExpiry(rows, Store.now()); if (next) expiryTimer = setTimeout(() => update(), Math.min(2147483647, Math.max(0, next - Date.parse(Store.now()))));
      if (requested !== null) { const row = Number.isSafeInteger(requested) && requested > 0 ? rows.find(r => r.id === requested) : null; requested = null; if (row) open(row); else { url(); main.querySelector('[data-link-error]').hidden = false; } }
    } catch (err) { if (request !== version) return; error.querySelector('.grow').textContent = loaded ? `Announcements could not refresh. Displayed updates may be out of date. ${err.message}` : `Unable to load announcements. ${err.message}`; error.hidden = false; if (!loaded) results.innerHTML = UI.empty({ icon: 'megaphone', title: 'Announcements unavailable', text: 'Use Try again to reload published updates.' }); }
    finally { if (request === version) results.removeAttribute('aria-busy'); }
  }
  main.querySelector('[data-compose]').addEventListener('click', () => compose()); main.querySelector('[data-retry]').addEventListener('click', load);
  main.querySelector('[data-link-error] button').addEventListener('click', () => { main.querySelector('[data-link-error]').hidden = true; main.querySelector('[data-compose]').focus(); });
  main.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => { status = button.dataset.status; page = 1; render(); }));
  main.querySelector('.announcement-search').addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', () => { q = search.value; page = 1; render(); });
  const outside = event => { if (menu && !menu.contains(event.target) && !menuTrigger?.contains(event.target)) closeMenu(); }, key = event => { if (menu && event.key === 'Escape') { event.preventDefault(); closeMenu(true); } }, scroll = () => closeMenu(), visible = () => { if (document.visibilityState === 'visible') update(); };
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key); window.addEventListener('resize', scroll); window.addEventListener('scroll', scroll, true); document.addEventListener('visibilitychange', visible);
  window.addEventListener('beforeunload', event => { if (composer?.open && (composer.dataset.dirty === 'true' || composer.querySelector('[aria-busy="true"]'))) { event.preventDefault(); event.returnValue = ''; } });
  const update = live(['announcements'], load); update();
  window.addEventListener('pagehide', event => { if (event.persisted) return; version++; clearTimeout(expiryTimer); closeMenu(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', scroll); window.removeEventListener('scroll', scroll, true); document.removeEventListener('visibilitychange', visible); });
}
