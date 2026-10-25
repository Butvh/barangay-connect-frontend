import { Auth } from './auth.js';
import { Api } from './api.js';
import { UI } from './ui.js';
import { Icons } from './icons.js';
import { Fmt } from './format.js';
import { pageReady, roleLabel, dialog, destination } from '../pages/official-shared.js';
import { alertSummary } from '../pages/official-alert-actions.js';
import { mountNotificationCenter } from './notification-center.js';

const nav = [['Dashboard', 'official-dashboard.html', 'layout-dashboard'], ['Alerts', 'official-alerts.html', 'triangle-alert'], ['Map monitoring', 'official-map.html', 'map'], ['Verifications', 'official-verifications.html', 'clipboard-check'], ['Announcements', 'official-announcements.html', 'megaphone'], ['Feedback', 'official-feedback.html', 'message-square'], ['Facilities', 'official-facilities.html', 'hospital']];
export const Shell = { official({ role = Auth.roleOf(Auth.current()), active = 'Dashboard' } = {}) {
  const user = Auth.current(), host = document.querySelector('#app') || document.body, e = UI.escape;
  const items = role === 'captain' ? [...nav, ['Personnel', 'captain-personnel.html', 'users'], ['Reports', 'captain-reports.html', 'activity']] : nav.filter(([name]) => role === 'secretary' || ['Dashboard', 'Alerts', 'Map monitoring', 'Facilities'].includes(name));
  const navigation = () => items.map(([name, href, icon]) => pageReady(href) ? `<a class="official-nav-item${name === active ? ' active' : ''}" href="${href}" aria-label="${name}" title="${name}"${name === active ? ' aria-current="page"' : ''}>${Icons.svg(icon)}<span>${name}</span></a>` : `<button type="button" class="official-nav-item" disabled aria-label="${name}: not available yet" title="This section is not available yet.">${Icons.svg(icon)}<span>${name}</span></button>`).join('');
  const brand = '<a class="official-brand" href="official-dashboard.html"><img src="assets/img/logo.png" width="32" height="32" alt=""><span>Barangay Connect</span></a>';
  const account = () => `<div class="official-account"><p>${e(user.full_name)}</p><small>${roleLabel(role)}</small><button type="button" class="btn btn-ghost" data-sign-out aria-label="Sign out" title="Sign out">${Icons.svg('log-out', { size: 20 })}<span>Sign out</span></button></div>`;
  host.innerHTML = `<a class="skip-link" href="#main">Skip to content</a><aside class="official-sidebar">${brand}<p class="official-barangay">Barangay workspace</p><nav aria-label="Official navigation">${navigation()}</nav>${account()}</aside><div class="official-workspace"><header class="official-header"><button type="button" class="icon-btn official-menu-button" id="open-official-menu" aria-label="Open navigation" aria-expanded="false" aria-controls="official-drawer">${Icons.svg('menu')}</button><span class="official-barangay official-header-name">Barangay workspace</span><div class="official-header-actions"><button type="button" class="icon-btn official-bell" id="open-notifications" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false" aria-controls="official-notifications">${Icons.svg('bell')}<span class="official-notification-dot" hidden></span></button><span class="official-role">${roleLabel(role)}</span><span class="official-avatar" aria-label="${e(user.full_name)}">${e(Fmt.initials(user.full_name))}</span></div></header><main id="main" class="official-main" tabindex="-1"></main></div><dialog class="official-drawer" id="official-drawer" aria-label="Official navigation"><div class="dialog-head">${brand}<button type="button" class="icon-btn" data-close-drawer aria-label="Close navigation">${Icons.svg('x')}</button></div><p class="official-barangay">Barangay workspace</p><nav aria-label="Mobile official navigation">${navigation()}</nav>${account()}</dialog><dialog class="official-notifications" id="official-notifications"></dialog>`;
  const drawer = host.querySelector('#official-drawer'), trigger = host.querySelector('#open-official-menu'), panel = host.querySelector('#official-notifications'), bell = host.querySelector('#open-notifications');
  trigger.addEventListener('click', () => { UI.openDialog(drawer); trigger.setAttribute('aria-expanded', 'true'); });
  drawer.querySelector('[data-close-drawer]').addEventListener('click', () => UI.closeDialog(drawer));
  drawer.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
  const media = matchMedia('(min-width:768px)'); media.addEventListener('change', () => { if (media.matches && drawer.open) UI.closeDialog(drawer); });
  host.querySelectorAll('[data-sign-out]').forEach(button => button.addEventListener('click', () => { Auth.logout(); location.assign('login.html'); }));
  const center = mountNotificationCenter(panel, { bell, onClose: () => UI.closeDialog(panel), onOpen: async record => {
    UI.closeDialog(panel); bell.focus();
    const alertLink = /^official-alert\.html\?id=(\d+)$/.exec(record.link);
    if (alertLink) { alertSummary(await Api.alerts.get(Number(alertLink[1]))); return; }
    dialog(record.title, `<div class="stack"><p>${e(record.description)}</p><small>${e(Fmt.dateTime(record.created_at))}</small>${destination(record.link, 'View update', 'btn-primary')}</div>`);
  } });
  function positionNotifications() {
    const top = Math.min(bell.getBoundingClientRect().bottom + 12, innerHeight - 180);
    panel.style.setProperty('--notification-top', `${Math.max(16, top)}px`);
  }
  bell.addEventListener('click', () => { positionNotifications(); UI.openDialog(panel); bell.setAttribute('aria-expanded', 'true'); center.refresh(); });
  panel.addEventListener('close', () => bell.setAttribute('aria-expanded', 'false'));
  window.addEventListener('resize', positionNotifications);
  Api.barangays.list().then(rows => { const name = rows.find(b => b.id === user.barangay_id)?.name || 'Barangay workspace'; host.querySelectorAll('.official-barangay').forEach(el => el.textContent = name); }).catch(() => {});
  return host.querySelector('main');
} };
export default Shell;
