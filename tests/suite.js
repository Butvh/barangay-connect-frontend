import { RULES, ALERT_STATUSES, transition } from '../assets/js/core/alertMachine.js';
import { roleOf } from '../assets/js/core/permissions.js';
import { createStore, memoryStorage } from '../assets/js/core/store.js';
import { createAuth } from '../assets/js/core/auth.js';
import { createApi } from '../assets/js/core/api.js';
import { Config } from '../assets/js/core/config.js';
import { monitoringMarkers } from '../assets/js/pages/official-map-model.js';
import { verificationPage, verificationStats, reviewable } from '../assets/js/pages/official-verification-model.js';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const equal = (a, b, label = 'values differ') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const ok = (value, label = 'assertion failed') => { if (!value) throw new Error(label); };
async function rejects(run, code) { let found; try { await run(); } catch (error) { found = error; } ok(found, `expected ${code}`); equal(found.code, code); }
const noDelay = () => Promise.resolve();
test('verification queue clamps pages after filters and keeps records immutable', () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, submitted_at: `2026-10-04T09:${String(i).padStart(2, '0')}:00+08:00`, review_status: i ? 'Approved' : 'Pending', resident: { full_name: `Resident ${i}` }, household: { address: `${i} Riverside Street` } })), before = JSON.stringify(rows);
  const page = verificationPage(rows, { page: 3 }); equal(page.rows.map(r => r.id), [3, 2, 1]); equal(page.pages, 3);
  const filtered = verificationPage(rows, { status: 'Pending', page: 3 }); equal(filtered.page, 1); equal(filtered.rows.map(r => r.id), [1]); equal(JSON.stringify(rows), before);
});
test('verification search matches names and addresses and handles empty results', () => {
  const rows = [{ id: 1, resident: { full_name: 'Jose Dela Cruz' }, household: { address: '8 Mabini Street' }, submitted_at: Config.demo_time, review_status: 'Pending' }];
  equal(verificationPage(rows, { q: '  JOSE  ' }).total, 1); equal(verificationPage(rows, { q: 'mabini' }).total, 1); const empty = verificationPage(rows, { q: 'Hillside', page: 8 }); equal([empty.total, empty.page, empty.pages], [0, 1, 1]);
});
test('verification summary uses Manila dates and counts only completed reviews', () => {
  const rows = [{ review_status: 'Pending', deadline_at: '2026-10-03T17:00:00Z' }, { review_status: 'Pending', deadline_at: '2026-10-04T17:00:00Z' }, { review_status: 'Approved', reviewed_at: '2026-10-03T18:00:00Z' }, { review_status: 'Rejected', reviewed_at: '2026-10-04T14:00:00+08:00' }, { review_status: 'Expired', reviewed_at: Config.demo_time }];
  equal(verificationStats(rows, Config.demo_time), { pending: 2, due: 1, reviewed: 2 });
});
test('verification reviewability agrees with the deadline boundary', () => {
  const record = { review_status: 'Pending', deadline_at: Config.demo_time }; ok(reviewable(record, Config.demo_time)); ok(!reviewable(record, '2026-10-04T14:20:00.001+08:00')); ok(!reviewable({ ...record, review_status: 'Approved' }, Config.demo_time)); ok(!reviewable({ ...record, deadline_at: null }, Config.demo_time));
});
const mapData = () => ({ alerts: [{ id: 1, alert_type: 'Flood', status: 'Pending', map_x: 0, map_y: 100 }, { id: 2, alert_type: 'Other', status: 'Resolved', map_x: 20, map_y: 30 }], facilities: [{ id: 1, type: 'Hospital', name: 'Hospital', map_x: 10, map_y: 20 }, { id: 2, type: 'EvacuationCenter', name: 'School', map_x: 50, map_y: 50 }], households: [{ id: 1, address: '8 Mabini Street', map_x: 43, map_y: 44 }, { id: 1, address: '8 Mabini Street', map_x: 43, map_y: 44 }], complaints: [{ id: 1, location: ' 8   MABINI STREET ', category: 'Drainage', status: 'Pending' }, { id: 2, location: 'Elsewhere', category: 'Drainage', status: 'Pending' }] });
const mapFilters = { status: '', type: '', facility: '', households: true, complaints: true };
test('monitoring filters preserve status and edge coordinates without mutating records', () => {
  const data = mapData(), before = JSON.stringify(data), result = monitoringMarkers(data, { ...mapFilters, status: 'Pending', type: 'Flood' }, 'secretary');
  equal(result.alertCount, 1); const alert = result.markers.find(m => m.kind === 'alert'); equal([alert.x, alert.y, alert.status], [0, 100, 'Pending']); equal(JSON.stringify(data), before);
});
test('monitoring complaint pins require Secretary and a matching household location', () => {
  const result = monitoringMarkers(mapData(), mapFilters, 'secretary'); equal(result.unplacedComplaints, 1); equal(result.markers.filter(m => m.kind === 'complaint').map(m => [m.record.id, m.x, m.y]), [[1, 43, 44]]);
  for (const role of ['responder', 'rescuer']) { const read = monitoringMarkers(mapData(), mapFilters, role); equal(read.unplacedComplaints, 0); equal(read.markers.filter(m => m.kind === 'complaint').length, 0); }
});
test('monitoring layers deduplicate households and distinguish facility types', () => {
  const data = mapData(); equal(monitoringMarkers(data, mapFilters, 'secretary').markers.filter(m => m.kind === 'household').length, 1);
  const filtered = monitoringMarkers(data, { ...mapFilters, facility: 'Hospital', households: false, complaints: false }, 'secretary'); equal(filtered.markers.map(m => m.kind), ['hall', 'alert', 'alert', 'hospital']);
  equal(monitoringMarkers(data, { ...mapFilters, facility: 'none' }, 'secretary').markers.filter(m => ['hospital', 'evacuation'].includes(m.kind)).length, 0);
});
test('monitoring never fabricates a pin for missing or invalid coordinates', () => {
  const data = mapData(); data.alerts[0].map_x = null; data.facilities[0].map_y = 101; data.households[0].map_x = NaN; data.households[1].map_x = undefined;
  const result = monitoringMarkers(data, mapFilters, 'secretary'); equal(result.markers.map(m => m.id), ['hall', 'alert-2', 'facility-2']); equal(result.unplacedComplaints, 2);
});
function fixture() {
  const storage = memoryStorage();
  const eventsA = new EventTarget(), eventsB = new EventTarget();
  let time = Config.demo_time;
  const backend = other => ({ ...storage, setItem(key, value) { storage.setItem(key, value); const e = new Event('storage'); Object.defineProperty(e, 'key', { value: key }); other.dispatchEvent(e); } });
  const storeA = createStore({ storage: backend(eventsB), eventTarget: eventsA, clock: () => time, locks: null });
  const storeB = createStore({ storage: backend(eventsA), eventTarget: eventsB, clock: () => time, locks: null });
  const authA = createAuth({ store: storeA, session: memoryStorage(), wait: noDelay, location: null });
  const authB = createAuth({ store: storeB, session: memoryStorage(), wait: noDelay, location: null });
  const apiA = createApi({ store: storeA, auth: authA, wait: noDelay, clock: () => time });
  const apiB = createApi({ store: storeB, auth: authB, wait: noDelay, clock: () => time });
  const login = (auth, person) => auth.login(`${person}@example.com`, 'demo1234');
  return { storage, storeA, storeB, authA, authB, apiA, apiB, login, setTime: value => { time = value; } };
}

for (const [action, rule] of Object.entries(RULES)) for (const status of ALERT_STATUSES) for (const role of ['secretary', 'responder', 'rescuer', 'resident']) {
  test(`machine: ${role} ${action} at ${status}`, async () => {
    const input = { id: 1, status }; const user = { id: 1, [`is_${role}`]: true };
    if (role === rule.role && status === rule.from) { const next = transition(input, action, user, Config.demo_time); equal(next.status, rule.to); equal(input.status, status, 'input was mutated'); }
    else await rejects(() => transition(input, action, user, Config.demo_time), role !== rule.role ? 'FORBIDDEN' : 'INVALID_STATE');
  });
}
test('staff role wins over resident; data-only officials cannot sign in', async () => {
  equal(roleOf({ is_resident: true, is_secretary: true }), 'secretary');
  const f = fixture(); await rejects(() => f.login(f.authA, 'luis.garcia'), 'AUTH');
});
test('auth sessions are isolated across resident and official tabs', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'ana.reyes');
  equal(f.authA.roleOf(f.authA.current()), 'resident'); equal(f.authB.roleOf(f.authB.current()), 'secretary');
  ok(!('password' in f.authA.current())); f.authB.logout(); ok(f.authA.current()); equal(f.authB.current(), null);
});
test('F-X1/F-X2 full workflow, timeline, destination and cross-tab notifications', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'ana.reyes');
  let sameTab = 0, crossTab = 0; const offA = f.apiA.subscribe('alerts', () => sameTab++), offB = f.apiB.subscribe('alerts', () => crossTab++);
  const alert = await f.apiA.alerts.create({ alert_type: 'Flood', victim_count: null, description: 'Rising water' });
  equal(alert.status, 'Pending'); equal(alert.victim_count, null); equal(alert.resident.full_name, 'Maria Santos');
  equal((await f.apiB.alerts.get(alert.id)).id, alert.id); ok(sameTab > 0 && crossTab > 0);
  ok((await f.apiB.notifications.list()).some(n => n.kind === 'alert_new' && n.link.endsWith(`id=${alert.id}`)));
  const ack = await f.apiB.alerts.acknowledge(alert.id); equal(ack.assigned_responder.id, 2);
  await f.login(f.authB, 'carlo.mendoza'); await f.apiB.alerts.logResponse(alert.id, { response_type: 'First aid', response_status: 'Completed', notes: 'Assessed.' });
  await f.login(f.authB, 'ramon.bautista'); await f.apiB.alerts.logRescue(alert.id, { facility_id: 2, rescue_status: 'In progress', notes: 'Transport.' });
  await f.login(f.authB, 'ana.reyes'); await f.apiB.alerts.resolve(alert.id);
  const final = await f.apiA.alerts.get(alert.id); equal(final.status, 'Resolved'); equal(final.timeline.filter(t => t.at).length, 5); equal(final.timeline.filter(t => t.current).map(t => t.status), ['Resolved']); equal(final.rescues[0].facility.name, 'Dalisay District Hospital');
  const notes = await f.apiA.notifications.list(); equal(notes.filter(n => n.kind === 'alert_status' && n.link.endsWith(`id=${alert.id}`)).length, 4); ok(notes.some(n => n.text.includes('Dalisay District Hospital')));
  offA(); offB(); const before = crossTab; await f.storeA.reset(); equal(crossTab, before);
});
test('each invalid API transition preserves records and revision', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); const before = f.storeA.read(); await rejects(() => f.apiA.alerts.acknowledge(1042), 'FORBIDDEN'); equal(f.storeA.read(), before);
  await f.login(f.authA, 'carlo.mendoza'); await rejects(() => f.apiA.alerts.logResponse(1042, { response_type: 'Assessment', response_status: 'Completed', notes: '' }), 'FORBIDDEN');
});
test('simultaneous acknowledgement commits only once', async () => {
  const f = fixture(); await f.login(f.authA, 'ana.reyes'); const result = await Promise.allSettled([f.apiA.alerts.acknowledge(1042), f.apiA.alerts.acknowledge(1042)]); equal(result.filter(r => r.status === 'fulfilled').length, 1); equal((await f.apiA.alerts.get(1042)).status, 'Acknowledged');
});
test('unverified resident cannot SOS or read another resident alert', async () => {
  const f = fixture(); await f.login(f.authA, 'jose.dela.cruz'); await rejects(() => f.apiA.alerts.create({}), 'FORBIDDEN'); await rejects(() => f.apiA.alerts.get(1042), 'FORBIDDEN'); await rejects(() => f.apiA.alerts.list({ resident_id: 4 }), 'FORBIDDEN');
});
test('F-X4 registration -> reject -> resubmit -> approve -> SOS', async () => {
  const f = fixture(); const person = await f.apiA.users.register({ full_name: 'Test Resident', email: 'test@example.com', password: 'demo1234', barangay_id: 1, address: '9 Mabini Street' });
  ok(!('password' in person)); await f.authA.login('test@example.com', 'demo1234');
  await f.apiA.verification.submit(person.id, { document_type: 'Proof of residence', file_name: 'proof.pdf' });
  await f.login(f.authB, 'ana.reyes'); const row = (await f.apiB.verification.list()).find(v => v.user_id === person.id); ok(row); equal(Date.parse(row.deadline_at) - Date.parse(row.submitted_at), 7 * 86400000);
  await rejects(() => f.apiB.verification.review(row.id, { decision: 'Rejected', reason: '' }), 'VALIDATION');
  await f.apiB.verification.review(row.id, { decision: 'Rejected', reason: 'Please upload a readable document.' }); await rejects(() => f.apiA.alerts.create({}), 'FORBIDDEN');
  const again = await f.apiA.verification.submit(person.id, { document_type: 'Proof of residence', file_name: 'clear-proof.pdf' });
  await f.apiB.verification.review(again.id, { decision: 'Approved' }); equal((await f.apiA.verification.get(again.id)).review_status, 'Approved'); equal((await f.apiA.alerts.create({})).status, 'Pending');
});
test('verification review rejects other official roles without changing data', async () => {
  const f = fixture();
  for (const name of ['carlo.mendoza', 'ramon.bautista']) { await f.login(f.authA, name); const before = f.storeA.read(); await rejects(() => f.apiA.verification.get(2), 'FORBIDDEN'); await rejects(() => f.apiA.verification.review(2, { decision: 'Approved' }), 'FORBIDDEN'); equal(f.storeA.read(), before); }
});
test('competing verification decisions commit once and notify the resident once', async () => {
  const f = fixture(); await f.login(f.authA, 'ana.reyes');
  const before = f.storeA.read().notifications.filter(n => n.user_id === 5).length;
  const results = await Promise.allSettled([f.apiA.verification.review(2, { decision: 'Approved' }), f.apiA.verification.review(2, { decision: 'Rejected', reason: 'Please upload a readable document.' })]);
  equal(results.filter(r => r.status === 'fulfilled').length, 1); equal(f.storeA.read().notifications.filter(n => n.user_id === 5).length, before + 1); ok(['Approved', 'Rejected'].includes((await f.apiA.verification.get(2)).review_status));
});
test('residency expiry is scoped and never expires an approval', async () => {
  const f = fixture(); await f.login(f.authA, 'ana.reyes'); f.setTime('2026-10-12T10:00:00+08:00'); equal(await f.apiA.verification.expireOverdue(), 1); equal((await f.apiA.verification.get(1)).review_status, 'Approved'); equal((await f.apiA.verification.get(2)).review_status, 'Expired');
});
test('F-X3 announcements reach resident tabs and notifications', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'ana.reyes'); let changes = 0; f.apiA.subscribe('announcements', () => changes++);
  const note = await f.apiB.announcements.create({ title: 'Evacuation advisory', content: 'The school is open.' }); equal((await f.apiA.announcements.get(note.id)).title, note.title); ok(changes > 0); ok((await f.apiA.notifications.list()).some(n => n.kind === 'announcement'));
});
test('F-X5 feedback assignment/resolution; General has no workflow status', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'ana.reyes');
  const row = await f.apiA.feedback.create('complaint', { category: 'Drainage', description: 'Blocked drain', location: 'Riverside Street' });
  equal((await f.apiB.feedback.get(row.id)).status, 'Pending'); await f.apiB.feedback.assignTanod(row.id, 6); equal((await f.apiA.feedback.get(row.id)).status, 'Assigned'); await f.apiB.feedback.resolve(row.id); equal((await f.apiA.feedback.get(row.id)).status, 'Resolved'); equal((await f.apiA.notifications.list()).filter(n => n.kind === 'feedback_update').length, 2);
  const general = await f.apiA.feedback.create('general', { rating: 4, comment: 'Clear information.' }); equal(general.status, null); await rejects(() => f.apiB.feedback.assignTanod(general.id, 6), 'INVALID_STATE'); await rejects(() => f.apiB.feedback.resolve(general.id), 'INVALID_STATE');
});
test('cross-barangay reads/reviews and account escalation are rejected', async () => {
  const f = fixture(); const other = await f.apiA.users.register({ full_name: 'Dalisay Resident', email: 'dalisay@example.com', password: 'demo1234', barangay_id: 2, address: '1 District Road' });
  await f.authA.login(other.email, 'demo1234'); await rejects(() => f.apiA.alerts.get(1042), 'FORBIDDEN'); await rejects(() => f.apiA.users.update(other.id, { is_secretary: true }), 'VALIDATION');
  const v = await f.apiA.verification.submit(other.id, { document_type: 'Proof of residence', file_name: 'proof.pdf' }); await f.login(f.authB, 'ana.reyes'); await rejects(() => f.apiB.verification.review(v.id, { decision: 'Approved' }), 'FORBIDDEN');
  equal((await f.apiA.facilities.list()).map(x => x.id), [2]); await rejects(() => f.apiA.facilities.get(1), 'FORBIDDEN');
  await rejects(() => f.apiA.users.register({ full_name: 'Fake Staff', email: 'fake@example.com', password: 'demo1234', barangay_id: 1, address: 'A', is_secretary: true }), 'FORBIDDEN');
});
test('notification operations cannot clear or read another user notifications', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); await rejects(() => f.apiA.notifications.markRead(1), 'FORBIDDEN'); await f.login(f.authB, 'ana.reyes'); await f.apiB.notifications.markAllRead(); const n = await f.apiB.notifications.clearRead(); equal(n, 2); equal((await f.apiB.notifications.list()).length, 0);
});
test('invalid fields roll back; returned data cannot mutate the store', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos'); const before = f.storeA.read();
  await rejects(() => f.apiA.alerts.create({ victim_count: -1 }), 'VALIDATION'); await rejects(() => f.apiA.alerts.create({ map_x: 120 }), 'VALIDATION'); equal(f.storeA.read(), before);
  const rows = await f.apiA.alerts.list(); rows[0].status = 'Resolved'; equal((await f.apiA.alerts.get(1042)).status, 'Pending'); ok(!('password' in (await f.apiA.users.get(4))));
});
test('demo reset recovers corrupt and unsupported storage', async () => {
  const f = fixture(); f.storage.setItem(Config.storage_key, '{bad'); await rejects(() => f.storeA.read(), 'VALIDATION'); await f.storeA.reset(); equal(f.storeA.read().emergency_alerts.length, 3);
  f.storage.setItem(Config.storage_key, JSON.stringify({ version: 999, revision: 2 })); await rejects(() => f.storeA.read(), 'INVALID_STATE'); await f.storeA.reset(); equal(f.storeA.read().version, 1);
});
test('APIs reject unauthenticated reads; barangays stay public', async () => {
  const f = fixture(); equal((await f.apiA.barangays.list()).length, 3); await rejects(() => f.apiA.alerts.list(), 'AUTH'); await rejects(() => f.apiA.notifications.list(), 'AUTH');
});
test('omitted form fields return contract validation errors', async () => {
  const f = fixture(); await rejects(() => f.apiA.users.register(), 'VALIDATION');
  await f.login(f.authA, 'ana.reyes'); await rejects(() => f.apiA.announcements.create(), 'VALIDATION');
  await f.login(f.authA, 'jose.dela.cruz'); await rejects(() => f.apiA.verification.submit(5), 'VALIDATION');
});
test('data expiry checks role even when no scoped verification exists', async () => {
  const f = fixture(); await f.login(f.authA, 'carlo.mendoza'); await f.storeA.transact(['verification'], db => { db.verify_residency = []; }); await rejects(() => f.apiA.verification.expireOverdue(), 'FORBIDDEN');
});
test('two stores use one persisted demo epoch', async () => {
  const storage = memoryStorage(), a = createStore({ storage, eventTarget: null, locks: null }), b = createStore({ storage, eventTarget: null, locks: null });
  const db = a.read(); db.demo_started_at -= 60000; storage.setItem(Config.storage_key, JSON.stringify(db));
  const delta = Math.abs(Date.parse(a.now()) - Date.parse(b.now())); ok(delta < 1000); ok(Date.parse(b.now()) >= Date.parse(Config.demo_time) + 59000);
});

test('residents list only their latest verification; officials retain the queue', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos');
  equal((await f.apiA.verification.list()).map(v => v.user_id), [4]);
  equal(await f.apiA.verification.list({ status: 'Pending' }), []);
  await f.login(f.authA, 'jose.dela.cruz');
  equal((await f.apiA.verification.list({ status: 'Pending' })).map(v => v.user_id), [5]);
  await f.login(f.authB, 'ana.reyes'); equal((await f.apiB.verification.list()).length, 2);
  await f.login(f.authB, 'carlo.mendoza'); await rejects(() => f.apiB.verification.list(), 'FORBIDDEN');
});

test('no-op expiry does not emit or cause a live verification refresh loop', async () => {
  const f = fixture(); await f.login(f.authA, 'jose.dela.cruz');
  let same = 0, cross = 0; f.apiA.subscribe('verification', () => same++); f.apiB.subscribe('verification', () => cross++);
  const before = f.storeA.read(); equal(await f.apiA.verification.expireOverdue(), 0);
  equal(f.storeA.read(), before); equal(same, 0); equal(cross, 0);
  f.setTime('2026-10-12T10:00:00+08:00'); equal(await f.apiA.verification.expireOverdue(), 1);
  equal(same, 1); equal(cross, 1); equal(await f.apiA.verification.expireOverdue(), 0); equal(same, 1); equal(cross, 1);
});

test('feedback notification links use the existing resident feedback page', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos');
  const feedback = await f.apiA.feedback.create('complaint', { category: 'Drainage', description: 'Blocked drain', location: 'Riverside Street' });
  await f.login(f.authB, 'ana.reyes'); await f.apiB.feedback.assignTanod(feedback.id, 6);
  const note = (await f.apiA.notifications.list()).find(n => n.kind === 'feedback_update');
  equal(note.link, `resident-feedback.html?id=${feedback.id}`);
});

test('nearby map read exposes only public fields and preserves private own/get reads', async () => {
  const f = fixture(); await f.login(f.authA, 'maria.santos');
  await f.storeA.transact(['alerts'], db => { const a = db.emergency_alerts.find(a => a.id === 1042); a.location_label = 'Maria Santos at 14 Riverside Street'; a.description = 'Private detail'; a.photo_name = 'private.jpg'; a.map_x = 63; a.map_y = 57; });
  const nearby = await f.apiA.alerts.list({ nearby: true });
  equal(nearby.map(a => a.id), [1042, 1038, 1031]);
  equal(Object.keys(nearby[0]).sort(), ['id', 'barangay_id', 'alert_type', 'status', 'created_at', 'location_label', 'map_x', 'map_y', 'description'].sort());
  const publicAlert = nearby.find(a => a.id === 1042); equal(publicAlert.location_label, 'Barangay Sampaguita'); equal([publicAlert.map_x, publicAlert.map_y], [60, 60]);
  ok(!JSON.stringify(nearby).includes('Maria')); ok(!JSON.stringify(nearby).includes('private.jpg')); ok(!JSON.stringify(nearby).includes('Private detail'));
  equal((await f.apiA.alerts.list()).map(a => a.id), [1042]); equal((await f.apiA.alerts.get(1042)).photo_name, 'private.jpg');
  await rejects(() => f.apiA.alerts.get(1038), 'FORBIDDEN');
  await rejects(() => f.apiA.alerts.list({ nearby: true, resident_id: 4 }), 'VALIDATION');
});

test('nearby filters do not reveal private identity or exact address through search', async () => {
  const f = fixture(); await f.login(f.authA, 'jose.dela.cruz');
  equal(await f.apiA.alerts.list({ nearby: true, q: 'Maria Santos' }), []);
  equal(await f.apiA.alerts.list({ nearby: true, q: 'Riverside Street' }), []);
  equal((await f.apiA.alerts.list({ nearby: true, q: 'Flood', status: 'Pending' })).map(a => a.id), [1042]);
  equal((await f.apiA.alerts.list({ nearby: true, alert_type: 'Landslide' })).map(a => a.id), [1031]);
});

test('nearby map read stays within the resident barangay and requires a session', async () => {
  const f = fixture(); await rejects(() => f.apiA.alerts.list({ nearby: true }), 'AUTH');
  const other = await f.apiA.users.register({ full_name: 'Dalisay Resident', email: 'dalisay@example.com', password: 'demo1234', barangay_id: 2, address: '1 Main Road' });
  await f.authA.login(other.email, 'demo1234'); equal(await f.apiA.alerts.list({ nearby: true }), []);
  await f.login(f.authA, 'ana.reyes'); await rejects(() => f.apiA.alerts.list({ nearby: true }), 'FORBIDDEN');
});

export async function runSuite(onResult = () => {}) {
  const results = [];
  for (const test of tests) { let error = ''; try { await test.run(); } catch (e) { error = e.stack || e.message; } const result = { name: test.name, passed: !error, error }; results.push(result); onResult(result); }
  return { passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
}
