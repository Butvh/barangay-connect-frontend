import { ApiError, copy } from '../core/config.js';
import { roleOf } from '../core/permissions.js';

export function createBackendAuth({ http, location = globalThis.location } = {}) {
  let user = null, hydrated = false, failure = null, version = 0;
  const listeners = new Set();
  const emit = (reason = 'refresh') => { for (const callback of listeners) { try { callback({ reason }); } catch { /* Isolate page listeners. */ } } };
  const homeFor = person => roleOf(person) === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html';
  const current = () => user ? copy(user) : null;
  const observed = async (path, options) => http.envelope ? http.envelope(path, options) : { data: await http.request(path, options) };
  function accept(value, meta = {}) {
    if (!value || !Number.isSafeInteger(value.id) || !roleOf(value)) throw new ApiError('SERVER', 'The session response could not be read.');
    // Server uses an allowlisted Resource. Never retain credential fields even in a malformed reply.
    const { password, remember_token, auth_version, session_observation: _untrusted, ...safe } = value;
    const nonce = meta.session_observation;
    if (nonce !== undefined && (typeof nonce !== 'string' || !/^[a-f0-9]{64}$/.test(nonce))) throw new ApiError('CONTRACT', 'The session observation could not be read.');
    http.setIdentity?.({ id: safe.id, barangay_id: safe.barangay_id, role: roleOf(safe), ...(nonce ? { observation: nonce } : {}) });
    if (nonce) safe.session_observation = nonce;
    user = copy(safe); hydrated = true; failure = null;
  }
  http.onUnauthorized(() => { version++; user = null; hydrated = true; failure = null; emit('revoked'); });
  async function hydrateSession() {
    const request = ++version;
    try { const result = await observed('me'); if (request === version) accept(result.data, result.meta); }
    catch (error) { if (request === version) {
      if (error.code === 'AUTH' || !hydrated) user = null;
      hydrated = true; failure = error.code === 'AUTH' ? null : error;
    } }
    emit();
    return current();
  }
  async function login(email, password) {
    const request = ++version;
    const result = await observed('auth/login', { method: 'POST', body: { email: String(email).trim().toLowerCase(), password } });
    if (request !== version) throw new ApiError('AUTH', 'Your session changed. Try signing in again.');
    accept(result.data, result.meta); emit('signed_in'); return current();
  }
  async function logout() {
    version++;
    const result = await http.request('auth/logout', { method: 'POST', body: {} });
    if (result?.signed_out !== true) throw new ApiError('SERVER', 'Sign out could not be confirmed. Try again.');
    user = null; failure = null; hydrated = true;
    http.setIdentity?.(null);
    emit('signed_out');
  }
  function requireRole(roles = []) {
    if (!hydrated) throw new ApiError('NOT_READY', 'Checking your session.');
    if (!roles.length) return current();
    if (failure) throw failure;
    if (!user) { location?.replace?.(roles.length === 1 && roles[0] === 'resident' ? 'resident-login.html' : 'login.html'); throw new ApiError('AUTH', 'Sign in to continue.'); }
    if (!roles.includes(roleOf(user))) { location?.replace?.(homeFor(user)); throw new ApiError('FORBIDDEN', 'This page is not available for your role.'); }
    return current();
  }
  return Object.freeze({ current, hydrateSession, refresh: hydrateSession, login, logout, requireRole, roleOf, homeFor,
    error: () => failure, onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  });
}
