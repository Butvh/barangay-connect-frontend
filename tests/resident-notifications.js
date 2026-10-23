import { residentNotificationGroups } from '../assets/js/pages/resident-notifications-view.js';

export function registerResidentNotificationTests({test,equal,ok,fixture}) {
  test('Resident notifications separate interleaved SOS events from account and community updates',()=>{
    const rows=[{id:9,kind:'alert_status'},{id:8,kind:'verification'},{id:7,kind:'announcement'},{id:6,kind:'alert_new'},{id:5,kind:'feedback_update'}];
    const groups=residentNotificationGroups(rows);
    equal(groups.map(g=>g.title),['SOS updates','Barangay and account updates']);
    equal(groups.map(g=>g.rows.map(r=>r.id)),[[9,6],[8,7,5]]);
    equal(rows.map(r=>r.id),[9,8,7,6,5]);
    ok(groups[0].rows[0]===rows[0],'grouping replaced live notification records');
  });
  test('Resident filtering retains both named sections when one or both groups are empty',()=>{
    equal(residentNotificationGroups([]).map(g=>g.rows),[[],[]]);
    const rows=[{id:1,kind:'alert_status',is_read:true},{id:2,kind:'announcement',is_read:false}];
    equal(residentNotificationGroups(rows.filter(r=>r.is_read)).map(g=>g.rows.map(r=>r.id)),[[1],[]]);
    equal(residentNotificationGroups(rows.filter(r=>!r.is_read)).map(g=>g.rows.map(r=>r.id)),[[],[2]]);
  });
  test('Resident groups follow authorized live records and persistent read and clear actions',async()=>{
    const f=fixture();await f.login(f.authA,'ana.reyes');await f.apiA.alerts.acknowledge(1042);await f.apiA.announcements.create({title:'Community update',content:'School open'});await f.login(f.authB,'maria.santos');
    const groups=residentNotificationGroups(await f.apiB.notifications.list());
    equal(groups.map(g=>g.rows.length),[1,1]);
    ok(groups.every(g=>g.rows.every(n=>n.user_id===4)));
    const sos=groups[0].rows[0];await f.apiB.notifications.markRead(sos.id);ok(residentNotificationGroups(await f.apiB.notifications.list())[0].rows[0].is_read);
    await f.apiB.notifications.markUnread(sos.id);equal(residentNotificationGroups(await f.apiB.notifications.list())[0].rows[0].is_read,false);
    await f.apiB.notifications.markRead(sos.id);await f.apiB.notifications.clearRead({recipient_id:4,expected_role:'resident'});equal(residentNotificationGroups(await f.apiB.notifications.list()).map(g=>g.rows.length),[0,1]);
    await f.login(f.authB,'jose.dela.cruz');equal(residentNotificationGroups(await f.apiB.notifications.list()).map(g=>g.rows.length),[0,1]);
  });
}
