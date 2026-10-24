import { canReadAlert, roleOf } from '../core/permissions.js';

const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export async function alertWorkspace(api, user) {
  const [alerts, barangays] = await Promise.all([api.alerts.list(), api.barangays.list()]);
  return { alerts, area: barangays.find(b => b.id === user.barangay_id)?.name || '' };
}

export function alertsPage(alerts, user, { q = '', status = '', alert_type = '', sort = 'newest', page = 1, size = 10 } = {}) {
  const query = String(q).trim().toLowerCase(), secretary = roleOf(user) === 'secretary';
  const matching = alerts.filter(a => canReadAlert(user, a) && (!status || a.status === status) && (!alert_type || a.alert_type === alert_type)
    && (!query || [`A-${a.id}`, a.alert_type, a.incident_name, a.location_label, a.description, secretary ? a.resident?.full_name : ''].some(v => String(v || '').toLowerCase().includes(query))))
    .sort((a, b) => {
      const x = instant(a.created_at), y = instant(b.created_at);
      if (x === null || y === null) return x === y ? b.id - a.id : x === null ? 1 : -1;
      return (sort === 'oldest' ? x - y : y - x) || b.id - a.id;
    });
  const count = Math.max(1, Math.floor(Number(size)) || 10), pages = Math.max(1, Math.ceil(matching.length / count));
  const current = Math.min(pages, Math.max(1, Math.floor(Number(page)) || 1));
  return { rows: matching.slice((current - 1) * count, current * count), total: matching.length, page: current, pages };
}

export function incidentAssignment(alert, user) {
  const role = roleOf(user), secretary = role === 'secretary';
  const person = secretary ? alert.assigned_rescuer || alert.assigned_responder : role === 'rescuer' ? alert.assigned_rescuer : alert.assigned_responder;
  const personRole = secretary ? alert.assigned_rescuer ? 'Rescuer' : 'Responder' : 'You';
  // These are the assignment instants recorded by acknowledge/logResponse in the existing workflow.
  const assigned = role === 'rescuer' ? (alert.responses || []).map(r => r.responded_at).filter(at => instant(at) !== null).sort((a, b) => instant(a) - instant(b))[0] : alert.acknowledged_at;
  const at = secretary ? alert.created_at : assigned;
  return { person: person ? `${person.full_name} (${personRole})` : 'Unassigned', timeLabel: secretary ? 'Reported at:' : 'Assigned at:', at: instant(at) === null ? null : at };
}
