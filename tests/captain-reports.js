import { captainReportData, reportPage, reportsCSV } from '../assets/js/pages/captain-reports-model.js';
import * as reportModel from '../assets/js/pages/captain-reports-model.js';
import { personnelPanel, reportPanel } from '../assets/js/pages/captain-report-panels.js';
import { activityPageData, activityRows, activityDetails, activityPagination } from '../assets/js/pages/captain-activity.js';
import { personnelPerformanceData, personnelPerformancePage } from '../assets/js/pages/captain-performance.js';

export function registerCaptainReportsTests({ test, equal, ok, fixture }) {
  test('Activity filters combine search, type, responsible user and Manila date range without mutating records', () => {
    const rows = [
      { id: 'a', entity: 'alert', actor_id: 7, actor: 'Captain', title: 'Alert resolved', record_id: 1038, summary: 'Mabini Street', at: '2026-10-01T00:00:00+08:00' },
      { id: 'b', entity: 'alert', actor_id: 1, actor: 'Ana', title: 'Alert acknowledged', record_id: 1038, at: '2026-09-30T23:59:00+08:00' },
      { id: 'c', entity: 'rescue', actor_id: 7, actor: 'Captain', title: 'Rescue completed', record_id: 1038, at: '2026-10-04T09:00:00+08:00' },
    ], before = JSON.stringify(rows), context = { period: '2026-10', at: '2026-10-04T14:20:00+08:00' };
    equal(activityPageData(rows, { q: ' 1038 ', entity: 'alert', actor: '7', range: 'month' }, context).rows.map(r => r.id), ['a']);
    equal(activityPageData(rows, { q: 'mabini', range: 'week' }, context).total, 1);
    equal(activityPageData(rows, { q: 'missing' }, context).total, 0);
    equal(activityPageData(rows, { range: 'month' }, context).rows.map(r => r.id), ['c', 'a']);
    equal(JSON.stringify(rows), before);
  });
  test('Activity sorting and ten-row pagination retain deterministic order and clamp empty or stale pages', () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ id: String(i + 1), at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00+08:00` }));
    const p = activityPageData(rows, { sort: 'oldest', page: 2 });
    equal(p.rows.map(r => r.id), Array.from({ length: 10 }, (_, i) => String(i + 11))); equal(p.total, 23); equal(p.pages, 3);
    equal(activityPageData(rows, { page: 99 }).page, 3); equal(activityPageData([], { page: 2 }).page, 1);
    const html = activityPagination(p); ok(html.includes('Showing 11–20 of 23 activities')); ok(html.includes('data-page="3"')); ok(html.includes('aria-current="page"'));
  });
  test('Activity details distinguish audit evidence from source timestamps and keep safe record navigation', () => {
    const row = { id: 'audit-4', entity: 'alert', title: 'Alert resolved', actor: 'Ana Reyes', roleLabel: 'Secretary', record_id: 1038, at: '2026-10-12T08:33:00+08:00', source: 'audit', summary: 'Recorded <update>', href: 'official-alert.html?id=1038' };
    const html = activityDetails(row, 'A-1038 · Other · Mabini Street');
    for (const value of ['Review audit information and the linked record.', 'Activity information', 'Linked record', 'Event description', 'Ana Reyes', 'Secretary', '#1038', 'Recorded audit event', 'Recorded &lt;update&gt;', 'A-1038 · Other · Mabini Street']) ok(html.includes(value), `missing ${value}`);
    equal((html.match(/href="official-alert.html\?id=1038"/g) || []).length, 2); ok(!html.includes('<update>'));
    const source = activityDetails({ ...row, actor: 'Not recorded', roleLabel: 'Not recorded', source: 'record', summary: '', href: 'javascript:alert(1)' });
    ok(source.includes('Recorded source timestamp')); ok(source.includes('No additional details were recorded.')); ok(!source.includes('Recorded audit event')); ok(!source.includes('<a '));
    ok(!source.includes('data-open-affected')); ok(source.includes('data-done'));
    ok(activityDetails({ ...row, entity: 'constructor' }).includes('Activity #1038'));
  });
  test('Activity rows keep date/time and chevrons without adding category badges or inventing actors', () => {
    const html = activityRows([{ id: 'a', entity: 'rescue', title: 'Rescue · Completed', summary: '<Full note>', actor: 'Not recorded', actor_role: null, at: '2026-10-04T15:19:00+08:00' }]);
    ok(html.includes('Oct 4, 2026')); ok(html.includes('3:19 PM')); ok(html.includes('chevron-right')); ok(html.includes('&lt;Full note&gt;'));
    ok(!html.includes('badge')); ok(html.includes('By Not recorded')); ok(!html.includes('By Captain'));
  });
  test('Report panel keeps the selected incident, actual personnel roles and recorded destination', () => {
    const markup = reportPanel({ id: 1044, alert_type: 'Flood', status: 'Resolved', victim_count: null, assigned_responder: { id: 2, full_name: 'Carlo Mendoza' }, assigned_rescuer: { id: 3, full_name: 'Ramon Bautista' }, responses: [{ response_status: 'Responding' }], rescues: [{ rescue_status: 'Completed', rescued_at: '2026-10-06T15:18:00+08:00', rescuer: { id: 3, full_name: 'Ramon Bautista' }, facility: { name: 'Recorded evacuation center' }, notes: 'Arrived safely.' }] }, []);
    ok(markup.includes('official-alert.html?id=1044')); ok(markup.includes('captain-personnel.html?id=3'));
    ok(markup.includes('Rescuer')); ok(markup.includes('Recorded evacuation center'));
    ok(markup.includes('0 completed response logs; 1 completed rescue log')); ok(markup.includes('Unknown'));
    ok(markup.includes('resolution time not recorded')); ok(markup.includes('data-print')); ok(markup.includes('data-export-report'));
    ok(markup.includes('Oct 6, 2026 · 3:18 PM · Ramon Bautista'), 'Each recorded destination retains rescue time and actor');
    ok(!markup.includes('Typhoon advisory')); ok(!markup.includes('tel:'));
  });
  test('Ongoing report cannot claim a rescue destination or resolved outcome', () => {
    const markup = reportPanel({ id: 9, alert_type: 'Other', status: 'Responding', description: '<script>bad</script>', rescues: [{ rescue_status: 'En route', facility: { name: 'Not reached' } }] }, []);
    ok(markup.includes('Current progress')); ok(markup.includes('Not yet resolved'));
    ok(!markup.includes('is-resolved')); ok(!markup.includes('Not reached')); ok(!markup.includes('<script>'));
    ok(markup.includes('&lt;script&gt;bad&lt;/script&gt;'));
  });
  test('Personnel panel keeps period and detail navigation with no invented achievements', () => {
    const markup = personnelPanel({ id: 2, full_name: '<Ana>', role: 'secretary', status: 'Inactive', reviewed: 0, announcements: 0, activity: [] }, { period: '2026-10', maxPeriod: '2026-10', monthLabel: 'October 2026', barangayName: 'Barangay Sampaguita', activityHref: 'captain-reports.html?view=activity&actor=2' });
    ok(markup.includes('data-person-period')); ok(markup.includes('captain-personnel.html?id=2'));
    ok(markup.includes('No previous-month baseline')); ok(markup.includes('No dated activity recorded'));
    ok(markup.includes('Inactive')); ok(markup.includes('&lt;Ana&gt;')); ok(!markup.includes('Consistent contributor')); ok(!markup.includes('NaN'));
  });
  test('Personnel panel derives role metrics and contribution shares from recorded activity', () => {
    equal(typeof reportModel.performancePanelData, 'function', 'Personnel panel projection is available');
    const activity = [
      { id: '1', entity: 'alert', title: 'Incident acknowledged', at: '2026-10-02T09:00:00+08:00', actor_role: 'secretary' },
      { id: '2', entity: 'verification', title: 'Verification approved', at: '2026-10-01T09:00:00+08:00', actor_role: 'secretary' },
      { id: '3', entity: 'announcement', title: 'Announcement published', at: '2026-10-02T10:00:00+08:00', actor_role: 'secretary' },
    ];
    const row = { role: 'secretary', reviewed: 1, announcements: 1, activity };
    const p = reportModel.performancePanelData(row, { ...row, reviewed: 2, announcements: 0, activity: [] });
    equal(p.metrics.map(r => r.value), [1, 1, 1]);
    equal(p.metrics.map(r => r.change), [-50, null, null]);
    equal(p.total, 3); equal(p.groups.map(r => r.day), ['2026-10-02', '2026-10-01']);
    equal(p.groups[0].rows.map(r => r.id), ['3', '1']);
    equal(p.contributions.reduce((sum, r) => sum + r.count, 0), 3);
    ok(p.contributions.every(r => Math.abs(r.percent - 100 / 3) < 0.001)); equal(activity[0].id, '1');
  });
  test('Personnel panel keeps zero history and operational responsibilities honest', () => {
    equal(typeof reportModel.performancePanelData, 'function');
    const r = reportModel.performancePanelData({ role: 'rescuer', completedRescues: 1, peopleAssisted: 0, unknownVictimIncidents: 1, activity: [] });
    equal(r.metrics.map(m => m.value), [1, 0, 1]); equal(r.total, 0); equal(r.contributions, []);
    ok(r.metrics.every(m => m.change === null));
    const p = reportModel.performancePanelData({ role: 'responder', completedResponses: 1, activity: [{ entity: 'response', record_id: 1042, at: '2026-10-02T01:00:00Z' }, { entity: 'response', record_id: 1042, at: '2026-10-03T01:00:00Z' }, { entity: 'rescue', at: '2026-10-03T01:00:00Z', actor_role: 'rescuer' }] });
    equal(p.metrics.map(m => m.value), [1, 2, 1]); equal(p.total, 2);
  });
  const at = '2026-10-25T12:00:00+08:00';
  const alert = (id, patch = {}) => ({ id, barangay_id: 1, alert_type: 'Flood', status: 'Pending', created_at: '2026-10-03T10:00:00+08:00', responses: [], rescues: [], ...patch });
  const data = patch => ({ barangay_id: 1, at, alerts: [], users: [], ...patch });
  test('Performance subpage counts actual role records and six dated months without inventing history', () => {
    const snapshot = data({ users: [{ id: 2, barangay_id: 1, full_name: 'Carlo', is_responder: true }, { id: 9, barangay_id: 1, full_name: 'No activity', is_responder: true }], alerts: [alert(1, { responses: [
      { id: 1, responder_id: 2, response_status: 'Completed', responded_at: '2026-09-30T16:00:00Z' },
      { id: 2, responder_id: 2, response_status: 'Completed', responded_at: '2026-09-03T09:00:00+08:00' },
      { id: 3, responder_id: 2, response_status: 'Responding', responded_at: at },
      { id: 4, responder_id: 2, response_status: 'Completed', responded_at: 'invalid' },
      { id: 5, responder_id: 2, response_status: 'Completed', responded_at: '2026-10-30T09:00:00+08:00' },
    ] }), alert(2, { barangay_id: 2, responses: [{ id: 6, responder_id: 2, response_status: 'Completed', responded_at: at }] })] });
    const before = JSON.stringify(snapshot), p = personnelPerformanceData(snapshot, { period: '2026-10', role: 'responder', barangayId: 1 });
    equal(p.metrics.map(m => m.value), [2, 1, 1]); equal(p.metrics[1].change, 0);
    equal(p.trend.map(m => m.period), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    equal(p.trend.map(m => m.value), [0, 0, 0, 0, 1, 1]); equal(p.rows.length, 2);
    equal(p.rows.find(r => r.id === 9).completedResponses, 0); equal(JSON.stringify(snapshot), before);
  });
  test('Performance subpage handles year boundaries, empty history and historical personnel', () => {
    const snapshot = data({ at: '2027-01-25T12:00:00+08:00', users: [{ id: 2, barangay_id: 1, is_rescuer: true }], alerts: [alert(1, { responses: [{ id: 1, responder_id: 2, response_status: 'Completed', responded_at: '2027-01-02T12:00:00+08:00' }] })] });
    const p = personnelPerformanceData(snapshot, { period: '2027-01', role: 'responder' });
    equal(p.trend.map(m => m.period), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    equal(p.metrics[1].change, null); equal(p.rows[0].status, 'Historical');
    const empty = personnelPerformanceData(data({}), { role: 'constructor' });
    equal(empty.role, 'responder'); equal(empty.metrics.map(m => m.value), [0, 0, 0]); ok(empty.trend.every(m => m.value === 0));
  });
  test('Performance subpage compares recorded completions against the actual previous month', () => {
    const snapshot = data({ alerts: [alert(1, { responses: [
      { id: 1, responder_id: 2, response_status: 'Completed', responded_at: '2026-09-20T12:00:00+08:00' },
      { id: 2, responder_id: 2, response_status: 'Completed', responded_at: '2026-10-20T12:00:00+08:00' },
      { id: 3, responder_id: 2, response_status: 'Completed', responded_at: '2026-10-21T12:00:00+08:00' },
    ] })] });
    const p = personnelPerformanceData(snapshot, { role: 'responder' }); equal(p.metrics[1].previous, 1); equal(p.metrics[1].change, 100);
    const html = personnelPerformancePage(p); ok(html.includes('↑ 100%')); ok(html.includes('vs. last month (1)'));
    const november = personnelPerformanceData({ ...snapshot, at: '2026-11-25T12:00:00+08:00' }, { period: '2026-11' });
    equal(november.metrics[1].change, -100); ok(personnelPerformancePage(november).includes('↓ 100%'));
  });
  test('Performance trend totals match monthly projections with historical roles and Captain decisions', () => {
    const reviewed_at = '2026-09-20T12:00:00+08:00';
    const snapshot = data({ users: [{ id: 1, barangay_id: 1, is_secretary: true }, { id: 7, barangay_id: 1, is_captain: true }], personnel: { records: [{ user_id: 4, barangay_id: 1, role: 'rescuer', history: [{ from_role: 'secretary' }] }] }, verifications: [
      { id: 1, resident: { barangay_id: 1 }, review_status: 'Approved', reviewed_by: 1, reviewed_at },
      { id: 2, resident: { barangay_id: 1 }, review_status: 'Approved', reviewed_by: 7, reviewed_at },
      { id: 3, resident: { barangay_id: 1 }, review_status: 'Rejected', reviewed_by: 4, reviewed_at },
      { id: 4, resident: { barangay_id: 1 }, review_status: 'Approved', reviewed_by: 99, reviewed_at },
    ], activity_logs: [{ id: 1, barangay_id: 1, entity: 'verification', record_id: 4, action: 'Verification approved', actor_id: 99, actor_role: 'secretary', at: reviewed_at }], alerts: [alert(1, { responses: [{ id: 1, responder_id: 20, response_status: 'Completed', responded_at: reviewed_at }], rescues: [{ id: 1, rescuer_id: 4, rescue_status: 'Completed', rescued_at: at }] })] });
    const projection = captainReportData(snapshot);
    for (const role of ['responder', 'rescuer', 'secretary']) {
      const key = { responder: 'completedResponses', rescuer: 'completedRescues', secretary: 'reviewed' }[role];
      const p = personnelPerformanceData(snapshot, { role }, projection);
      for (const row of p.trend) equal(row.value, captainReportData(snapshot, { period: row.period }).performance[role].reduce((sum, person) => sum + person[key], 0));
    }
    equal(projection.trend.at(-2).reviewed, 3);
  });
  test('Performance subpage retains rescue deduplication and Secretary review/publication metrics', () => {
    const snapshot = data({ users: [{ id: 1, barangay_id: 1, is_secretary: true }, { id: 3, barangay_id: 1, is_rescuer: true }], verifications: [{ id: 1, resident: { barangay_id: 1 }, review_status: 'Approved', reviewed_by: 1, reviewed_at: at }], announcements: [{ id: 1, barangay_id: 1, posted_by: 1, created_at: at }], alerts: [alert(1, { victim_count: 4, rescues: [1, 2].map(id => ({ id, rescuer_id: 3, rescue_status: 'Completed', rescued_at: at })) }), alert(2, { victim_count: null, rescues: [{ id: 3, rescuer_id: 3, rescue_status: 'Completed', rescued_at: at }] })] });
    const rescue = personnelPerformanceData(snapshot, { role: 'rescuer' });
    equal(rescue.metrics.map(m => m.value), [1, 3, 4]); equal(rescue.trend.at(-1).value, 3); ok(rescue.metrics[2].note.includes('1 completed case'));
    const secretary = personnelPerformanceData(snapshot, { role: 'secretary' });
    equal(secretary.metrics.map(m => m.value), [1, 1, 1]); equal(secretary.trend.at(-1).value, 1);
    equal(secretary.counts, { responder: 0, rescuer: 1, secretary: 1 });
  });
  test('Performance subpage rendering escapes names, exposes chart values and preserves detail/tab controls', () => {
    const p = personnelPerformanceData(data({ users: [{ id: 2, barangay_id: 1, full_name: '<Carlo>', is_responder: true }] }), { role: 'responder' });
    const html = personnelPerformancePage(p);
    for (const value of ['data-person="2"', 'data-role="responder"', 'id="reports-role-responder"', 'aria-selected="true"', 'aria-controls="reports-performance-results"', 'aria-labelledby="reports-role-responder"', 'Monthly overview', 'Completed responses trend', 'No previous-month baseline', '&lt;Carlo&gt;', 'Active']) ok(html.includes(value), `missing ${value}`);
    ok(!html.includes('<Carlo>')); equal((html.match(/role="tab"/g) || []).length, 3);
    ok(html.includes('<caption>Completed responses trend</caption>')); ok(html.includes('<td>0</td>'));
    ok(personnelPerformancePage(personnelPerformanceData(data({}), {})).includes('No personnel records are available for this role.'));
  });
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
