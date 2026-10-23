import { Auth, Fmt, e, link, dialog } from './resident-shared.js';
import { Shell } from '../core/shell-resident.js';
import { mountNotificationCenter } from '../core/notification-center.js';

Auth.requireRole(['resident']);
if (Auth.current()) {
  const main = Shell.resident({active:'Home'});
  main.classList.add('notifications-main', 'notification-page');
  mountNotificationCenter(main, { bell: document.querySelector('.notification-link'), onOpen: record => {
    dialog(record.title, `<div class="stack"><small>${e(Fmt.dateTime(record.created_at))}</small><p>${e(record.description)}</p>${link(record.link, 'View update', 'btn-primary')}</div>`, {sheet:true});
  } });
}
