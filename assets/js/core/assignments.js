import { Config, ApiError } from './config.js';
import { assertRole, assertBarangay, roleOf } from './permissions.js';

export const ASSIGNMENT_ROLES = Object.freeze(['responder', 'rescuer']);
const pointer = role => `assigned_${role}_id`;
const closed = alert => ['Resolved', 'Cancelled', 'Closed'].includes(alert.status);
const nextId = rows => Math.max(0, ...rows.map(r => Number(r.id) || 0)) + 1;
const lastLog = rows => rows.slice().sort((a, b) => Date.parse(a.responded_at || a.rescued_at) - Date.parse(b.responded_at || b.rescued_at) || a.id - b.id).at(-1);
const logsFor = (db, alert, role) => (role === 'responder' ? db.alert_responses : db.rescues).filter(r => r.alert_id === alert.id && r[`${role}_id`] === alert[pointer(role)] && Number.isFinite(Date.parse(r.responded_at || r.rescued_at)));
const assertAssignmentRole = role => { if (!ASSIGNMENT_ROLES.includes(role)) throw new ApiError('VALIDATION', 'Choose Responder or Rescuer.', { role: 'Choose an operational role.' }); };
export const assignmentLimit = role => Config.assignment_limits[role];
export function assignmentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('VALIDATION', 'Provide assignment details as an object.');
  return input;
}

/** Legacy assignments are read without resetting saved data or inventing provenance. */
export function assignmentRecords(db) {
  const rows = (db.alert_assignments || []).map(row => ({ ...row }));
  for (const alert of db.emergency_alerts || []) for (const role of ASSIGNMENT_ROLES) {
    const userId = alert[pointer(role)];
    if (!userId || rows.some(r => r.alert_id === alert.id && r.role === role)) continue;
    const logs = logsFor(db, alert, role), latest = lastLog(logs), completed = latest?.[role === 'responder' ? 'response_status' : 'rescue_status'] === 'Completed';
    const person = db.users.find(u => u.id === userId);
    rows.push({ id: `legacy-${alert.id}-${role}`, alert_id: alert.id, barangay_id: alert.barangay_id, role, user_id: userId, personnel_name: person?.full_name || `Personnel #${userId}`, assigned_by: null, assigned_by_name: null, assigned_at: role === 'responder' ? alert.acknowledged_at || null : alert.rescuer_assigned_at || null, status: completed ? 'completed' : closed(alert) ? 'closed' : 'active', ended_at: completed ? latest.responded_at || latest.rescued_at : closed(alert) ? alert.resolved_at || null : null, ended_by: completed ? userId : null, end_reason: completed ? 'Completed log' : closed(alert) ? 'Incident closed' : null, legacy: true });
  }
  return rows;
}
export function assignmentWorkload(db, userId, role) {
  return assignmentRecords(db).filter(r => r.user_id === Number(userId) && r.role === role && r.status === 'active' && !closed(db.emergency_alerts.find(a => a.id === r.alert_id) || {})).length;
}
export function activeAssignment(db, alert, role) {
  return assignmentRecords(db).find(r => r.alert_id === alert.id && r.role === role && r.user_id === alert[pointer(role)] && r.status === 'active') || null;
}
export function assignmentFlags(db, alert) {
  const assignments = assignmentRecords(db).filter(r => r.alert_id === alert.id), latest = role => assignments.filter(r => r.role === role && r.user_id === alert[pointer(role)]).at(-1);
  const responder = latest('responder'), rescuer = latest('rescuer');
  const response = lastLog(logsFor(db, alert, 'responder').filter(r => r.assignment_id === responder?.id || responder?.legacy && !r.assignment_id));
  // Only an explicit current assessment drives new dispatch; ongoing legacy rescue is retained.
  const required = typeof response?.rescue_required === 'boolean' ? response.rescue_required : rescuer ? true : response?.response_type === 'Evacuation assistance' ? true : null;
  const activeResponder = !closed(alert) && responder?.status === 'active', activeRescuer = !closed(alert) && rescuer?.status === 'active';
  return { assignments, active_responder_assignment: Boolean(activeResponder), active_rescuer_assignment: Boolean(activeRescuer), responder_assignment_status: responder?.status || null, rescuer_assignment_status: rescuer?.status || null, responder_assigned_at: responder?.assigned_at || null, rescuer_assigned_at: rescuer?.assigned_at || null, responder_assigned_by_name: responder?.assigned_by_name || null, rescuer_assigned_by_name: rescuer?.assigned_by_name || null, rescue_required: required, response_completed: responder?.status === 'completed', can_assign_responder: !closed(alert) && alert.status !== 'Pending' && !alert.assigned_responder_id, can_assign_rescuer: !closed(alert) && ['Responding', 'Rescue in progress'].includes(alert.status) && (required === true || required === null && assignments.some(r => r.role === 'rescuer')) && !activeRescuer && !['completed', 'closed'].includes(rescuer?.status) };
}
export function assignmentOptions(db, user, id, role) {
  assertRole(user, ['secretary', 'captain']); assertAssignmentRole(role);
  const alert = db.emergency_alerts.find(a => a.id === Number(id)); if (!alert) throw new ApiError('NOT_FOUND', 'Alert was not found.'); assertBarangay(user, alert);
  const current = activeAssignment(db, alert, role), limit = assignmentLimit(role);
  const personnel = db.users.filter(u => u.barangay_id === user.barangay_id && roleOf(u) === role).map(person => {
    const workload = assignmentWorkload(db, person.id, role), assigned = current?.user_id === person.id;
    return { id: person.id, full_name: person.full_name, role, workload, limit, assigned, at_capacity: workload >= limit, available: workload < limit && !assigned };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { alert_id: alert.id, alert_revision: alert.assignment_revision || 0, role, limit, personnel, current_assignment: current, ...assignmentFlags(db, alert) };
}
export function checkAssignmentRevision(alert, input) {
  assignmentInput(input);
  if (!Number.isInteger(input.expected_revision)) throw new ApiError('VALIDATION', 'Refresh the assignment options before continuing.', { expected_revision: 'A current revision is required.' });
  if (input.expected_revision !== (alert.assignment_revision || 0)) throw new ApiError('CONFLICT', 'This incident changed. Review the refreshed assignment options.');
}
function materialize(db, alert) {
  db.alert_assignments ||= [];
  for (const legacy of assignmentRecords(db).filter(row => row.alert_id === alert.id && row.legacy && typeof row.id === 'string')) db.alert_assignments.push({ ...legacy, id: nextId(db.alert_assignments) });
}
export function assignmentForWrite(db, alert, role) { materialize(db, alert); return activeAssignment(db, alert, role); }
export function assignmentReason(value, field = 'reason') {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason || reason.length > 1000) throw new ApiError('VALIDATION', 'Provide a reason using 1–1000 characters.', { [field]: 'A reason is required (maximum 1000 characters).' });
  return reason;
}
export function assignPersonnel(db, user, alert, role, input, at, reassign = false) {
  assertRole(user, reassign ? ['captain'] : ['secretary', 'captain']); assertBarangay(user, alert); assertAssignmentRole(role);
  if (closed(alert)) throw new ApiError('INVALID_STATE', 'Completed incidents cannot receive assignments.');
  checkAssignmentRevision(alert, input);
  const old = activeAssignment(db, alert, role), flags = assignmentFlags(db, alert);
  if (reassign && !old) throw new ApiError('INVALID_STATE', 'There is no active responsibility to reassign.');
  if (!reassign && old) throw new ApiError('INVALID_STATE', 'This incident already has an active assignment for that role.');
  if (role === 'responder' && !reassign && alert.status !== 'Pending' && !flags.can_assign_responder) throw new ApiError('INVALID_STATE', 'A responder cannot be assigned at this stage.');
  if (role === 'rescuer' && !reassign && !flags.can_assign_rescuer) throw new ApiError('INVALID_STATE', 'Record a rescue-needed responder assessment before assigning a rescuer.');
  const id = Number(input.personnel_id ?? input.responder_id), person = db.users.find(u => u.id === id && u.barangay_id === alert.barangay_id && roleOf(u) === role);
  if (!Number.isSafeInteger(id) || !person) throw new ApiError('VALIDATION', `Choose an active local ${role}.`, { personnel_id: 'This person is not eligible for this role.' });
  if (old?.user_id === id) throw new ApiError('INVALID_STATE', 'This person is already assigned to this incident.');
  const workload = assignmentWorkload(db, id, role), limit = assignmentLimit(role);
  let overrideReason = null;
  if (input.override) {
    assertRole(user, ['captain']);
    if (input.override.confirmed !== true) throw new ApiError('VALIDATION', 'Explicit Captain confirmation is required for an emergency override.');
    overrideReason = assignmentReason(input.override.reason, 'override_reason');
    if (workload < limit) throw new ApiError('VALIDATION', 'This person has capacity. Use an ordinary assignment.');
  } else if (workload >= limit) throw new ApiError('CAPACITY', `This ${role} is at capacity (${workload} of ${limit} assignments). Choose another person or ask the Captain to review the emergency.`);
  const reason = reassign ? assignmentReason(input.reason) : null;
  materialize(db, alert);
  if (reassign) endAssignment(db, alert, role, 'reassigned', user, at, reason);
  const row = { id: nextId(db.alert_assignments), alert_id: alert.id, barangay_id: alert.barangay_id, role, user_id: id, personnel_name: person.full_name, assigned_by: user.id, assigned_by_name: user.full_name, assigned_at: at, status: 'active', ended_at: null, ended_by: null, end_reason: null, override_by: overrideReason ? user.id : null, override_at: overrideReason ? at : null, override_reason: overrideReason, legacy: false };
  db.alert_assignments.push(row); alert[pointer(role)] = id; alert.assignment_revision = (alert.assignment_revision || 0) + 1;
  return row;
}
export function endAssignment(db, alert, role, status, user, at, reason) {
  materialize(db, alert);
  const row = db.alert_assignments.find(r => r.alert_id === alert.id && r.role === role && r.user_id === alert[pointer(role)] && r.status === 'active');
  if (!row) return null;
  Object.assign(row, { status, ended_at: at, ended_by: user.id, end_reason: reason });
  if (status === 'cancelled') alert[pointer(role)] = null;
  return row;
}
export function bumpAssignmentRevision(alert) { alert.assignment_revision = (alert.assignment_revision || 0) + 1; }

export function recordAssignmentActivity(db, alert, assignment, user, at, action, reason = '') {
  db.activity_logs ||= [];
  db.activity_logs.push({ id: nextId(db.activity_logs), barangay_id: alert.barangay_id, actor_id: user.id, actor_name: user.full_name, actor_role: roleOf(user), action, entity: 'alert', record_id: alert.id, assignment_id: assignment.id, personnel_id: assignment.user_id, assignment_role: assignment.role, at, recorded_at: at, summary: `${assignment.personnel_name} · ${assignment.role} · A-${alert.id}${reason ? ` · ${reason}` : ''}`, href: `official-alert.html?id=${alert.id}` });
}
