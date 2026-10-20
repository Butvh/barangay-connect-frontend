import { ApiError } from './config.js';

export function roleOf(user) {
  if (!user) return null;
  if (user.is_secretary) return 'secretary';
  if (user.is_responder) return 'responder';
  if (user.is_rescuer) return 'rescuer';
  return user.is_resident ? 'resident' : null;
}
export const isOfficial = user => ['is_secretary', 'is_responder', 'is_rescuer', 'is_tanod', 'is_captain'].some(key => Boolean(user?.[key]));
export const sameBarangay = (user, record) => Boolean(user && record && Number(user.barangay_id) === Number(record.barangay_id));
export function requireUser(user) {
  if (!user || !roleOf(user)) throw new ApiError('AUTH', 'Sign in to continue.');
  return user;
}
export function assertRole(user, roles) {
  requireUser(user);
  if (!roles.includes(roleOf(user))) throw new ApiError('FORBIDDEN', 'Your role cannot perform this action.');
}
export function assertBarangay(user, record) {
  requireUser(user);
  if (!sameBarangay(user, record)) throw new ApiError('FORBIDDEN', 'This record belongs to another barangay.');
}
export function canReadAlert(user, alert) {
  return sameBarangay(user, alert) && (roleOf(user) !== 'resident' || alert.resident_id === user.id);
}
export function assertReadAlert(user, alert) {
  requireUser(user);
  if (!canReadAlert(user, alert)) throw new ApiError('FORBIDDEN', 'You cannot view this alert.');
}
export function assertOwner(user, record, field = 'resident_id') {
  requireUser(user);
  if (record[field] !== user.id) throw new ApiError('FORBIDDEN', 'You can only change your own record.');
}
export const Permissions = Object.freeze({ roleOf, isOfficial, sameBarangay, requireUser, assertRole, assertBarangay, canReadAlert, assertReadAlert, assertOwner });
export default Permissions;
