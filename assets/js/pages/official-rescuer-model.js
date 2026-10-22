// Read-only view of assigned rescue records; travel/pickup/drop-off are not inferred.
const localDay = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    : null;
};
// logResponse creates this record and assigns the rescuer in the same transaction.
const assignedAt = alert => (alert.responses || []).map(r => r.responded_at)
  .filter(at => Number.isFinite(Date.parse(at))).sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;

export function rescuerDashboardData(alerts, user, now) {
  const assigned = alerts.filter(a => a.barangay_id === user.barangay_id && a.assigned_rescuer_id === user.id);
  const active = assigned.filter(a => a.status !== 'Resolved'), today = localDay(now);
  const records = assigned.flatMap(alert => (alert.rescues || [])
    .filter(r => r.rescuer_id === user.id).map(r => ({ ...r, alert })));
  const assignedToday = assigned.filter(a => today && localDay(assignedAt(a)) === today);
  const finished = a => a.status === 'Resolved' || records.some(r => r.alert.id === a.id && r.rescue_status === 'Completed');
  const completedRecords = records.filter(r => r.rescue_status === 'Completed' && today && localDay(r.rescued_at) === today);
  const activity = assigned.flatMap(a => [
    a.created_at && { key: `reported-${a.id}`, alert: a, title: 'Incident reported', actor: a.resident?.full_name || 'Resident', at: a.created_at },
    assignedAt(a) && { key: `assigned-${a.id}`, alert: a, title: 'Assigned to rescue', actor: 'System · Barangay Connect', at: assignedAt(a) },
    ...records.filter(r => r.alert.id === a.id).map(r => ({ key: `rescue-${r.id}`, alert: a, title: `Rescue · ${r.rescue_status}`, actor: `${user.full_name} · Rescuer`, at: r.rescued_at })),
  ].filter(row => row && Number.isFinite(Date.parse(row.at))))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
  return {
    assigned, active, current: active[0] || null, currentAssignedAt: active[0] ? assignedAt(active[0]) : null, records, completedRecords, activity,
    assignedToday: assignedToday.length,
    inProgressToday: assignedToday.filter(a => !finished(a)).length,
    finishedToday: assignedToday.filter(finished).length,
    completedToday: completedRecords.length,
    recent: assigned.slice(0, 3),
  };
}
