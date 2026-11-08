import { ApiError } from '../core/config.js';

const statuses = { 401: 'AUTH', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'VALIDATION', 419: 'CSRF', 422: 'VALIDATION', 429: 'RATE_LIMIT', 503: 'NOT_AVAILABLE' };
const messages = {
  AUTH: 'Sign in to continue.', FORBIDDEN: 'This action is not available for your account.',
  NOT_FOUND: 'This record was not found.', CONFLICT: 'This record changed. Refresh and try again.',
  CSRF: 'Your session changed. Refresh and try again.', VALIDATION: 'Check the highlighted fields.',
  RATE_LIMIT: 'Too many attempts. Try again later.', NOT_AVAILABLE: 'This service is not available yet.',
  NETWORK: 'Unable to reach the server. Check your connection and try again.',
  SERVER: 'The request could not be completed.', CAPACITY: 'This role is at capacity.',
  BUSY: 'An active responsibility prevents this change.', INVALID_STATE: 'This action is no longer available.',
  INVALID_CODE: 'Check the code and try again.', CODE_EXPIRED: 'This code has expired. Request another code.',
  AUTHORIZATION_EXPIRED: 'This reset authorization has expired. Start again.', COOLDOWN: 'Wait before requesting another code.',
  PHOTO_PROCESSING: 'This photo is still being processed. Retry the same upload shortly.',
  PHOTO_CONFLICT: 'This upload intent already has different photo bytes.', PHOTO_INVALID: 'Choose a valid JPEG or PNG within the photo limits.',
  PHOTO_NOT_FOUND: 'This photo is not available.', PHOTO_INTEGRITY: 'This private photo is unavailable.', PHOTO_STORAGE: 'Private photo storage is unavailable.',
};
// Only fixed, reviewed explanations may cross the error boundary; never echo server input.
const fieldMessages = new Set(['This field is required.', 'Enter a whole number.',
  'Use a whole number from 1 to 999999.', 'Enter the evacuation center capacity.',
  'Map coverage is not available for this barangay.', 'Select both map coordinates.']);

export function createHttp({ fetchImpl = globalThis.fetch, origin = globalThis.location?.origin, timeout = 15000, onServerTime = () => {} } = {}) {
  const base = new URL('/api/v1/', origin);
  const unauthorized = new Set();
  let csrfToken = null, csrfPending = null, identityContext = null, observationContext = null;
  function problem(code, status = 0, payload = {}, response = null) {
    const fields = {};
    for (const [key, value] of Object.entries(payload?.fields || {})) if (/^[a-z][a-z0-9_.]{0,99}$/i.test(key)) fields[key] = fieldMessages.has(value) ? value : 'Check this field.';
    const error = new ApiError(code, messages[code] || messages.SERVER, fields);
    error.status = status;
    error.request_id = typeof payload?.request_id === 'string' && /^[a-z0-9-]{1,100}$/i.test(payload.request_id) ? payload.request_id : null;
    const retry = Number(response?.headers.get('Retry-After'));
    error.retry_after = Number.isFinite(retry) && retry > 0 ? retry : null;
    return error;
  }
  async function send(path, { method = 'GET', body, query = {}, signal, headers: suppliedHeaders = {} } = {}) {
    const observedIdentity = identityContext;
    const observedSession = observationContext;
    if (typeof path !== 'string' || !/^[a-z][a-z0-9-]*(?:\/[a-z0-9_-]+)*$/i.test(path)) throw problem('VALIDATION');
    method = method.toUpperCase();
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw problem('VALIDATION');
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const headers = new Headers({ Accept: 'application/json' });
    for (const [key, value] of new Headers(suppliedHeaders)) {
      // Domain code may supply intent/concurrency headers, never authentication or CSRF authority.
      if (!['idempotency-key', 'if-match'].includes(key.toLowerCase()) || !value || value.length > 128) throw problem('VALIDATION');
      if (key.toLowerCase() === 'idempotency-key' && !/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw problem('VALIDATION');
      headers.set(key, value);
    }
    const write = method !== 'GET';
    if (write && !csrfToken) await ensureCsrf();
    if (write) headers.set('X-CSRF-TOKEN', csrfToken);
    if (write && observedIdentity) headers.set('X-BC-Identity', observedIdentity);
    if (write && observedSession) headers.set('X-BC-Observation', observedSession);
    let content = body;
    if (body !== undefined && !(body instanceof FormData)) { headers.set('Content-Type', 'application/json'); content = JSON.stringify(body); }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    let response, payload;
    try {
      response = await fetchImpl(url.href, { method, headers, body: content, credentials: 'same-origin', mode: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal });
      try { payload = await response.json(); } catch { throw problem('SERVER', response.status); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw problem('NETWORK');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    if (!response.ok) {
      if (response.status === 401) { csrfToken = null; identityContext = null; observationContext = null; for (const callback of unauthorized) { try { callback(); } catch { /* One view cannot block revocation of the others. */ } } }
      if (response.status === 419) csrfToken = null;
      let code = statuses[response.status] || 'SERVER';
      const domainCodes = ['CAPACITY', 'BUSY', 'INVALID_STATE', 'INVALID_CODE', 'CODE_EXPIRED', 'AUTHORIZATION_EXPIRED', 'COOLDOWN'];
      if ([409, 422, 429].includes(response.status) && domainCodes.includes(payload?.code)) code = payload.code;
      const photoCodes = { 404: ['PHOTO_NOT_FOUND'], 409: ['PHOTO_CONFLICT'], 422: ['PHOTO_INVALID'], 503: ['PHOTO_PROCESSING', 'PHOTO_INTEGRITY', 'PHOTO_STORAGE'] };
      if (photoCodes[response.status]?.includes(payload?.code)) code = payload.code;
      throw problem(code, response.status, payload, response);
    }
    if (!payload || !Object.hasOwn(payload, 'data')) throw problem('SERVER', response.status);
    if (typeof payload.meta?.server_time === 'string' && Number.isFinite(Date.parse(payload.meta.server_time))) onServerTime(payload.meta.server_time);
    if (path === 'auth/login' || path === 'auth/logout') csrfToken = null;
    return payload;
  }
  async function ensureCsrf() {
    if (!csrfPending) csrfPending = send('auth/csrf').then(payload => {
      if (typeof payload.data?.csrf_token !== 'string' || !payload.data.csrf_token) throw problem('SERVER');
      csrfToken = payload.data.csrf_token;
    }).finally(() => { csrfPending = null; });
    await csrfPending;
  }
  return Object.freeze({
    request: async (path, options) => (await send(path, options)).data,
    envelope: send,
    setIdentity(identity) {
      if (identity === null) { identityContext = null; observationContext = null; return; }
      if (!Number.isSafeInteger(identity.id) || identity.id < 1 || !Number.isSafeInteger(identity.barangay_id) || identity.barangay_id < 1 || !['resident', 'captain', 'secretary', 'responder', 'rescuer'].includes(identity.role)) throw problem('VALIDATION');
      if (identity.observation !== undefined && !/^[a-f0-9]{64}$/.test(identity.observation)) throw problem('VALIDATION');
      identityContext = `${identity.id}:${identity.barangay_id}:${identity.role}`;
      observationContext = identity.observation || null;
    },
    onUnauthorized(callback) { unauthorized.add(callback); return () => unauthorized.delete(callback); },
  });
}
