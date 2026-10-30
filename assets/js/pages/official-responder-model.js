// Read-only projection of the existing contract. No priority, travel or backup records are inferred.
const localDay = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    : null;
};

export function responderDashboardData(alerts, user, now) {
  const assigned = alerts.filter(a => a.barangay_id === user.barangay_id && a.assigned_responder_id === user.id);
  const active = assigned.filter(a => a.active_responder_assignment ?? a.status !== 'Resolved');
  const today = localDay(now);
  const responses = assigned.flatMap(alert => (alert.responses || [])
    .filter(r => r.responder_id === user.id).map(r => ({ ...r, alert })));
  const assignedToday = assigned.filter(a => today && localDay(a.responder_assigned_at ?? a.acknowledged_at) === today);
  const finished = a => a.status === 'Resolved' || responses.some(r => r.alert.id === a.id && r.response_status === 'Completed');
  const activity = assigned.flatMap(a => [
    a.created_at && { key: `reported-${a.id}`, alert: a, title: 'Incident reported', actor: a.resident?.full_name || 'Resident', at: a.created_at },
    (a.responder_assigned_at || a.acknowledged_at) && { key: `assigned-${a.id}`, alert: a, title: 'Assigned to incident', actor: a.responder_assigned_by_name || 'Assignment author not recorded', at: a.responder_assigned_at || a.acknowledged_at },
    ...responses.filter(r => r.alert.id === a.id).map(r => ({ key: `response-${r.id}`, alert: a, title: `${r.response_type} · ${r.response_status}`, actor: `${user.full_name} · Responder`, at: r.responded_at })),
  ].filter(item => item && Number.isFinite(Date.parse(item.at))))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
  return {
    assigned, active, current: active[0] || null, responses, activity,
    assignedToday: assignedToday.length,
    inProgressToday: assignedToday.filter(a => !finished(a)).length,
    finishedToday: assignedToday.filter(finished).length,
    completedResponses: responses.filter(r => r.response_status === 'Completed' && today && localDay(r.responded_at) === today),
    completedToday: responses.filter(r => r.response_status === 'Completed' && today && localDay(r.responded_at) === today).length,
    recent: assigned.slice(0, 3),
  };
}
