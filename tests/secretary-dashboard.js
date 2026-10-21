import * as model from '../assets/js/pages/official-dashboard-model.js';

export function registerSecretaryDashboardTests({ test, equal, ok, rejects, fixture }) {
  const at = '2026-10-04T14:20:00+08:00';
  const alert = (id, status = 'Pending', created_at = at, extra = {}) => ({ id, barangay_id: 1, status, created_at, alert_type: 'Flood', location_label: 'Riverside Street', victim_count: 2, map_x: 50, map_y: 50, ...extra });
  const announcement = (id, created_at = at, extra = {}) => ({ id, barangay_id: 1, created_at, title: `Update ${id}`, ...extra });
  const verification = (id, status = 'Pending', extra = {}) => ({ id, user_id: id, review_status: status, submitted_at: at, deadline_at: '2026-10-11T14:20:00+08:00', resident: { barangay_id: 1, full_name: 'Jose Dela Cruz' }, household: { address: '8 Mabini Street' }, ...extra });
  const project = (data = {}, reference = at, barangayId = 1) => model.secretaryDashboard(data, { at: reference, barangayId });

  test('Secretary priority uses newest active receipt and stable IDs without inventing priority levels', () => {
    const rows = [alert(1, 'Rescue in progress', '2026-10-04T10:00:00+08:00', { priority: 'High' }), alert(2, 'Pending'), alert(3, 'Resolved', '2026-10-04T15:00:00+08:00'), alert(4, 'Acknowledged'), alert(5, 'Closed')];
    const value = project({ alerts: rows }); equal(value.priority.id, 4); equal(value.activeAlerts.map(r => r.id), [4, 2, 1]);
    equal([value.metrics.active, value.metrics.pending, value.metrics.inProgress], [3, 1, 2]);
    equal(project({ alerts: rows.filter(r => r.status === 'Resolved') }).priority, null);
  });
  test('Secretary metrics and lists exclude foreign barangays and General Feedback operational statuses', () => {
    const feedback = [{ id: 1, barangay_id: 1, type: 'complaint', status: 'Pending' }, { id: 2, barangay_id: 1, type: 'suggestion', status: 'Assigned' }, { id: 3, barangay_id: 1, type: 'suggestion', status: 'Resolved' }, { id: 4, barangay_id: 1, type: 'general', status: 'Pending' }, { id: 5, barangay_id: 2, type: 'complaint', status: 'Pending' }];
    const v = project({ alerts: [alert(1), alert(2, 'Pending', at, { barangay_id: 2 })], feedback, verifications: [verification(1), verification(2, 'Pending', { resident: { barangay_id: 2 } })], announcements: [announcement(1), announcement(2, at, { barangay_id: 2 })] });
    equal([v.metrics.active, v.metrics.verifications, v.metrics.feedback, v.metrics.complaints, v.metrics.suggestions, v.metrics.announcementsToday], [1, 1, 2, 1, 1, 1]);
    ok(v.activity.every(r => !r.key.includes('announcement-2') && !r.key.includes('alert-2')));
  });
  test('pending verification counts use the latest submission and an actionable deadline', () => {
    const rows = [verification(1, 'Pending', { user_id: 9, submitted_at: '2026-10-01T09:00:00+08:00' }), verification(2, 'Approved', { user_id: 9 }), verification(3, 'Pending', { deadline_at: '2026-10-04T14:19:59+08:00' }), verification(4, 'Pending', { deadline_at: at }), verification(5, 'Pending', { deadline_at: 'invalid' })];
    const value = project({ verifications: rows }); equal(value.pendingVerifications.map(r => r.id), [4]); equal(value.metrics.verifications, 1);
    equal(project({ verifications: rows }, '2026-10-04T14:20:00.001+08:00').metrics.verifications, 0);
  });
  test('publication totals use explicit publication instants and Manila dates, not edit time or machine date', () => {
    const rows = [announcement(1, '2026-09-30T15:59:59Z'), announcement(2, '2026-09-30T16:00:00Z'), announcement(3, '2026-09-20T10:00:00+08:00', { published_at: '2026-10-01T00:30:00+08:00', updated_at: '2026-10-02T10:00:00+08:00' }), announcement(4, '2026-10-01T01:00:01+08:00'), announcement(5, null), announcement(6, 'invalid'), announcement(7, '2026-10-01T00:20:00+08:00', { status: 'Draft' })];
    equal(project({ announcements: rows }, '2026-10-01T01:00:00+08:00').metrics.announcementsToday, 2);
    equal(project({ announcements: [announcement(1, '2026-12-31T16:00:00Z')] }, '2027-01-01T01:00:00+08:00').metrics.announcementsToday, 1);
  });
  test('recent announcements exclude withdrawn, expired, unpublished and future rows but publication events stay historical', () => {
    const rows = [announcement(1), announcement(2, at, { status: 'Archived' }), announcement(3, at, { status: 'Retracted' }), announcement(4, at, { expires_at: at }), announcement(5, at, { is_published: false }), announcement(6, at, { published_at: null })];
    const value = project({ announcements: rows }); equal(value.recentAnnouncements.map(r => r.id), [1]); equal(value.metrics.announcementsToday, 4);
    equal(value.activity.filter(r => r.kind === 'announcement').length, 4);
  });
  test('announcement categories come only from stored metadata and never from title guesses', () => {
    const rows = [announcement(1, at, { title: 'Typhoon advisory' }), announcement(2, at, { category: 'Assembly' })];
    const value = project({ announcements: rows }); equal(value.metrics.categories, [{ label: 'Update', count: 1 }, { label: 'Assembly', count: 1 }]);
    equal(value.recentAnnouncements[0].category, 'Assembly'); equal(value.recentAnnouncements[1].category, undefined);
  });
  test('map counts include only actual valid coordinate markers and preserve their zero coordinates', () => {
    const value = project({ alerts: [alert(1, 'Pending', at, { map_x: 0, map_y: 100 }), alert(2, 'Pending', at, { map_x: null }), alert(3, 'Pending', at, { map_x: '' }), alert(4, 'Resolved'), alert(5, 'Pending', at, { map_x: '  ' }), alert(6, 'Pending', at, { map_y: false })], facilities: [{ id: 1, barangay_id: 1, type: 'EvacuationCenter', map_x: 10, map_y: 20 }, { id: 2, barangay_id: null, type: 'Hospital', map_x: 77, map_y: 22 }, { id: 3, barangay_id: 2, map_x: 10, map_y: 20 }, { id: 4, barangay_id: 1, map_x: 101, map_y: 20 }] });
    equal(value.markers.map(r => r.id), ['alert-1', 'facility-1', 'facility-2']); equal(value.markers[0].x, 0); equal(value.unmappedAlerts, 4); equal(value.mappedFacilities, 2);
    const uncovered = project({ facilities: [{ id: 1, barangay_id: null, map_x: 10, map_y: 20 }] }, at, 2); equal(uncovered.markers, []); equal(uncovered.mappedFacilities, 0);
  });
  test('activity uses valid source timestamps, exact record links and no fabricated feedback review event', () => {
    const value = project({ alerts: [alert(12)], verifications: [verification(7, 'Approved', { submitted_at: '2026-10-04T12:00:00+08:00', reviewed_at: '2026-10-04T13:00:00+08:00' })], announcements: [announcement(9, '2026-10-04T10:00:00+08:00')], feedback: [{ id: 8, barangay_id: 1, type: 'suggestion', status: 'Resolved', created_at: '2026-10-04T09:00:00+08:00', description: 'Signs' }] });
    equal(value.activity.map(r => r.at), [at, '2026-10-04T13:00:00+08:00', '2026-10-04T12:00:00+08:00', '2026-10-04T10:00:00+08:00', '2026-10-04T09:00:00+08:00']);
    equal(value.activity[0].href, 'official-alert.html?id=12'); equal(value.activity[1].href, 'official-verification.html?id=7'); equal(value.activity.at(-1).href, 'official-feedback.html?type=suggestion&id=8');
    equal(value.activity.filter(r => /feedback reviewed/i.test(r.title)).length, 0);
  });
  test('activity ignores invalid/future times, deduplicates source events and leaves all inputs unchanged', () => {
    const rows = [alert(1), alert(1), alert(2, 'Pending', 'invalid'), alert(3, 'Pending', '2027-01-01T00:00:00+08:00')], before = JSON.stringify(rows);
    equal(project({ alerts: rows }).activity.map(r => r.key), ['alert-1-received']); equal(JSON.stringify(rows), before);
  });
  test('empty and invalid-clock projections expose honest empty states without invalid temporal values', () => {
    const value = project(); equal(value.priority, null); equal(value.activity, []); equal(value.markers, []); equal(value.recentAnnouncements, []); equal(value.metrics.active, 0);
    const invalid = project({ announcements: [announcement(1)], alerts: [alert(2)] }, 'invalid'); equal(invalid.metrics.announcementsToday, 0); equal(invalid.activity, []);
  });
  test('live API changes feed dashboard metrics and destinations without modifying shared role permissions', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    const read = async () => project({ alerts: await f.apiA.alerts.list(), verifications: await f.apiA.verification.list(), announcements: await f.apiA.announcements.list(), feedback: await f.apiA.feedback.list(), facilities: await f.apiA.facilities.list() }, f.storeA.now());
    let value = await read(); equal([value.priority.id, value.metrics.active, value.metrics.verifications, value.metrics.feedback, value.metrics.announcementsToday], [1042, 2, 1, 2, 2]);
    await f.apiA.feedback.resolve(1); await f.apiA.verification.review(2, { decision: 'Approved' }); await f.apiA.alerts.resolve(1038); const row = await f.apiA.announcements.create({ title: 'New update', content: 'Current information' });
    value = await read(); equal([value.metrics.active, value.metrics.verifications, value.metrics.feedback, value.metrics.announcementsToday], [1, 0, 1, 3]); equal(value.recentAnnouncements[0].id, row.id);
    await f.apiA.announcements.retract(row.id, { reason: 'Correction needed' }); value = await read(); equal(value.metrics.announcementsToday, 3); ok(!value.recentAnnouncements.some(r => r.id === row.id));
    for (const name of ['carlo.mendoza', 'ramon.bautista']) { await f.login(f.authB, name); await rejects(() => f.apiB.feedback.list(), 'FORBIDDEN'); await rejects(() => f.apiB.verification.list(), 'FORBIDDEN'); }
  });
}
