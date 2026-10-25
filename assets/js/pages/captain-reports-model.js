import { ALERT_TYPES } from '../core/alertMachine.js';
import { announcementPublishedAt } from '../core/announcements.js';

const stamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.test(value)) return NaN;
  const calendar = value.slice(0, 10), check = Date.parse(`${calendar}T00:00:00Z`);
  return Number.isFinite(check) && new Date(check).toISOString().slice(0, 10) === calendar ? Date.parse(value) : NaN;
};
const day = value => Number.isFinite(stamp(value)) ? new Date(stamp(value) + 8 * 3600000).toISOString().slice(0, 10) : null;
const month = value => day(value)?.slice(0, 7) || null;
const unique = rows => [...new Map(rows.map(row => [String(row.id ?? row.user_id), row])).values()];
const mean = rows => rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
const byDate = (a, b) => (stamp(b.created_at) || 0) - (stamp(a.created_at) || 0) || Number(b.id) - Number(a.id);
const knownCount = value => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0;
const isResolution = action => /(?:^|[\s._-])resolve(?:d)?(?:$|[\s._-])/i.test(String(action));
const previous = period => { if (!period) return null; const [year, m] = period.split('-').map(Number); return new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7); };
const change = (current, before) => before ? (current - before) / before * 100 : null;
const roleName = role => ({ secretary: 'Secretary', responder: 'Responder', rescuer: 'Rescuer', captain: 'Captain', resident: 'Resident', tanod: 'Tanod' })[role] || 'Not recorded';
// Explicit source/audit aliases from core/activity.js. Individual response/rescue
// logs have their own IDs and are distinct from the alert status audit they cause.
const activityActions = {
  alert: { 'incident reported': 'submitted', 'alert submitted': 'submitted', 'incident acknowledged': 'acknowledged', 'alert acknowledged': 'acknowledged', 'incident resolved': 'resolved', 'alert resolved': 'resolved' },
  verification: { 'verification submitted': 'submitted', 'verification pending': 'submitted', 'verification approved': 'approved', 'verification rejected': 'rejected' },
  announcement: { 'announcement published': 'published' },
  feedback: { 'feedback received': 'submitted', 'feedback submitted': 'submitted' },
  personnel: { 'added personnel role': 'added', added: 'added', 'appointed personnel role': 'appointed', appointed: 'appointed', 'reassigned personnel role': 'reassigned', reassigned: 'reassigned', 'removed personnel role': 'removed', removed: 'removed', 'updated personnel role': 'updated', 'personnel updated': 'updated' },
};
const activityKey = (entity, action, recordId, at) => {
  const normalized = String(action || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases = Object.hasOwn(activityActions, entity) ? activityActions[entity] : null, canonical = aliases && Object.hasOwn(aliases, normalized) ? aliases[normalized] : null;
  return canonical && recordId != null && Number.isFinite(stamp(at)) ? JSON.stringify([entity, canonical, String(recordId), stamp(at)]) : null;
};
// Shared strict date validation for labels as well as analytics (Date.parse rolls Feb 30).
export const reportTimestamp = stamp;

/**
 * Pure Captain analytics projection; never mutates the joined API snapshot.
 * `period` is a Manila YYYY-MM month (defaults to snapshot.at). Future events,
 * invalid timestamps and all records outside barangayId are excluded from metrics.
 * metrics.incidents/averageResponseMinutes use reports created in the month;
 * completedVerifications and completedRescueIncidents use recorded event dates.
 * resolvedFeedback is a CURRENT total; feedbackResolvedThisMonth stays null while
 * any resolved record has no resolution timestamp. Audit totals are partial history.
 * trend is six Manila months; categories contains only the six canonical disasters.
 * activity pairs equivalent source/audit evidence once, retaining authoritative
 * audit actors and roles. Separate logs/edits and unmatched source history remain.
 * performance.{secretary,responder,rescuer} includes prior staff with recorded work.
 */
export function captainReportData(snapshot = {}, options = {}) {
  const at = options.at ?? snapshot.at, now = stamp(at), barangayId = options.barangayId ?? snapshot.barangay_id;
  const scoped = row => barangayId !== null && barangayId !== undefined && Number.isFinite(Number(barangayId)) && Number(row?.barangay_id) === Number(barangayId);
  const happened = value => Number.isFinite(stamp(value)) && Number.isFinite(now) && stamp(value) <= now;
  const requested = options.period;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested || '') ? requested : month(at), previousPeriod = previous(period);
  const inPeriod = (value, selected = period) => happened(value) && month(value) === selected;
  const alerts = unique((snapshot.alerts || []).filter(scoped)).sort(byDate);
  const feedback = unique((snapshot.feedback || []).filter(scoped));
  const verifications = unique((snapshot.verifications || []).filter(row => scoped(row.resident || row)));
  const announcements = unique((snapshot.announcements || []).filter(scoped));
  const users = unique((snapshot.users || []).filter(scoped));
  const personnel = (snapshot.personnel?.records || []).filter(scoped);
  const audit = unique((snapshot.activity_logs || []).filter(row => scoped(row) && happened(row.at)));
  const user = id => users.find(row => String(row.id) === String(id));
  const person = (id, joined) => joined?.full_name || user(id)?.full_name || null;
  const recordedRole = (entity, recordId, actorId, eventAt) => audit.find(row => row.entity === entity && String(row.record_id) === String(recordId) && String(row.actor_id) === String(actorId) && row.at === eventAt)?.actor_role || null;
  const incidents = alerts.filter(row => inPeriod(row.created_at)), previousIncidents = alerts.filter(row => inPeriod(row.created_at, previousPeriod));
  const firstResponse = row => {
    if (!happened(row.created_at)) return null;
    const response = (row.responses || []).filter(r => happened(r.responded_at) && stamp(r.responded_at) >= stamp(row.created_at)).sort((a, b) => stamp(a.responded_at) - stamp(b.responded_at))[0];
    return response ? (stamp(response.responded_at) - stamp(row.created_at)) / 60000 : null;
  };
  const responseTimes = incidents.map(firstResponse).filter(value => value !== null);
  const completedIn = (row, selected) => (row.rescues || []).some(r => r.rescue_status === 'Completed' && inPeriod(r.rescued_at, selected));
  const completedRescues = alerts.filter(row => completedIn(row, period));
  const peopleAssisted = completedRescues.filter(row => knownCount(row.victim_count)).reduce((sum, row) => sum + Number(row.victim_count), 0);
  const reviewed = verifications.filter(row => ['Approved', 'Rejected'].includes(row.review_status) && inPeriod(row.reviewed_at));
  const resolvedFeedback = feedback.filter(row => row.status === 'Resolved');
  const feedbackAudit = audit.filter(row => /feedback/.test(String(row.entity)) && isResolution(row.action) && inPeriod(row.at));
  const feedbackResolution = row => happened(row.resolved_at) ? row.resolved_at : audit.filter(a => /feedback/.test(String(a.entity)) && String(a.record_id) === String(row.id) && isResolution(a.action)).sort((a, b) => stamp(b.at) - stamp(a.at))[0]?.at;
  const missingFeedbackDates = resolvedFeedback.some(row => !happened(feedbackResolution(row)));
  const monthlyFeedback = new Set([...feedback.filter(row => inPeriod(row.resolved_at)).map(row => String(row.id)), ...feedbackAudit.map(row => String(row.record_id))]).size;
  const activity = [];
  const auditsByEvent = new Map(), pairedAudits = new Set();
  for (const row of audit) {
    const key = activityKey(row.entity, row.action, row.record_id, row.at);
    if (key) { if (!auditsByEvent.has(key)) auditsByEvent.set(key, []); auditsByEvent.get(key).push(row); }
  }
  const add = (id, entity, title, eventAt, actorId, actor, role, recordId, summary, href, source = 'record') => {
    if (!happened(eventAt)) return;
    if (source === 'record') {
      const key = activityKey(entity, title, recordId, eventAt);
      const match = auditsByEvent.get(key)?.find(row => !pairedAudits.has(row) && (actorId == null || String(row.actor_id) === String(actorId)));
      // Consume one audit per source so repeated same-time actions are preserved.
      // Audits themselves are always retained, including separate same-time edits.
      if (match) { pairedAudits.add(match); return; }
    }
    activity.push({ id, entity, title, at: eventAt, actor_id: actorId ?? null, actor: actor || 'Not recorded', actor_role: role || null, roleLabel: roleName(role), record_id: recordId, summary: summary || '', href, source });
  };
  for (const row of alerts) {
    const href = `captain-reports.html?view=all&id=${encodeURIComponent(row.id)}`, detail = `A-${row.id} · ${row.alert_type} · ${row.location_label || 'Location not provided'}`;
    add(`alert-${row.id}`, 'alert', 'Incident reported', row.created_at, row.resident_id, person(row.resident_id, row.resident), row.resident_id ? 'resident' : null, row.id, detail, href);
    add(`ack-${row.id}`, 'alert', 'Incident acknowledged', row.acknowledged_at, row.acknowledged_by, person(row.acknowledged_by), null, row.id, detail, href);
    add(`resolved-${row.id}`, 'alert', 'Incident resolved', row.resolved_at, null, null, null, row.id, detail, href);
    for (const response of unique(row.responses || [])) add(`response-${row.id}-${response.id}`, 'response', `${response.response_type || 'Response'} · ${response.response_status || 'Status not recorded'}`, response.responded_at, response.responder_id, person(response.responder_id, response.responder), 'responder', row.id, response.notes || detail, href);
    for (const rescue of unique(row.rescues || [])) add(`rescue-${row.id}-${rescue.id}`, 'rescue', `Rescue · ${rescue.rescue_status || 'Status not recorded'}`, rescue.rescued_at, rescue.rescuer_id, person(rescue.rescuer_id, rescue.rescuer), 'rescuer', row.id, rescue.notes || detail, href);
  }
  for (const row of verifications) {
    const href = `official-verification.html?id=${encodeURIComponent(row.id)}`, detail = row.resident?.full_name || 'Resident name not recorded';
    add(`verification-${row.id}`, 'verification', 'Verification submitted', row.submitted_at, row.user_id, detail, 'resident', row.id, row.document_type, href);
    if (['Approved', 'Rejected'].includes(row.review_status)) add(`reviewed-${row.id}`, 'verification', `Verification ${row.review_status.toLowerCase()}`, row.reviewed_at, row.reviewed_by, person(row.reviewed_by), recordedRole('verification', row.id, row.reviewed_by, row.reviewed_at), row.id, detail, href);
  }
  for (const row of announcements) add(`announcement-${row.id}`, 'announcement', 'Announcement published', announcementPublishedAt(row), row.posted_by, person(row.posted_by, row.author), recordedRole('announcement', row.id, row.posted_by, announcementPublishedAt(row)), row.id, row.title, `official-announcements.html?id=${encodeURIComponent(row.id)}`);
  for (const row of feedback) add(`feedback-${row.id}`, 'feedback', 'Feedback received', row.created_at, row.resident_id, person(row.resident_id, row.resident), 'resident', row.id, row.description || row.comment, `official-feedback.html?type=${encodeURIComponent(row.type || 'complaint')}&id=${encodeURIComponent(row.id)}`);
  for (const row of personnel) for (const [index, h] of (row.history || []).entries()) {
    const id = row.user_id ?? row.id;
    add(`personnel-${id}-${index}`, 'personnel', `${h.action || 'Updated'} personnel role`, h.at, h.by, h.by_name || person(h.by), h.actor_role || null, id, `${row.full_name || 'Personnel'}${h.from_role ? ` · From ${roleName(h.from_role)}` : ''}${h.to_role ? ` · To ${roleName(h.to_role)}` : ''}${h.notes ? ` · ${h.notes}` : ''}`, `captain-personnel.html?id=${encodeURIComponent(id)}`);
  }
  for (const row of audit) add(`audit-${row.id}`, row.entity || 'activity', row.action || 'Activity recorded', row.at, row.actor_id, row.actor_name || person(row.actor_id), row.actor_role, row.record_id, row.summary, row.href || '', 'audit');
  activity.sort((a, b) => stamp(b.at) - stamp(a.at) || a.id.localeCompare(b.id));
  const performance = {};
  for (const role of ['secretary', 'responder', 'rescuer']) {
    const ids = new Set(users.filter(row => row[`is_${role}`]).map(row => String(row.id)));
    for (const row of personnel) if (row.role === role || (row.history || []).some(h => h.role === role || h.to_role === role || h.from_role === role)) ids.add(String(row.user_id ?? row.id));
    // Administrative work is shared with Captains; it cannot prove a Secretary role.
    for (const row of audit) if (row.actor_role === role && row.actor_id != null && inPeriod(row.at)) ids.add(String(row.actor_id));
    for (const row of alerts) for (const log of role === 'responder' ? row.responses || [] : role === 'rescuer' ? row.rescues || [] : []) if (log[`${role}_id`] != null && inPeriod(log[role === 'responder' ? 'responded_at' : 'rescued_at'])) ids.add(String(log[`${role}_id`]));
    performance[role] = [...ids].map(id => {
      const record = personnel.find(row => String(row.user_id ?? row.id) === id), u = user(id);
      const ownResponses = alerts.flatMap(row => unique(row.responses || []).filter(r => String(r.responder_id) === id && r.response_status === 'Completed' && inPeriod(r.responded_at)).map(r => ({ ...r, alert: row })));
      const ownRescues = alerts.flatMap(row => unique(row.rescues || []).filter(r => String(r.rescuer_id) === id && r.rescue_status === 'Completed' && inPeriod(r.rescued_at)).map(r => ({ ...r, alert: row })));
      const assisted = unique(ownRescues.map(r => r.alert));
      const ownReviews = reviewed.filter(row => String(row.reviewed_by) === id && [null, role].includes(recordedRole('verification', row.id, row.reviewed_by, row.reviewed_at)));
      const ownPublications = announcements.filter(row => String(row.posted_by) === id && inPeriod(announcementPublishedAt(row)) && [null, role].includes(recordedRole('announcement', row.id, row.posted_by, announcementPublishedAt(row))));
      return { id: Number(id), full_name: record?.full_name || u?.full_name || `Personnel #${id}`, role, status: record ? record.role === role ? record.status : 'Historical' : u?.[`is_${role}`] ? 'Active' : 'Historical', reviewed: ownReviews.length, announcements: ownPublications.length, completedResponses: ownResponses.length, completedRescues: ownRescues.length, peopleAssisted: assisted.filter(row => knownCount(row.victim_count)).reduce((sum, row) => sum + Number(row.victim_count), 0), unknownVictimIncidents: assisted.filter(row => !knownCount(row.victim_count)).length, activity: activity.filter(row => String(row.actor_id) === id && inPeriod(row.at)) };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }
  const trendMonths = []; let cursor = period; for (let i = 0; i < 6 && cursor; i++) { trendMonths.unshift(cursor); cursor = previous(cursor); }
  const trend = trendMonths.map(selected => {
    const reports = alerts.filter(row => inPeriod(row.created_at, selected)), times = reports.map(firstResponse).filter(value => value !== null), rescues = alerts.filter(row => completedIn(row, selected));
    return { period: selected, incidents: reports.length, resolved: alerts.filter(row => row.status === 'Resolved' && inPeriod(row.resolved_at, selected)).length, averageResponseMinutes: mean(times), responseSampleSize: times.length, peopleAssisted: rescues.filter(row => knownCount(row.victim_count)).reduce((sum, row) => sum + Number(row.victim_count), 0), unknownVictimIncidents: rescues.filter(row => !knownCount(row.victim_count)).length };
  });
  const categories = ALERT_TYPES.map(type => ({ type, count: incidents.filter(row => row.alert_type === type).length, previous: previousIncidents.filter(row => row.alert_type === type).length }));
  const metrics = { incidents: incidents.length, previousIncidents: previousIncidents.length, incidentChange: change(incidents.length, previousIncidents.length), incidentComparison: previousIncidents.length ? `${Math.abs(change(incidents.length, previousIncidents.length)).toFixed(0)}% ${incidents.length >= previousIncidents.length ? 'more' : 'fewer'} than last month` : incidents.length ? 'New this month' : 'No incidents in either month', averageResponseMinutes: mean(responseTimes), responseSampleSize: responseTimes.length, responseExcluded: incidents.length - responseTimes.length, peopleAssisted, unknownVictimIncidents: completedRescues.filter(row => !knownCount(row.victim_count)).length, completedRescueIncidents: completedRescues.length, completedVerifications: reviewed.length, approvedVerifications: reviewed.filter(row => row.review_status === 'Approved').length, rejectedVerifications: reviewed.filter(row => row.review_status === 'Rejected').length, resolvedFeedback: resolvedFeedback.length, feedbackResolvedThisMonth: missingFeedbackDates ? null : monthlyFeedback, recordedFeedbackResolutions: new Set(feedbackAudit.map(row => String(row.record_id))).size, invalidIncidentDates: alerts.filter(row => !Number.isFinite(stamp(row.created_at))).length, uncategorizedIncidents: incidents.filter(row => !ALERT_TYPES.includes(row.alert_type)).length, active: alerts.filter(row => row.status !== 'Resolved').length, resolved: incidents.filter(row => row.status === 'Resolved').length };
  return { at, period, previousPeriod, barangayId, alerts, reports: alerts, incidents, feedback, verifications, announcements, metrics, trend, categories, activity, performance, operations: { completedRescues, responseTimes } };
}

export function reportPage(rows = [], { q = '', type = '', status = '', sort = 'newest', page = 1, size = 10 } = {}) {
  const query = String(q).trim().toLowerCase(), limit = Math.max(1, Math.min(100, Math.trunc(Number(size)) || 10));
  const filtered = rows.filter(row => (!type || row.alert_type === type) && (!status || row.status === status) && (!query || [row.id, `A-${row.id}`, row.alert_type, row.incident_name, row.location_label, row.description, row.resident?.full_name].some(value => String(value || '').toLowerCase().includes(query))));
  filtered.sort(sort === 'type' ? (a, b) => String(a.alert_type).localeCompare(String(b.alert_type)) || byDate(a, b) : sort === 'oldest' ? (a, b) => -byDate(a, b) : byDate);
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / limit)), selected = Math.max(1, Math.min(pages, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((selected - 1) * limit, selected * limit), total, pages, page: selected, size: limit, filtered };
}

// Prefix dangerous spreadsheet formula starters before RFC4180 quoting.
export function reportsCSV(rows = []) {
  const cell = value => { let s = String(value ?? ''); if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  const values = [['Report ID', 'Disaster type', 'Incident name', 'Location', 'Status', 'Reported at', 'Resolved at', 'Victims (blank = unknown)', 'Description'], ...rows.map(row => [`A-${row.id}`, row.alert_type, row.incident_name, row.location_label, row.status, row.created_at, row.resolved_at, row.victim_count, row.description])];
  return '\uFEFF' + values.map(row => row.map(cell).join(',')).join('\r\n');
}
