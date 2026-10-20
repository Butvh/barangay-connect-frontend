import { Auth } from './auth.js';
import { Api } from './api.js';
import { UI } from './ui.js';
import { Icons } from './icons.js';
import { Fmt } from './format.js';
import { pageReady, roleLabel, dialog, destination } from '../pages/official-shared.js';

// TODO(contract), Issue #2: use P2's menu/layout-dashboard icons once supplied.

const nav = [['Dashboard', 'official-dashboard.html', 'house'], ['Alerts', 'official-alerts.html', 'triangle-alert'], ['Map monitoring', 'official-map.html', 'map'], ['Verifications', 'official-verifications.html', 'shield-check'], ['Announcements', 'official-announcements.html', 'megaphone'], ['Feedback', 'official-feedback.html', 'message-square'], ['Facilities', 'official-facilities.html', 'hospital']];
export const Shell = { official({ role = Auth.roleOf(Auth.current()), active = 'Dashboard' } = {}) {
  const user = Auth.current(), host = document.querySelector('#app') || document.body, e = UI.escape;
  const items = nav.filter(([name]) => role === 'secretary' || ['Dashboard', 'Alerts', 'Map monitoring', 'Facilities'].includes(name));
  const navigation = () => items.map(([name, href, icon]) => pageReady(href) ? `<a class="official-nav-item${name === active ? ' active' : ''}" href="${href}" aria-label="${name}" title="${name}"${name === active ? ' aria-current="page"' : ''}>${Icons.svg(icon)}<span>${name}</span></a>` : `<button type="button" class="official-nav-item" disabled aria-label="${name}: not available yet" title="This section is not available yet.">${Icons.svg(icon)}<span>${name}</span></button>`).join('');
  const brand = '<a class="official-brand" href="official-dashboard.html"><img src="assets/img/logo.png" width="32" height="32" alt=""><span>Barangay Connect</span></a>';
  const account = () => `<div class="official-account"><p>${e(user.full_name)}</p><small>${roleLabel(role)}</small><button type="button" class="btn btn-ghost" data-sign-out aria-label="Sign out" title="Sign out">${Icons.svg('log-out', { size: 20 })}<span>Sign out</span></button></div>`;
  host.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><aside class="official-sidebar">${brand}<p class="official-barangay">Barangay workspace</p><nav aria-label="Official navigation">${navigation()}</nav>${account()}</aside><div class="official-workspace"><header class="official-header"><button type="button" class="icon-btn official-menu-button" id="open-official-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="official-drawer"><span class="official-hamburger" aria-hidden="true">☰</span></button><span class="official-barangay official-header-name">Barangay workspace</span><div class="official-header-actions"><button type="button" class="icon-btn official-bell" id="open-notifications" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false" aria-controls="official-notifications">${Icons.svg('bell')}<span class="official-notification-dot" hidden></span></button><span class="official-role">${roleLabel(role)}</span><span class="official-avatar" aria-label="${e(user.full_name)}">${e(Fmt.initials(user.full_name))}</span></div></header><main id="main" class="official-main" tabindex="-1"></main></div><dialog class="official-drawer" id="official-drawer" aria-label="Official navigation"><div class="dialog-head">${brand}<button type="button" class="icon-btn" data-close-drawer aria-label="Close navigation">${Icons.svg('x')}</button></div><p class="official-barangay">Barangay workspace</p><nav aria-label="Mobile official navigation">${navigation()}</nav>${account()}</dialog><dialog class="official-notifications sheet" id="official-notifications" aria-labelledby="notification-title"><div class="dialog-head"><h2 id="notification-title">Notifications</h2><button type="button" class="icon-btn" data-close-notifications aria-label="Close notifications">${Icons.svg('x')}</button></div><div data-notification-list></div><div class="official-notification-footer"><button type="button" class="btn btn-ghost" data-clear-read disabled>Clear read</button></div></dialog>`;
  const drawer = host.querySelector('#official-drawer'), trigger = host.querySelector('#open-official-menu'), panel = host.querySelector('#official-notifications'), bell = host.querySelector('#open-notifications');
  trigger.addEventListener('click', () => { UI.openDialog(drawer); trigger.setAttribute('aria-expanded', 'true'); });
  drawer.querySelector('[data-close-drawer]').addEventListener('click', () => UI.closeDialog(drawer));
  drawer.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
  const media = matchMedia('(min-width:768px)'); media.addEventListener('change', () => { if (media.matches && drawer.open) UI.closeDialog(drawer); });
  host.querySelectorAll('[data-sign-out]').forEach(button => button.addEventListener('click', () => { Auth.logout(); location.assign('login.html'); }));
  let revision = 0, notifications = [];
  async function renderNotifications() {
    const version = ++revision;
    try {
      const rows = await Api.notifications.list(); if (version !== revision) return; notifications = rows;
      const unread = rows.filter(n => !n.is_read).length; bell.setAttribute('aria-label', `Notifications, ${unread} unread`); bell.querySelector('span').hidden = !unread;
      const list = panel.querySelector('[data-notification-list]'), focused = list.contains(document.activeElement) ? document.activeElement.closest('[data-notice]')?.dataset.notice : null;
      list.innerHTML = rows.length ? rows.map(n => `<button type="button" class="official-notice${n.is_read ? '' : ' unread'}" data-notice="${n.id}"><span class="official-notice-icon">${Icons.svg(n.kind === 'verification' ? 'shield-check' : n.kind === 'announcement' ? 'megaphone' : 'triangle-alert', { size: 20 })}</span><span><span class="official-notice-state">${n.is_read ? 'Read' : 'Unread'}</span><span class="official-notice-text">${e(n.text)}</span><time datetime="${e(n.created_at)}">${e(Fmt.short(n.created_at))}</time></span></button>`).join('') : UI.empty({ icon: 'bell', title: 'You’re all caught up', text: 'New updates will appear here.' });
      panel.querySelector('[data-clear-read]').disabled = !rows.some(n => n.is_read);
      list.querySelectorAll('[data-notice]').forEach(button => button.addEventListener('click', async () => {
        const record = notifications.find(n => n.id === Number(button.dataset.notice)); if (!record) return;
        button.disabled = true;
        try { await Api.notifications.markRead(record.id); UI.closeDialog(panel); const safe = /^official-(?:alert|verification|announcements|feedback)\.html(?:\?[^#]*)?$/.test(record.link || ''); dialog('Notification', `<div class="stack"><p>${e(record.text)}</p><small>${e(Fmt.dateTime(record.created_at))}</small>${safe ? destination(record.link, 'View update', 'btn-primary') : ''}</div>`); }
        catch (err) { UI.toast(err.message, 'error'); button.disabled = false; }
      }));
      if (focused && panel.open) list.querySelector(`[data-notice="${Number(focused)}"]`)?.focus();
    } catch (err) { if (version !== revision) return; const list = panel.querySelector('[data-notification-list]'); list.innerHTML = `<p role="alert">${e(err.message)}</p><button type="button" class="btn" data-retry-notices>Try again</button>`; list.querySelector('button').addEventListener('click', renderNotifications); }
  }
  bell.addEventListener('click', () => { UI.openDialog(panel); bell.setAttribute('aria-expanded', 'true'); renderNotifications(); });
  panel.querySelector('[data-close-notifications]').addEventListener('click', () => UI.closeDialog(panel)); panel.addEventListener('close', () => bell.setAttribute('aria-expanded', 'false'));
  panel.querySelector('[data-clear-read]').addEventListener('click', async event => {
    const button = event.currentTarget;
    if (!await UI.confirm({ title: 'Clear read notifications?', text: 'Read notifications will be removed. Unread updates will remain.', confirmLabel: 'Clear read' })) return;
    button.disabled = true; try { await Api.notifications.clearRead(); UI.toast('Read notifications cleared.'); if (panel.open) panel.querySelector('[data-close-notifications]').focus(); } catch (err) { UI.toast(err.message, 'error'); await renderNotifications(); }
  });
  Api.barangays.list().then(rows => { const name = rows.find(b => b.id === user.barangay_id)?.name || 'Barangay workspace'; host.querySelectorAll('.official-barangay').forEach(el => el.textContent = name); }).catch(() => {});
  renderNotifications(); const off = Api.subscribe('notifications', renderNotifications);
  window.addEventListener('pagehide', event => { if (!event.persisted) off(); }, { once: true });
  return host.querySelector('main');
} };
export default Shell;
