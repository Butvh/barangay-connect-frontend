import { Auth, Fmt, e, link, dialog } from './resident-shared.js';
import { Shell } from '../core/shell-resident.js';
import { mountNotificationCenter } from '../core/notification-center.js';
import { residentNotificationsView } from './resident-notifications-view.js';

Auth.requireRole(['resident']);
if (Auth.current()) {
  const main = Shell.resident({active:'Home'});
  main.classList.add('notifications-main', 'resident-notifications-page');
  const styles=document.createElement('link');styles.rel='stylesheet';styles.href='assets/css/resident-notifications.css';document.head.append(styles);
  mountNotificationCenter(main, { presentation:residentNotificationsView, bell: document.querySelector('.notification-link'), onOpen: record => {
    dialog(record.title, `<div class="stack"><small>${e(Fmt.dateTime(record.created_at))}</small><p>${e(record.description)}</p>${link(record.link, 'View update', 'btn-primary')}</div>`, {sheet:true});
  } });
}
