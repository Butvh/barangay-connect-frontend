import { ApiError, copy } from './config.js';

export const PERSONNEL_ROLES = Object.freeze(['secretary', 'responder', 'rescuer']);
export const PERSONNEL_LIMITS = Object.freeze({ secretary: 3, responder: 6, rescuer: 6 });
const validStatus = ['Active', 'Inactive'];
const roleFromUser = user => PERSONNEL_ROLES.find(role => user[`is_${role}`]) || null;
const same = (a, b) => Number(a) === Number(b);
function captainOf(db, user) {
  if (!user) throw new ApiError('AUTH', 'Sign in to continue.');
  const actor = (db.users || []).find(row => same(row.id, user.id));
  if (!actor?.is_captain || ['Inactive', 'Unassigned'].includes(actor.personnel_status)) throw new ApiError('FORBIDDEN', 'Only the Barangay Captain can manage personnel.');
  return actor;
}
function field(value, key, { required = true, max = 200 } = {}) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new ApiError('VALIDATION', `Check ${key.replaceAll('_', ' ')}.`, { [key]: !result ? 'This field is required.' : `Use ${max} characters or fewer.` });
  return result;
}
function role(value) {
  if (!PERSONNEL_ROLES.includes(value)) throw new ApiError('VALIDATION', 'Choose Secretary, Responder, or Rescuer.', { role: 'Choose an available role.' });
  return value;
}
function status(value = 'Active') {
  if (!validStatus.includes(value)) throw new ApiError('VALIDATION', 'Choose Active or Inactive.', { status: 'Choose Active or Inactive.' });
  return value;
}
function date(value, at, minimum = null) {
  const valid = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const now = Date.parse(at);
  if (!valid || !Number.isFinite(now)) throw new ApiError('VALIDATION', 'Choose a valid effective date.', { effective_date: 'Choose a valid calendar date.' });
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  if (value > today) throw new ApiError('VALIDATION', 'Future appointments are not supported. Choose today or an earlier date.', { effective_date: `Choose ${today} or earlier.` });
  if (minimum && value < minimum.slice(0, 10)) throw new ApiError('VALIDATION', 'The effective date cannot precede the current appointment.', { effective_date: `Choose ${minimum.slice(0, 10)} or later.` });
  return value;
}
function requirements(value = []) {
  if (!Array.isArray(value) || value.length > 10) throw new ApiError('VALIDATION', 'Choose up to 10 PDF, JPG, or PNG files.', { requirements: 'Choose up to 10 files.' });
  return value.map(file => {
    const name = field(file?.name, 'requirements', { max: 200 }), type = file?.type, size = file?.size;
    const types = { 'application/pdf': /\.pdf$/i, 'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i };
    if (!types[type]?.test(name) || !Number.isSafeInteger(size) || size < 1 || size > 5 * 1024 * 1024) throw new ApiError('VALIDATION', 'Requirements must be PDF, JPG, or PNG files up to 5 MB each.', { requirements: 'Use a PDF, JPG, or PNG file no larger than 5 MB.' });
    return { name, type, size };
  });
}
function busyAlerts(db, userId, oldRole) {
  const key = oldRole === 'responder' ? 'assigned_responder_id' : oldRole === 'rescuer' ? 'assigned_rescuer_id' : null;
  return key ? (db.emergency_alerts || []).filter(a => a.status !== 'Resolved' && a[key] != null && same(a[key], userId)).map(a => a.id) : [];
}
function project(db, person) {
  const stored = (db.personnel_records || []).find(r => same(r.user_id ?? r.id, person.id));
  const currentRole = stored ? stored.role : roleFromUser(person);
  const history = (stored?.history || []).map(h => ({ action: h.action, by: h.by ?? null, by_name: h.by_name || db.users.find(u => same(u.id, h.by))?.full_name || null, at: h.at ?? null, effective_date: h.effective_date ?? null, from_role: h.from_role ?? null, to_role: h.to_role ?? null, status: h.status, notes: h.notes || '' }));
  return {
    id: person.id, user_id: person.id, barangay_id: person.barangay_id,
    full_name: person.full_name || '', email: person.email || '', contact_number: stored?.contact_number ?? person.contact_number ?? '',
    address: stored?.address ?? person.address ?? '', emergency_contact: stored?.emergency_contact ?? person.emergency_contact ?? '',
    role: PERSONNEL_ROLES.includes(currentRole) ? currentRole : null, source: stored?.source || (person.is_tanod ? 'tanod' : 'external'),
    status: currentRole ? stored?.status || person.personnel_status || 'Active' : 'Unassigned',
    appointed_at: stored?.appointed_at ?? null, requirements: (stored?.requirements || []).map(f => ({ name: f.name, type: f.type, size: f.size })),
    notes: stored?.notes || '', history, revision: stored?.revision || 0, created_at: stored?.created_at || person.created_at || null,
    added_externally_at: stored?.added_externally_at || null, legacy: stored?.legacy ?? !stored,
    busy_alert_ids: busyAlerts(db, person.id, currentRole),
  };
}
function managedPeople(db, actor) {
  return db.users.filter(u => same(u.barangay_id, actor.barangay_id) && !u.is_captain && (u.is_tanod || roleFromUser(u) || (db.personnel_records || []).some(r => same(r.user_id ?? r.id, u.id))));
}
/** Read-only public projection; legacy records remain unknown until the Captain records a change. */
export function personnelList(db, user) {
  const actor = captainOf(db, user), people = managedPeople(db, actor), all = people.map(person => project(db, person));
  const records = all.filter(row => row.role || row.history.length || row.source !== 'tanod');
  const tanods = all.filter(row => people.find(u => same(u.id, row.id))?.is_tanod);
  const capacities = Object.fromEntries(PERSONNEL_ROLES.map(key => { const used = all.filter(row => row.role === key).length, limit = PERSONNEL_LIMITS[key]; return [key, { used, limit, available: Math.max(0, limit - used) }]; }));
  const activity = all.flatMap(row => row.history.map(h => ({ ...h, personnel_id: row.id, full_name: row.full_name, source: row.source }))).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  return copy({ records, tanods, capacities, activity });
}
export function personnelGet(db, user, id) {
  const actor = captainOf(db, user), person = db.users.find(u => same(u.id, id));
  if (!person || !Number.isInteger(Number(id))) throw new ApiError('NOT_FOUND', 'Personnel record was not found.');
  if (!same(person.barangay_id, actor.barangay_id)) throw new ApiError('FORBIDDEN', 'This personnel record belongs to another barangay.');
  if (!managedPeople(db, actor).some(u => same(u.id, id))) throw new ApiError('NOT_FOUND', 'This account is not a personnel record.');
  return copy(project(db, person));
}
function available(db, actor, targetRole) {
  if (personnelList(db, actor).capacities[targetRole].available < 1) throw new ApiError('CAPACITY', `All ${PERSONNEL_LIMITS[targetRole]} ${targetRole} positions are occupied. Choose another role or remove an existing assignment first.`, { role: 'This role is at capacity.' });
}
function fresh(row, input) {
  if (input.expected_revision !== undefined && input.expected_revision !== row.revision) throw new ApiError('CONFLICT', 'This personnel record changed. Close this form and review the latest details before trying again.');
}
function notBusy(row) {
  if (row.busy_alert_ids.length) throw new ApiError('BUSY', `${row.full_name} is assigned to unresolved incident${row.busy_alert_ids.length > 1 ? 's' : ''} ${row.busy_alert_ids.map(id => `A-${id}`).join(', ')}. Resolve those incidents before changing this role.`);
}
function recordChange(db, actor, person, before, { action, to_role, effective_date, notes, status: nextStatus }, at) {
  const row = { ...before, role: to_role, status: nextStatus, notes, appointed_at: to_role ? effective_date : before.appointed_at, revision: before.revision + 1 };
  row.history = [...before.history, { action, by: actor.id, by_name: actor.full_name, at, effective_date, from_role: before.role, to_role, status: nextStatus, notes }];
  delete row.busy_alert_ids;
  db.personnel_records ||= [];
  const index = db.personnel_records.findIndex(r => same(r.user_id ?? r.id, person.id));
  if (index < 0) db.personnel_records.push(row); else db.personnel_records[index] = row;
  for (const key of PERSONNEL_ROLES) person[`is_${key}`] = key === to_role;
  person.personnel_status = nextStatus;
  return copy(project(db, person));
}
export function addExternalPersonnel(db, user, input = {}, at) {
  const actor = captainOf(db, user), full_name = field(input.full_name, 'full_name', { max: 100 }), email = field(input.email, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('VALIDATION', 'Enter a valid email address.', { email: 'Enter a valid email address.' });
  if (db.users.some(u => String(u.email || '').trim().toLowerCase() === email)) throw new ApiError('VALIDATION', 'This email is already registered. Use the existing personnel record or a different email.', { email: 'This email is already registered.' });
  const contact_number = field(input.contact_number, 'contact_number', { max: 30 });
  if (!/^[+\d\s().-]{7,30}$/.test(contact_number) || contact_number.replace(/\D/g, '').length < 7) throw new ApiError('VALIDATION', 'Enter a valid contact number.', { contact_number: 'Enter at least seven digits.' });
  const details = { full_name, email, contact_number, address: field(input.address, 'address', { max: 300 }), emergency_contact: field(input.emergency_contact, 'emergency_contact', { max: 200 }), requirements: requirements(input.requirements) };
  const to_role = role(input.role), effective_date = date(input.effective_date ?? input.appointment_date, at), notes = field(input.notes, 'notes', { required: false, max: 500 }), nextStatus = status(input.status);
  available(db, actor, to_role);
  const id = Math.max(0, ...db.users.map(u => Number(u.id) || 0)) + 1;
  const person = { id, full_name, email, contact_number, barangay_id: actor.barangay_id, household_id: null, password: 'demo1234', is_resident: false, is_secretary: false, is_responder: false, is_rescuer: false, is_tanod: false, is_captain: false, created_at: at };
  const before = { ...project(db, person), ...details, role: null, source: 'external', legacy: false, added_externally_at: at, created_at: at };
  db.users.push(person);
  return recordChange(db, actor, person, before, { action: 'Added', to_role, effective_date, notes, status: nextStatus }, at);
}
export function appointPersonnel(db, user, id, input = {}, at) {
  const actor = captainOf(db, user), before = personnelGet(db, actor, id), person = db.users.find(u => same(u.id, id)); fresh(before, input);
  if (!person.is_tanod || before.role) throw new ApiError('INVALID_STATE', 'Only an unassigned Tanod can be appointed. Use Reassign for an existing role.');
  const to_role = role(input.role), effective_date = date(input.effective_date, at, before.history.at(-1)?.effective_date), notes = field(input.notes, 'notes', { required: false, max: 500 });
  available(db, actor, to_role);
  return recordChange(db, actor, person, before, { action: 'Appointed', to_role, effective_date, notes, status: 'Active' }, at);
}
export function reassignPersonnel(db, user, id, input = {}, at) {
  const actor = captainOf(db, user), before = personnelGet(db, actor, id), person = db.users.find(u => same(u.id, id)); fresh(before, input);
  if (!before.role) throw new ApiError('INVALID_STATE', 'This person has no assigned role.');
  const to_role = role(input.role);
  if (to_role === before.role) throw new ApiError('VALIDATION', 'Choose a different role.', { role: 'This person already holds this role.' });
  const effective_date = date(input.effective_date, at, before.appointed_at), notes = field(input.notes, 'notes', { required: false, max: 500 });
  notBusy(before); available(db, actor, to_role);
  return recordChange(db, actor, person, before, { action: 'Reassigned', to_role, effective_date, notes, status: before.status }, at);
}
export function removePersonnel(db, user, id, input = {}, at) {
  const actor = captainOf(db, user), before = personnelGet(db, actor, id), person = db.users.find(u => same(u.id, id)); fresh(before, input);
  if (!before.role) throw new ApiError('INVALID_STATE', 'This person has no assigned role.');
  const effective_date = date(input.effective_date, at, before.appointed_at), notes = field(input.notes, 'notes', { required: false, max: 500 });
  notBusy(before);
  return recordChange(db, actor, person, before, { action: 'Removed', to_role: null, effective_date, notes, status: 'Unassigned' }, at);
}
