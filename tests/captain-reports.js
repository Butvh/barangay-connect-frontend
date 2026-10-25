import { captainReportData, reportPage, reportsCSV } from '../assets/js/pages/captain-reports-model.js';

export function registerCaptainReportsTests({ test, equal, ok, fixture }) {
  const at = '2026-10-25T12:00:00+08:00';
  const alert = (id, patch = {}) => ({ id, barangay_id: 1, alert_type: 'Flood', status: 'Pending', created_at: '2026-10-03T10:00:00+08:00', responses: [], rescues: [], ...patch });
  const data = patch => ({ barangay_id: 1, at, alerts: [], users: [], ...patch });
  test('Captain reports use Manila month boundaries and exclude invalid or future dates', () => {
    const p = captainReportData(data({ alerts: [alert(1, { created_at: '2026-09-30T16:00:00Z' }), alert(2, { created_at: '2026-09-30T15:59:59Z' }), alert(3, { created_at: 'invalid' }), alert(4, { created_at: '2026-10-30T00:00:00+08:00' })] }));
    equal(p.metrics.incidents, 1); equal(p.metrics.previousIncidents, 1); equal(p.metrics.invalidIncidentDates, 1); equal(p.period, '2026-10');
  });
  test('Captain reports reject rolled-over calendar dates and ambiguous local timestamps', () => {
    const p = captainReportData(data({ alerts: [alert(1, { created_at: '2026-02-30T10:00:00+08:00' }), alert(2, { created_at: '2026-10-03T10:00:00' })] }));
    equal(p.metrics.invalidIncidentDates, 2); equal(p.metrics.incidents, 0); equal(p.activity, []);
  });
  test('Captain reports guard every collection against mixed barangays without changing input', () => {
    const s = data({ alerts: [alert(1), alert(2, { barangay_id: 2 })], feedback: [{ id: 1, barangay_id: 2, status: 'Resolved' }], verifications: [{ id: 1, resident: { barangay_id: 2 }, reviewed_at: at, review_status: 'Approved' }], activity_logs: [{ id: 1, barangay_id: 2, at }], personnel: { records: [{ user_id: 2, barangay_id: 2, role: 'secretary' }] } });
    const before = JSON.stringify(s), p = captainReportData(s); equal(p.alerts.map(r => r.id), [1]); equal(p.metrics.resolvedFeedback, 0); equal(p.metrics.completedVerifications, 0); equal(p.activity.length, 1); equal(p.performance.secretary, []); equal(JSON.stringify(s), before);
    equal(captainReportData({ alerts: [alert(1)], at }).alerts, []);
  });
  test('Captain response average uses first recorded nonnegative response and excludes missing samples', () => {
    const p = captainReportData(data({ alerts: [alert(1, { acknowledged_at: at, responses: [{ id: 1, responded_at: '2026-10-03T10:10:00+08:00' }, { id: 2, responded_at: '2026-10-03T10:05:00+08:00' }] }), alert(2, { responses: [{ id: 3, responded_at: '2026-10-03T09:00:00+08:00' }] }), alert(3), alert(4, { created_at: 'invalid', responses: [{ id: 4, responded_at: at }] })] }));
    equal(p.metrics.averageResponseMinutes, 5); equal(p.metrics.responseSampleSize, 1); equal(p.metrics.responseExcluded, 2);
  });
  test('Captain people assisted deduplicates completed rescues and preserves unknown victim counts', () => {
    const completed = [{ id: 1, rescue_status: 'Completed', rescued_at: at }, { id: 2, rescue_status: 'Completed', rescued_at: at }];
    const p = captainReportData(data({ alerts: [alert(1, { victim_count: 4, rescues: completed }), alert(2, { victim_count: null, rescues: completed }), alert(3, { status: 'Resolved', victim_count: 9 }), alert(4, { victim_count: 6, rescues: [{ id: 3, rescue_status: 'In progress', rescued_at: at }] }), alert(5, { victim_count: 8, rescues: [{ id: 4, rescue_status: 'Completed', rescued_at: 'invalid' }] })] }));
    equal(p.metrics.peopleAssisted, 4); equal(p.metrics.unknownVictimIncidents, 1); equal(p.metrics.completedRescueIncidents, 2);
  });
  test('Captain completion dates rely on decisions and reviewed timestamps across all history', () => {
    const reviewed = (id, extra) => ({ id, resident: { barangay_id: 1 }, review_status: 'Approved', reviewed_at: at, ...extra });
    const p = captainReportData(data({ verifications: [reviewed(1), reviewed(2, { review_status: 'Rejected' }), reviewed(3, { review_status: 'Pending' }), reviewed(4, { reviewed_at: 'invalid' }), reviewed(5, { reviewed_at: '2026-09-02T12:00:00+08:00' })] }));
    equal(p.metrics.completedVerifications, 2); equal(p.metrics.approvedVerifications, 1); equal(p.metrics.rejectedVerifications, 1);
  });
  test('Captain feedback current total never fabricates historical resolution dates', () => {
    const feedback = [{ id: 1, barangay_id: 1, status: 'Resolved' }, { id: 2, barangay_id: 1, status: 'Pending' }];
    let p = captainReportData(data({ feedback })); equal(p.metrics.resolvedFeedback, 1); equal(p.metrics.feedbackResolvedThisMonth, null); equal(p.metrics.recordedFeedbackResolutions, 0);
    p = captainReportData(data({ feedback, activity_logs: [{ id: 1, barangay_id: 1, entity: 'feedback', record_id: 1, action: 'Resolved', at, actor_id: 7 }] })); equal(p.metrics.recordedFeedbackResolutions, 1); equal(p.metrics.feedbackResolvedThisMonth, 1);
    p = captainReportData(data({ feedback: [...feedback, { id: 3, barangay_id: 1, status: 'Resolved' }], activity_logs: [{ id: 1, barangay_id: 1, entity: 'feedback', record_id: 1, action: 'Resolved', at }] })); equal(p.metrics.feedbackResolvedThisMonth, null);
  });
  test('Captain recorded resolution history survives a later feedback status change', () => {
    const p = captainReportData(data({ feedback: [{ id: 1, barangay_id: 1, status: 'Assigned' }], activity_logs: [{ id: 1, barangay_id: 1, entity: 'feedback', record_id: 1, action: 'Feedback resolved', at }] }));
    equal(p.metrics.resolvedFeedback, 0); equal(p.metrics.feedbackResolvedThisMonth, 1); equal(p.metrics.recordedFeedbackResolutions, 1);
  });
  test('Captain feedback audit parsing cannot treat an unresolved action as a resolution', () => {
    const p = captainReportData(data({ activity_logs: [{ id: 1, barangay_id: 1, entity: 'feedback', record_id: 1, action: 'Feedback unresolved', at }] }));
    equal(p.metrics.recordedFeedbackResolutions, 0); equal(p.metrics.feedbackResolvedThisMonth, 0);
  });
  test('Captain comparison handles zero baselines without infinite percentage changes', () => {
    const p = captainReportData(data({ alerts: [alert(1)] })); equal(p.metrics.incidentChange, null); equal(p.metrics.incidentComparison, 'New this month');
    equal(captainReportData(data({})).metrics.incidentComparison, 'No incidents in either month');
  });
  test('Captain categories use all six supported disaster types with real counts', () => {
    const p = captainReportData(data({ alerts: [alert(1), alert(2, { alert_type: 'Fire' }), alert(3, { alert_type: 'Medical' })] }));
    equal(p.categories.map(r => r.type), ['Fire', 'Flood', 'Typhoon/Storm', 'Landslide', 'Earthquake', 'Other']); equal(p.categories.map(r => r.count), [1, 1, 0, 0, 0, 0]); equal(p.metrics.uncategorizedIncidents, 1);
  });
  test('Captain activity preserves known actor evidence and rejects invented timestamps', () => {
    const p = captainReportData(data({ alerts: [alert(1, { status: 'Resolved', resolved_at: null })], activity_logs: [{ id: 8, barangay_id: 1, actor_id: 7, actor_name: 'Roberto Aquino', actor_role: 'captain', action: 'Added personnel', entity: 'personnel', record_id: 10, at, summary: 'Appointed rescuer', href: 'captain-personnel.html?id=10' }, { id: 9, barangay_id: 1, at: 'invalid' }] }));
    equal(p.activity.length, 2); equal(p.activity[0].actor, 'Roberto Aquino'); equal(p.activity[0].href, 'captain-personnel.html?id=10'); equal(p.activity[1].actor, 'Not recorded'); ok(!p.activity.some(r => r.title === 'Incident resolved'));
  });
  test('Captain activity represents a real verification approval once using authoritative audit evidence', async () => {
    const f = fixture(); await f.login(f.authA, 'roberto.aquino');
    await f.apiA.verification.review(2, { decision: 'Approved' });
    const snapshot = await f.apiA.reports.snapshot(), p = captainReportData(snapshot);
    const events = p.activity.filter(row => row.entity === 'verification' && row.record_id === 2 && row.title === 'Verification approved');
    equal(events.length, 1); equal(events[0].source, 'audit'); equal(events[0].actor_id, 7); equal(events[0].actor_role, 'captain');
    const recorded = snapshot.activity_logs.find(row => row.entity === 'verification' && row.record_id === 2 && row.action === 'Verification approved');
    equal(events[0].id, `audit-${recorded.id}`); equal(events[0].actor, recorded.actor_name); equal(events[0].summary, recorded.summary); equal(events[0].href, recorded.href);
  });
  test('Captain activity merges equivalent source actions and audits without dropping separate logs or edits', () => {
    const eventAt = '2026-10-24T12:00:00+08:00', sameInstant = '2026-10-24T04:00:00Z';
    const audit = (id, entity, action, record_id, actor_id, extra = {}) => ({ id, barangay_id: 1, entity, action, record_id, actor_id, actor_name: 'Recorded actor', actor_role: 'captain', at: eventAt, ...extra });
    const audits = [audit(1, 'alert', 'Alert submitted', 1, 4), audit(2, 'alert', 'Alert acknowledged', 1, 7), audit(3, 'alert', 'Alert resolved', 1, 7), audit(4, 'verification', 'Verification submitted', 11, 5), audit(5, 'verification', 'Verification approved', 11, 7), audit(6, 'announcement', 'Announcement published', 21, 7), audit(7, 'feedback', 'Feedback submitted', 31, 4), audit(8, 'announcement', 'Announcement edited', 21, 7, { summary: 'First edit' }), audit(9, 'announcement', 'Announcement edited', 21, 7, { summary: 'Second edit' }), audit(10, 'alert', 'Alert details updated', 1, 7), audit(11, 'verification', 'Verification approved', 12, 7), audit(12, 'announcement', 'Announcement published', 21, 7, { at: '2026-10-24T12:01:00+08:00' })];
    const snapshot = data({ alerts: [alert(1, { created_at: sameInstant, acknowledged_at: sameInstant, acknowledged_by: 7, resolved_at: sameInstant, resident_id: 4, responses: [1, 2].map(id => ({ id, responder_id: 2, response_type: 'Assessment', response_status: 'Completed', responded_at: sameInstant })), rescues: [1, 2].map(id => ({ id, rescuer_id: 3, rescue_status: 'Completed', rescued_at: sameInstant })) })], verifications: [{ id: 11, user_id: 5, resident: { barangay_id: 1 }, submitted_at: sameInstant, reviewed_by: 7, reviewed_at: sameInstant, review_status: 'Approved' }], announcements: [{ id: 21, barangay_id: 1, posted_by: 7, created_at: sameInstant }], feedback: [{ id: 31, barangay_id: 1, resident_id: 4, created_at: sameInstant }], activity_logs: audits });
    const before = JSON.stringify(snapshot), p = captainReportData(snapshot);
    equal(p.activity.filter(row => row.source === 'record').map(row => row.id).sort(), ['rescue-1-1', 'rescue-1-2', 'response-1-1', 'response-1-2']);
    equal(p.activity.filter(row => row.source === 'audit').length, audits.length);
    equal(p.activity.filter(row => row.title === 'Announcement edited').map(row => row.summary).sort(), ['First edit', 'Second edit']);
    equal(p.performance.responder[0].completedResponses, 2); equal(p.performance.rescuer[0].completedRescues, 2); equal(JSON.stringify(snapshot), before);
  });
  test('Captain personnel source history only merges with its matching action and actor', () => {
    const history = [{ action: 'Added', by: 7, at }, { action: 'Reassigned', by: 7, at }, { action: 'Appointed', by: 8, at }];
    const p = captainReportData(data({ personnel: { records: [{ user_id: 10, barangay_id: 1, full_name: 'Personnel', role: 'responder', history }] }, activity_logs: [{ id: 1, barangay_id: 1, entity: 'personnel', action: 'Reassigned', record_id: 10, actor_id: 7, at }, { id: 2, barangay_id: 1, entity: 'personnel', action: 'Appointed', record_id: 10, actor_id: 7, at }] }));
    equal(p.activity.filter(row => row.source === 'record').map(row => row.title).sort(), ['Added personnel role', 'Appointed personnel role']); equal(p.activity.filter(row => row.source === 'audit').length, 2);
  });
  test('Captain audit matching is one to one for repeated personnel history at the same instant', () => {
    const p = captainReportData(data({ personnel: { records: [{ user_id: 10, barangay_id: 1, role: 'responder', history: [{ action: 'Appointed', by: 7, at, notes: 'First appointment' }, { action: 'Appointed', by: 7, at, notes: 'Separate appointment' }] }] }, activity_logs: [{ id: 1, barangay_id: 1, entity: 'personnel', action: 'Appointed', record_id: 10, actor_id: 7, at }] }));
    equal(p.activity.length, 2); equal(p.activity.filter(row => row.source === 'record').length, 1); equal(p.activity.filter(row => row.source === 'audit').length, 1);
  });
  test('Captain role performance uses distinct source-backed metrics and prior staff history', () => {
    const users = [{ id: 1, barangay_id: 1, full_name: 'Secretary', is_secretary: true }, { id: 2, barangay_id: 1, full_name: 'Responder', is_responder: true }, { id: 3, barangay_id: 1, full_name: 'Rescuer', is_rescuer: true }];
    const p = captainReportData(data({ users, alerts: [alert(1, { victim_count: 2, responses: [{ id: 1, responder_id: 2, response_status: 'Completed', responded_at: at }], rescues: [{ id: 1, rescuer_id: 3, rescue_status: 'Completed', rescued_at: at }] })], verifications: [{ id: 1, resident: { barangay_id: 1 }, reviewed_by: 1, reviewed_at: at, review_status: 'Rejected' }], announcements: [{ id: 1, barangay_id: 1, posted_by: 1, created_at: at }] }));
    equal(p.performance.secretary[0].reviewed, 1); equal(p.performance.secretary[0].announcements, 1); equal(p.performance.responder[0].completedResponses, 1); equal(p.performance.rescuer[0].completedRescues, 1); equal(p.performance.rescuer[0].peopleAssisted, 2); ok(!Object.hasOwn(p.performance.secretary[0], 'rating'));
  });
  test('Captain performance preserves previous role membership without mislabeling it active', () => {
    const p = captainReportData(data({ personnel: { records: [{ user_id: 8, barangay_id: 1, full_name: 'Reassigned personnel', role: 'responder', status: 'Active', history: [{ action: 'Reassigned', from_role: 'secretary', to_role: 'responder', by: 7, by_name: 'Captain', at }] }] } }));
    equal(p.performance.secretary[0].status, 'Historical'); equal(p.performance.responder[0].status, 'Active'); equal(p.activity[0].actor, 'Captain'); equal(p.activity[0].at, at);
  });
  test('Captain reviews and publications do not fabricate Secretary personnel membership', () => {
    const p = captainReportData(data({ users: [{ id: 7, barangay_id: 1, full_name: 'Captain', is_captain: true }], verifications: [{ id: 1, resident: { barangay_id: 1 }, reviewed_by: 7, reviewed_at: at, review_status: 'Approved' }], announcements: [{ id: 1, barangay_id: 1, posted_by: 7, created_at: at }], activity_logs: [{ id: 1, barangay_id: 1, actor_id: 7, actor_name: 'Captain', actor_role: 'captain', entity: 'verification', record_id: 1, action: 'Verification approved', at }] }));
    equal(p.performance.secretary, []); equal(p.activity.find(row => row.id === 'audit-1').actor_role, 'captain'); ok(!p.activity.some(row => row.id === 'reviewed-1')); equal(p.metrics.completedVerifications, 1);
  });
  test('Captain all reports search type status sorting and pagination work together', () => {
    const rows = [alert(1, { location_label: 'River', status: 'Resolved' }), alert(2, { location_label: 'River', status: 'Resolved' }), alert(3, { location_label: 'Hill', alert_type: 'Fire' })];
    const p = reportPage(rows, { q: 'river', type: 'Flood', status: 'Resolved', sort: 'oldest', page: 99, size: 1 }); equal(p.total, 2); equal(p.page, 2); equal(p.rows.map(r => r.id), [2]);
    equal(reportPage(rows, { q: 'missing' }).rows, []);
  });
  test('Captain CSV escapes formula injection, quotes, commas and line breaks', () => {
    const csv = reportsCSV([alert(1, { location_label: '=HYPERLINK("evil")', description: 'One, two\nthree', incident_name: '+SUM(1)' })]);
    ok(csv.includes("'=HYPERLINK")); ok(csv.includes("'+SUM(1)")); ok(csv.includes('One, two\nthree')); ok(!csv.includes('undefined'));
  });
}
