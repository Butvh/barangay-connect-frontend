/** Diagnostic controls only, not product UI. All data is fictional and local. */
import { Auth } from '../assets/js/core/auth.js';
import { Api } from '../assets/js/core/api.js';
import { Store } from '../assets/js/core/store.js';

export function mountLiveChecks(root) {
  const heading = document.createElement('h2'); heading.textContent = 'Real two-tab integration checks';
  const intro = document.createElement('p'); intro.textContent = 'Open tests.html in two tabs. Sign in as Maria in one tab and as an official in the other. These controls change only the fictional demo data on this origin.';
  const account = document.createElement('p'), current = document.createElement('p'), notices = document.createElement('p'), activity = document.createElement('p');
  current.setAttribute('aria-live', 'polite'); activity.setAttribute('role', 'status');
  const controls = document.createElement('div');
  root.append(heading, intro, account, current, notices, activity, controls);
  let renderVersion = 0;
  async function render() {
    const version = ++renderVersion, user = Auth.current();
    account.textContent = user ? `This tab: ${user.full_name} · ${Auth.roleOf(user)}` : 'This tab: signed out';
    if (!user) { current.textContent = 'Sign in to view scoped data.'; notices.textContent = ''; return; }
    try {
      const [alerts, notifications] = await Promise.all([Api.alerts.list(), Api.notifications.list()]);
      if (version !== renderVersion) return;
      const alert = alerts[0]; current.textContent = alert ? `Latest alert: A-${alert.id} · ${alert.status} · Destination: ${alert.rescues.at(-1)?.facility?.name || 'Not selected'}` : 'No alerts for this resident.';
      notices.textContent = `Notifications: ${notifications.length}. ${notifications.slice(0, 4).map(n => n.text).join(' | ')}`;
    } catch (error) { activity.textContent = `${error.code || 'ERROR'}: ${error.message}`; }
  }
  function button(label, action) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label;
    el.addEventListener('click', async () => { el.disabled = true; try { await action(); activity.textContent = `Completed: ${label}`; await render(); } catch (error) { activity.textContent = `${error.code || 'ERROR'}: ${error.message}`; } finally { el.disabled = false; } }); controls.append(el, document.createTextNode(' '));
  }
  for (const [name, email] of [['Maria', 'maria.santos'], ['Secretary', 'ana.reyes'], ['Responder', 'carlo.mendoza'], ['Rescuer', 'ramon.bautista']]) button(`Sign in ${name}`, () => Auth.login(`${email}@example.com`, 'demo1234'));
  button('Sign out this tab', async () => Auth.logout());
  const latest = async () => (await Api.alerts.list())[0];
  button('Create test SOS', () => Api.alerts.create({ alert_type: 'Flood', description: 'Browser cross-tab check', victim_count: null }));
  button('Assign Carlo and acknowledge latest', async () => { const a = await latest(); return Api.alerts.acknowledge(a.id, { responder_id: 2, expected_revision: a.assignment_revision }); });
  button('Assign Ramon to latest', async () => { const a = await latest(); return Api.alerts.assign(a.id, { role: 'rescuer', personnel_id: 3, expected_revision: a.assignment_revision }); });
  button('Log response latest', async () => Api.alerts.logResponse((await latest()).id, { rescue_required: true,  response_type: 'Assessment', response_status: 'Completed', notes: 'Browser cross-tab check' }));
  button('Log rescue latest', async () => Api.alerts.logRescue((await latest()).id, { facility_id: 1, rescue_status: 'In progress', notes: 'Browser cross-tab check' }));
  button('Resolve latest', async () => Api.alerts.resolve((await latest()).id));
  button('Publish test announcement', () => Api.announcements.create({ title: 'Browser test advisory', content: 'Fictional integration check.' }));
  button('Create test complaint', () => Api.feedback.create('complaint', { category: 'Drainage', description: 'Browser test drainage report', location: 'Riverside Street' }));
  button('Assign latest complaint', async () => Api.feedback.assignTanod((await Api.feedback.list({ type: 'complaint' }))[0].id, 6));
  button('Resolve latest complaint', async () => Api.feedback.resolve((await Api.feedback.list({ type: 'complaint' }))[0].id));
  button('Register test resident', async () => { const email = `qa-${Date.now()}@example.com`; await Api.users.register({ full_name: 'Demo Test Resident', email, password: 'demo1234', barangay_id: 1, address: '9 Mabini Street', file_name: 'mock-proof.pdf' }); await Auth.login(email, 'demo1234'); });
  button('Approve latest verification', async () => Api.verification.review((await Api.verification.list({ status: 'Pending' }))[0].id, { decision: 'Approved' }));
  button('Refresh scoped data', render);
  const dialog = document.createElement('dialog'); const question = document.createElement('p'); question.textContent = 'Reset all fictional demo data on this test origin?';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel reset'; cancel.addEventListener('click', () => dialog.close());
  const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Confirm demo reset'; confirm.addEventListener('click', async () => { await Store.reset(); Auth.logout(); dialog.close(); activity.textContent = 'Fictional data reset.'; await render(); }); dialog.append(question, cancel, confirm); root.append(dialog);
  button('Reset fictional demo data', async () => { dialog.showModal(); cancel.focus(); });
  for (const entity of ['alerts', 'notifications', 'verification', 'announcements', 'feedback']) Api.subscribe(entity, render);
  render();
}
