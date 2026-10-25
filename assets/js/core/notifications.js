import { roleOf, sameBarangay } from './permissions.js';
import { Icons } from './icons.js';
import { announcementStatus } from './announcements.js';

// Only canonical application routes identify a notification's protected source.
export function notificationSource(db, row) {
  const link = String(row.link || '');
  let match;
  if (['alert_new', 'alert_status'].includes(row.kind) && (match = /^(official|resident)-alert\.html\?id=([1-9]\d*)$/.exec(link))) return { type: 'alert', audience: match[1], record: db.emergency_alerts.find(a => a.id === Number(match[2])) };
  if (row.kind === 'verification') {
    if ((match = /^official-verification\.html\?id=([1-9]\d*)$/.exec(link))) return { type: 'verification', audience: 'official', record: db.verify_residency.find(v => v.id === Number(match[1])) };
    if (link === 'resident-verification.html') return { type: 'verification', audience: 'resident', record: db.users.find(u => u.id === row.user_id) };
  }
  if (row.kind === 'feedback_update' && (match = /^(official|resident)-feedback\.html\?(?:type=(?:complaint|suggestion|general)&)?id=([1-9]\d*)$/.exec(link))) return { type: 'feedback', audience: match[1], record: db.community_feedback.find(f => f.id === Number(match[2])) };
  if (row.kind === 'announcement' && (match = /^(resident|official)-announcements\.html\?id=([1-9]\d*)$/.exec(link))) return { type: 'announcement', audience: match[1], record: db.announcements.find(a => a.id === Number(match[2])) };
  return null;
}
export function canAccessNotification(db, user, row, at) {
  if (!user || row.user_id !== user.id) return false;
  const source = notificationSource(db, row), role = roleOf(user), record = source?.record;
  if (!record) return false;
  if (source.type === 'verification') {
    const resident = source.audience === 'resident' ? record : db.users.find(u => u.id === record.user_id);
    return sameBarangay(user, resident) && (source.audience === 'resident' ? role === 'resident' && resident.id === user.id : ['secretary', 'captain'].includes(role));
  }
  if (!sameBarangay(user, record)) return false;
  if (source.audience === 'resident') return role === 'resident' && (source.type === 'announcement' ? announcementStatus(record, at) === 'Active' : record.resident_id === user.id);
  if (['secretary', 'captain'].includes(role)) return true;
  return source.type === 'alert' && row.kind === 'alert_status' && (role === 'responder' ? record.assigned_responder_id === user.id : role === 'rescuer' && record.assigned_rescuer_id === user.id);
}
export function notificationPresentation(db, row) {
  const source = notificationSource(db, row), r = source?.record;
  if (!r) return { title: row.text || 'Notification', description: '', icon: 'bell' };
  if (source.type === 'alert') {
    const resident = db.users.find(u => u.id === r.resident_id), status = row.event_status || /\b(Rescue in progress|Acknowledged|Responding|Resolved)\b/i.exec(row.text || '')?.[1];
    const assignment = /response is requested/i.test(row.text || '') ? 'New assignment' : /requires extraction and transport/i.test(row.text || '') ? 'Rescue assistance requested' : null;
    return { title: row.kind === 'alert_new' ? `New ${r.alert_type} alert · A-${r.id}` : assignment ? `${assignment} · A-${r.id}` : status ? `${status} · A-${r.id}` : row.text, description: `${source.audience === 'official' && resident ? `${resident.full_name} · ` : ''}${r.location_label}${r.victim_count == null ? ' · Victims not confirmed' : ` · ${r.victim_count} ${r.victim_count === 1 ? 'victim' : 'victims'}`}`, icon: Icons.disaster(r.alert_type) };
  }
  if (source.type === 'verification') {
    const resident = source.audience === 'resident' ? r : db.users.find(u => u.id === r.user_id), household = db.households.find(h => h.id === resident?.household_id);
    return { title: source.audience === 'official' ? 'Verification submitted for review' : row.text, description: `${resident?.full_name || 'Resident'}${household?.address ? ` · ${household.address}` : ''}`, icon: 'shield-check' };
  }
  if (source.type === 'announcement') return { title: 'Announcement published', description: r.title, icon: 'cloud-rain' };
  return { title: row.text, description: r.type === 'general' ? r.comment : r.description, icon: 'message-square' };
}
export function notificationProjection(db, row) {
  const presentation = notificationPresentation(db, row);
  const source = notificationSource(db, row);
  return { ...row, is_read: notificationIsRead(row), title: row.title || presentation.title, description: row.description ?? presentation.description, icon: row.icon || presentation.icon, source_expires_at: source?.type === 'announcement' && source.audience === 'resident' ? source.record?.expires_at ?? null : null };
}
export const notificationIsRead = row => row.is_read === true || Boolean(row.read_at);
