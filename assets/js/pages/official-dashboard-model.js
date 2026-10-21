import { ALERT_STATUSES } from '../core/alertMachine.js';
import { announcementPublishedAt, announcementStatus } from '../core/announcements.js';
import { reviewable } from './official-verification-model.js';

const stamp = value => Date.parse(value);
const time = value => Number.isFinite(stamp(value)) ? stamp(value) : 0;
const newest = field => (a, b) => time(b[field]) - time(a[field]) || Number(b.id) - Number(a.id);
const unique = rows => [...new Map(rows.map(row => [row.id, row])).values()];
const located = row => [row.map_x, row.map_y].every(value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100);
const day = value => Number.isFinite(stamp(value)) ? new Date(stamp(value) + 8 * 3600000).toISOString().slice(0, 10) : null;

// All inputs are existing joined API records. This projection never changes them.
export function secretaryDashboard(data = {}, { barangayId = 1, at } = {}) {
  const now = stamp(at), today = day(at), scoped = row => Number(row.barangay_id) === Number(barangayId);
  const alerts = unique((data.alerts || []).filter(scoped));
  const activeStatuses = new Set(ALERT_STATUSES.filter(status => status !== 'Resolved'));
  const activeAlerts = alerts.filter(row => activeStatuses.has(row.status)).sort(newest('created_at'));
  const verifications = [...new Map((data.verifications || []).filter(row => scoped(row.resident || {})).sort(newest('submitted_at')).map(row => [row.user_id, row]).reverse()).values()].sort(newest('submitted_at'));
  const pendingVerifications = verifications.filter(row => reviewable(row, at));
  const feedback = unique((data.feedback || []).filter(scoped));
  const openFeedback = feedback.filter(row => ['complaint', 'suggestion'].includes(row.type) && ['Pending', 'Assigned'].includes(row.status));
  const announcements = unique((data.announcements || []).filter(scoped));
  const published = announcements.filter(row => row.is_published !== false && announcementStatus(row, at) !== 'Unpublished' && Number.isFinite(stamp(announcementPublishedAt(row))) && stamp(announcementPublishedAt(row)) <= now);
  const publishedToday = published.filter(row => today && day(announcementPublishedAt(row)) === today);
  const categories = new Map();
  for (const row of publishedToday) { const label = String(row.category || '').trim() || 'Update'; categories.set(label, (categories.get(label) || 0) + 1); }
  const recentAnnouncements = announcements.filter(row => announcementStatus(row, at) === 'Active').sort((a, b) => time(announcementPublishedAt(b)) - time(announcementPublishedAt(a)) || Number(b.id) - Number(a.id)).slice(0, 3);
  const mapAvailable = Number(barangayId) === 1;
  const mappedAlerts = mapAvailable ? activeAlerts.filter(located) : [];
  const facilities = mapAvailable ? unique((data.facilities || []).filter(row => (row.barangay_id === null || scoped(row)) && ['Hospital', 'EvacuationCenter'].includes(row.type) && located(row))) : [];
  const priority = activeAlerts[0] || null;
  const markers = [
    ...mappedAlerts.map(row => ({ id: `alert-${row.id}`, kind: 'alert', status: row.status, x: Number(row.map_x), y: Number(row.map_y), label: `A-${row.id} · ${row.location_label || 'Location not provided'}`, selected: row.id === priority?.id, record: row })),
    ...facilities.map(row => ({ id: `facility-${row.id}`, kind: row.type === 'Hospital' ? 'hospital' : 'evacuation', x: Number(row.map_x), y: Number(row.map_y), label: row.name, record: row })),
  ];
  const events = [];
  const add = (key, kind, title, detail, eventAt, href) => { if (Number.isFinite(stamp(eventAt)) && stamp(eventAt) <= now) events.push({ key, kind, title, detail, at: eventAt, href }); };
  for (const row of alerts) add(`alert-${row.id}-received`, 'alert', `${row.alert_type} alert received`, `A-${row.id} · ${row.location_label || 'Location not provided'}${row.victim_count == null ? '' : ` · ${row.victim_count} ${row.victim_count === 1 ? 'victim' : 'victims'}`}`, row.created_at, `official-alert.html?id=${row.id}`);
  for (const row of verifications) {
    const detail = `${row.resident?.full_name || 'Resident'} · ${row.household?.address || 'Address not provided'}`, href = `official-verification.html?id=${row.id}`;
    add(`verification-${row.id}-submitted`, 'verification', 'Verification submitted', detail, row.submitted_at, href);
    if (['Approved', 'Rejected'].includes(row.review_status)) add(`verification-${row.id}-reviewed`, 'verification', `Verification ${row.review_status.toLowerCase()}`, detail, row.reviewed_at, href);
  }
  for (const row of published) add(`announcement-${row.id}-published`, 'announcement', 'Announcement published', row.title, announcementPublishedAt(row), `official-announcements.html?id=${row.id}`);
  for (const row of feedback) if (['complaint', 'suggestion', 'general'].includes(row.type)) add(`feedback-${row.id}-submitted`, 'feedback', `${row.type === 'general' ? 'Feedback' : row.type[0].toUpperCase() + row.type.slice(1)} submitted`, `${row.resident?.full_name || 'Resident'} · ${row.type === 'general' ? row.comment : row.description}`, row.created_at, `official-feedback.html?type=${row.type}&id=${row.id}`);
  const activity = [...new Map(events.map(event => [event.key, event])).values()].sort((a, b) => time(b.at) - time(a.at) || a.key.localeCompare(b.key));
  return {
    activeAlerts, priority, pendingVerifications, recentAnnouncements, markers, activity, mapAvailable,
    unmappedAlerts: activeAlerts.length - mappedAlerts.length, mappedFacilities: facilities.length,
    metrics: { active: activeAlerts.length, pending: activeAlerts.filter(row => row.status === 'Pending').length, inProgress: activeAlerts.filter(row => row.status !== 'Pending').length, verifications: pendingVerifications.length, feedback: openFeedback.length, complaints: openFeedback.filter(row => row.type === 'complaint').length, suggestions: openFeedback.filter(row => row.type === 'suggestion').length, announcementsToday: publishedToday.length, categories: [...categories].map(([label, count]) => ({ label, count })) },
  };
}
