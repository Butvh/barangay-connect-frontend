import { UI } from '../core/ui.js';
import { Fmt } from '../core/format.js';
import { Icons } from '../core/icons.js';

const e = UI.escape;
const asset = (name, size = 24) => `<img src="assets/img/source/resident-notification-${name}.svg" width="${size}" height="${size}" alt="">`;

export function residentNotificationGroups(rows) {
  const sos = row => row.kind === 'alert_new' || row.kind === 'alert_status';
  return [
    {id:'sos', title:'SOS updates', rows:rows.filter(sos)},
    {id:'account', title:'Barangay and account updates', rows:rows.filter(row => !sos(row))},
  ];
}

function glyph(row) {
  const names = {waves:'waves', 'shield-check':'shield', 'cloud-rain':'cloud', bell:'bell', megaphone:'megaphone'};
  const name = names[row.icon];
  if (!name) return `<span class="resident-notice-glyph-desktop">${Icons.svg(row.icon, {size:32})}</span><span class="resident-notice-glyph-mobile">${Icons.svg(row.icon, {size:24})}</span>`;
  const mobile = ['waves','shield','cloud'].includes(name) ? `notification-${name}` : `resident-notification-${name}-24`;
  return `<picture${['bell','megaphone'].includes(name)?' class="resident-notice-glyph-scaled"':''}><source media="(max-width: 1023px)" srcset="assets/img/source/${mobile}.svg"><img src="assets/img/source/resident-notification-${name}-32.svg" alt=""></picture>`;
}

function card(row) {
  const id = Number(row.id);
  const read = row.is_read, closed = row.kind === 'alert_status' && (row.event_status === 'Closed' || /^(?:A-\d+ · Closed|Closed · A-\d+)$/.test(row.title));
  const state = read ? 'Read' : 'Unread';
  const event = /^(Acknowledged|Responding|Rescue in progress|Resolved|Closed) · (A-\d+)$/.exec(row.title || '');
  const title = event ? `${event[2]} · ${event[1]}` : row.title || row.text || 'Barangay update';
  return `<article class="resident-notice-card ${read?'is-read':'is-unread'}${closed?' is-closed':''}">
    <button type="button" class="resident-notice-open" data-open="${id}" aria-label="Open ${e(title)}">
      <span class="resident-notice-tile">${glyph(row)}</span>
      <span class="resident-notice-content">
        <span class="resident-notice-meta"><span class="resident-notice-state">${asset(read?'dot-read':'dot-unread',16)}${state}</span><time datetime="${e(row.created_at)}">${e(Fmt.short(row.created_at))}</time></span>
        <strong>${e(title)}</strong><span class="resident-notice-description">${e(row.description)}</span>
      </span>
    </button>
    ${read&&!closed?`<button type="button" class="icon-btn resident-notice-dismiss" data-dismiss="${id}" aria-label="Dismiss ${e(title)}">${asset('dismiss')}</button>`:''}
    <button type="button" class="icon-btn resident-notice-menu" data-menu="${id}" aria-label="Actions for ${e(title)}" aria-haspopup="menu" aria-expanded="false"><img src="assets/img/source/notification-more.svg" width="24" height="24" alt=""></button>
  </article>`;
}

export const residentNotificationsView = {
  layout({id}) {
    return `<header class="resident-notifications-header"><div class="resident-notifications-intro"><h1 id="${id}-heading">Notifications</h1><p>Updates about your SOS, verification and barangay announcements.</p></div>
      <div class="notification-controls resident-notifications-controls"><div class="notification-tabs" role="tablist" aria-label="Notification filter">${['all','unread','read'].map(t=>`<button type="button" role="tab" id="${id}-${t}" data-filter="${t}" aria-controls="${id}-list" aria-selected="${t==='all'}" tabindex="${t==='all'?0:-1}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div><span class="resident-notifications-control-divider" aria-hidden="true"></span><button type="button" class="btn notification-clear" data-clear-read disabled>${asset('trash')}<span>Clear read</span></button></div>
      </header><div class="notification-list resident-notifications-groups" id="${id}-list" role="tabpanel" aria-labelledby="${id}-all" tabindex="0"><p role="status">Loading notifications…</p></div><p class="sr-only" role="status" data-notice-status></p>`;
  },
  render(rows) {
    return residentNotificationGroups(rows).map(group=>`<section class="resident-notification-group" aria-label="${group.title}"><h2>${group.title}</h2>${group.rows.length?group.rows.map(card).join(''):UI.empty({icon:group.id==='sos'?'waves':'bell',title:'You’re all caught up',text:'New updates will appear here.'})}</section>`).join('');
  },
};
