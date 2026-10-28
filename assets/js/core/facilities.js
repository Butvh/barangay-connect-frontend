import { ApiError, copy } from './config.js';
import { assertRole, roleOf } from './permissions.js';

export const FACILITY_TYPES = ['EvacuationCenter', 'Hospital'];
export const facilityStatus = row => row?.status == null ? 'Active' : row.status === 'Active' ? 'Active' : 'Inactive';
export const facilityActive = row => Boolean(row) && facilityStatus(row) === 'Active';
export const facilityLocated = row => Boolean(row) && ['map_x', 'map_y'].every(key => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '' && typeof row[key] !== 'boolean' && Number.isFinite(Number(row[key])) && Number(row[key]) >= 0 && Number(row[key]) <= 100);
// The original shared referral (ID 2) belongs to the Sampaguita demo directory.
// Preserve its public scope; never infer ownership for other shared records.
export const facilityOwner = row => row.managed_by_barangay_id ?? row.barangay_id ?? (row.id === 2 ? 1 : null);
export const canManageFacility = (user, row) => ['secretary', 'captain'].includes(roleOf(user)) && facilityOwner(row) === user.barangay_id;
export const facilityVisible = (user, row) => row.barangay_id === null || row.barangay_id === user.barangay_id;
export function facilitySnapshot(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, type: row.type, address: row.address, capacity: row.capacity ?? null, contact: row.contact || '', notes: row.notes || '', barangay_id: row.barangay_id, status: facilityStatus(row), map_x: row.map_x ?? null, map_y: row.map_y ?? null };
}
export function facilityProjection(row, user) {
  const result = { ...facilitySnapshot(row), revision: row.revision || 0, can_manage: canManageFacility(user, row) };
  if (result.can_manage) Object.assign(result, { managed_by_barangay_id: facilityOwner(row), created_at: row.created_at || null, created_by: row.created_by || null, updated_at: row.updated_at || null, updated_by: row.updated_by || null, history: copy(row.history || []) });
  return result;
}
const invalid = (field, message) => { throw new ApiError('VALIDATION', message, { [field]: message }); };
const fields = ['name', 'type', 'address', 'capacity', 'contact', 'status', 'notes', 'map_x', 'map_y'];
function checkInput(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('name', 'Enter valid facility information.');
  if (Object.keys(input).some(key => !allowed.includes(key))) invalid('name', 'Only facility information can be changed.');
}
function text(value, field, max, required = false) {
  if (value != null && typeof value !== 'string') invalid(field, 'Enter text for this field.');
  const result = (value || '').trim();
  if ((required && !result) || result.length > max) invalid(field, !result ? 'This field is required.' : `Use ${max} characters or fewer.`);
  return result;
}
function details(input, prior = {}) {
  const next = { ...prior, ...input };
  const name = text(next.name, 'name', 160, true), address = text(next.address, 'address', 300, true);
  if (!FACILITY_TYPES.includes(next.type)) invalid('type', 'Choose Evacuation Center or Hospital.');
  const status = next.status ?? facilityStatus(prior);
  if (!['Active', 'Inactive'].includes(status)) invalid('status', 'Choose Active or Inactive.');
  let capacity = next.capacity;
  if (capacity === '' || capacity === undefined || capacity === null) capacity = null;
  else if (typeof capacity === 'boolean' || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 999999) invalid('capacity', 'Use a whole number from 1 to 999999.');
  else capacity = Number(capacity);
  if (next.type === 'EvacuationCenter' && capacity === null) invalid('capacity', 'Enter the evacuation center capacity.');
  if (Object.hasOwn(input, 'map_x') !== Object.hasOwn(input, 'map_y')) invalid('map_x', 'Choose a complete location on the map.');
  const blank = value => value === undefined || value === null || value === '';
  let map_x = next.map_x, map_y = next.map_y;
  if (blank(map_x) && blank(map_y)) { map_x = null; map_y = null; }
  else {
    if (blank(map_x) || blank(map_y) || !facilityLocated({ map_x, map_y })) invalid('map_x', 'Choose a location inside the barangay map.');
    map_x = Number(map_x); map_y = Number(map_y);
  }
  return { name, type: next.type, address, capacity, contact: text(next.contact, 'contact', 50), notes: text(next.notes, 'notes', 300), status, map_x, map_y };
}
function managed(db, user, id, input) {
  assertRole(user, ['secretary', 'captain']);
  const row = db.facilities.find(row => row.id === Number(id));
  if (!row) throw new ApiError('NOT_FOUND', 'Facility was not found.');
  if (!canManageFacility(user, row)) throw new ApiError('FORBIDDEN', 'Only the managing barangay can change this facility.');
  if (!Number.isInteger(input.expected_revision) || input.expected_revision < 0) invalid('expected_revision', 'Reload the facility before saving.');
  if (input.expected_revision !== (row.revision || 0)) throw new ApiError('CONFLICT', 'This facility changed. Close this form and review its latest information before saving.');
  return row;
}
function history(row, action, user, at) {
  row.history = [...(row.history || []), { action, by: user.id, at, facility: facilitySnapshot(row) }];
  row.updated_by = user.id; row.updated_at = at;
}
function retainDestinations(db, row) {
  for (const rescue of db.rescues.filter(rescue => rescue.facility_id === row.id && !rescue.facility_snapshot)) rescue.facility_snapshot = facilitySnapshot(row);
}
export function createFacility(db, user, input, at) {
  assertRole(user, ['secretary', 'captain']); checkInput(input, fields);
  const data = details(input);
  if (data.map_x !== null && user.barangay_id !== 1) invalid('map_x', 'Map coverage is not available for this barangay.');
  const row = { ...data, id: Math.max(0, ...db.facilities.map(row => row.id)) + 1, barangay_id: user.barangay_id, managed_by_barangay_id: user.barangay_id, revision: 0, created_by: user.id, created_at: at };
  history(row, 'Created', user, at); db.facilities.push(row); return facilityProjection(row, user);
}
export function updateFacility(db, user, id, input, at) {
  assertRole(user, ['secretary', 'captain']); checkInput(input, [...fields, 'expected_revision']);
  const row = managed(db, user, id, input), data = details(input, row);
  if (data.map_x !== null && facilityOwner(row) !== 1) invalid('map_x', 'Map coverage is not available for this barangay.');
  retainDestinations(db, row); const previousStatus = facilityStatus(row);
  Object.assign(row, data, { managed_by_barangay_id: facilityOwner(row), revision: (row.revision || 0) + 1 });
  history(row, previousStatus !== data.status ? data.status === 'Active' ? 'Reactivated' : 'Deactivated' : 'Edited', user, at);
  return facilityProjection(row, user);
}
export function setFacilityStatus(db, user, id, input, at) {
  assertRole(user, ['secretary', 'captain']); checkInput(input, ['status', 'expected_revision']);
  const row = managed(db, user, id, input);
  if (!['Active', 'Inactive'].includes(input.status)) invalid('status', 'Choose Active or Inactive.');
  if (facilityStatus(row) === input.status) return facilityProjection(row, user);
  retainDestinations(db, row); row.managed_by_barangay_id = facilityOwner(row); row.status = input.status; row.revision = (row.revision || 0) + 1;
  history(row, input.status === 'Active' ? 'Reactivated' : 'Deactivated', user, at); return facilityProjection(row, user);
}
