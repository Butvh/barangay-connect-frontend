import { ApiError } from '../core/config.js';

export const identifier = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError('VALIDATION', 'Choose a valid record.');
  return id;
};
export const revision = input => {
  if (!Number.isSafeInteger(input?.expected_revision) || input.expected_revision < 0) throw new ApiError('CONFLICT', 'Refresh and review the record before continuing.');
  return input;
};
export const command = options => {
  const key = options?.idempotencyKey;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ApiError('VALIDATION', 'A stable command key is required.');
  return { 'Idempotency-Key': key };
};
export function query(path, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return path + (params.size ? `?${params}` : '');
}
/** P1 injects its CSRF/session transport. This module never reads browser storage or fetches directly. */
export function client(request) {
  if (typeof request !== 'function') throw new TypeError('P1 authenticated request transport is required.');
  return async (path, { method = 'GET', body, headers, complete = false, signal } = {}) => {
    let envelope;
    try { envelope = await request(path, { method, body, headers, signal }); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      const safe = error?.code && error?.message;
      const mapped = new ApiError(safe ? error.code : 'UNAVAILABLE', safe ? error.message : 'The service is unavailable. Try again.', safe ? error.fields || {} : {});
      if (safe && error.request_id) mapped.request_id = error.request_id;
      throw mapped;
    }
    if (!envelope || !Object.hasOwn(envelope, 'data') || (complete && (!Array.isArray(envelope.data) || envelope.meta?.complete !== true || envelope.meta.total !== envelope.data.length))) throw new ApiError('CONTRACT', 'The service did not return the complete expected result.');
    return envelope.data;
  };
}
