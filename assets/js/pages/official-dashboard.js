import { Auth, Api, UI, Store, live, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { mountSecretaryDashboard } from './secretary-dashboard.js?v=secretary-dashboard-1';
import { renderResponderDashboard } from './official-responder-dashboard.js?v=rescuer-2';
import { renderRescuerDashboard } from './official-rescuer-dashboard.js?v=rescuer-2';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) {
  if (!['AUTH', 'FORBIDDEN'].includes(error.code)) {
    document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to open the workspace', text: error.message, action: { href: 'login.html', label: 'Back to sign in' } });
  }
}
if (user) {
const role = Auth.roleOf(user), main = Shell.official({ role, active: 'Dashboard' });
if (role === 'secretary') { mountSecretaryDashboard(main, user); } else {
main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading dashboard…</p>' + UI.skeleton(3);
let miniMaps = [];
async function render() {
  try {
    const [alerts, facilities, barangays] = await Promise.all([Api.alerts.list(), Api.facilities.list(), Api.barangays.list()]);
    const barangay = barangays.find(b => b.id === user.barangay_id)?.name || 'Your barangay';
    miniMaps.forEach(m => m.destroy()); miniMaps = [];
    if (role === 'responder') {
      document.title = 'Responder dashboard — Barangay Connect';
      miniMaps.push(renderResponderDashboard({ main, alerts, facilities, user, barangay, now: Store.now(), refreshed: async () => { await render(); main.focus(); } }));
    } else {
      document.title = 'Rescuer dashboard — Barangay Connect';
      miniMaps.push(renderRescuerDashboard({ main, alerts, facilities, user, barangay, now: Store.now(), refreshed: async () => { await render(); main.focus(); } }));
    }
  } catch (err) { miniMaps.forEach(m => m.destroy()); miniMaps = []; errorView(main, err, render); }
  finally { main.removeAttribute('aria-busy'); }
}
live(['alerts', 'announcements', 'verification', 'feedback', 'users'], render)();
window.addEventListener('pagehide', event => { if (!event.persisted) miniMaps.forEach(m => m.destroy()); }, { once: true });
}
}
