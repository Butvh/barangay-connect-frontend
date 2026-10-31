// Prospective audit records. Legacy timestamps/actors are never invented.
const definitions = [
  ['emergency_alerts', 'alert', 'official-alert.html'],
  ['verify_residency', 'verification', 'official-verification.html'],
  ['announcements', 'announcement', 'official-announcements.html'],
  ['community_feedback', 'feedback', 'official-feedback.html'],
  ['personnel_records', 'personnel', 'captain-personnel.html'],
];
export const activitySnapshot = db => Object.fromEntries(definitions.map(([key]) => [key, new Map((db[key] || []).map(r => [r.id ?? r.user_id, JSON.stringify(r)]))]));
export function recordActivity(db, before, user, role, at) {
  const events = [];
  for (const [key, entity, route] of definitions) for (const row of db[key] || []) {
    const id = row.id ?? row.user_id, old = before[key].get(id);
    if (old === JSON.stringify(row)) continue;
    const previous = old ? JSON.parse(old) : null;
    let action, system = false, eventAt = at;
    if (entity === 'alert') action = previous ? previous.status !== row.status ? `Alert ${row.status.toLowerCase()}` : 'Alert details updated' : 'Alert submitted';
    if (entity === 'verification') { action = `Verification ${(row.history?.at(-1)?.action || (previous ? row.review_status : 'Submitted')).toLowerCase()}`; system = row.review_status === 'Expired'; if (system) eventAt = row.deadline_at; }
    if (entity === 'feedback') action = previous ? previous.status !== row.status ? `Feedback ${String(row.status).toLowerCase()}` : 'Feedback updated' : 'Feedback submitted';
    if (entity === 'announcement') { const last = row.history?.at(-1); action = `Announcement ${last?.action?.toLowerCase() || (previous ? 'updated' : 'published')}`; system = last?.action === 'Expired'; if (system) eventAt = last.at; }
    if (entity === 'personnel') action = row.history?.at(-1)?.action || 'Personnel updated';
    const summary = entity === 'alert' ? `A-${row.id} · ${row.alert_type} · ${row.location_label}` : row.title || row.description || (entity === 'personnel' ? db.users.find(u => u.id === row.user_id)?.full_name : '') || action;
    events.push({ barangay_id: user.barangay_id, actor_id: system ? null : user.id, actor_name: system ? 'System' : user.full_name, actor_role: system ? null : role, action, entity, record_id: id, at: eventAt, recorded_at: at, summary, href: `${route}?${entity === 'feedback' ? `type=${row.type}&` : ''}id=${id}` });
  }
  if (events.length) { db.activity_logs ||= []; let next = Math.max(0, ...db.activity_logs.map(r => r.id)) + 1; db.activity_logs.push(...events.map(event => ({ id: next++, ...event }))); }
}
