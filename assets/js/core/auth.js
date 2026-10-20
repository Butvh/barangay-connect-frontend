import { Config, ApiError, copy, delay } from './config.js';
import { Store, memoryStorage } from './store.js';
import { roleOf } from './permissions.js';

export function publicUser(user) { if (!user) return null; const { password, ...safe } = user; return copy(safe); }
function tabStorage() { try { if (globalThis.sessionStorage) return globalThis.sessionStorage; } catch { /* test/non-browser */ } return memoryStorage(); }
export function createAuth({ store = Store, session = tabStorage(), wait = delay, location = globalThis.location } = {}) {
  function current() {
    let id;
    try { id = Number(session.getItem(Config.session_key)); } catch { return null; }
    if (!id) return null;
    const user = store.read().users.find(row => row.id === id);
    if (!roleOf(user)) return null;
    return publicUser(user);
  }
  function homeFor(user) { return roleOf(user) === 'resident' ? 'resident-dashboard.html' : 'official-dashboard.html'; }
  async function login(email, password) {
    await wait();
    const user = store.read().users.find(row => row.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || user.password !== password || !roleOf(user)) throw new ApiError('AUTH', 'Email or password is incorrect.', { email: 'Check your email and password.' });
    try { session.setItem(Config.session_key, String(user.id)); }
    catch { throw new ApiError('AUTH', 'Allow session storage to sign in to the demo.'); }
    return publicUser(user);
  }
  function logout() { session.removeItem(Config.session_key); }
  function requireRole(roles = []) {
    const user = current();
    if (!roles.length) return user; // Public login/register pages explicitly use [].
    if (!user) { location?.replace?.(roles.length === 1 && roles[0] === 'resident' ? 'resident-login.html' : 'login.html'); throw new ApiError('AUTH', 'Sign in to continue.'); }
    if (!roles.includes(roleOf(user))) { location?.replace?.(homeFor(user)); throw new ApiError('FORBIDDEN', 'This page is not available for your role.'); }
    return user;
  }
  return Object.freeze({ current, login, logout, requireRole, roleOf, homeFor });
}
export const Auth = createAuth();
export default Auth;
