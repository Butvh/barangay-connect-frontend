import { Auth } from './auth.js';
import { UI } from './ui.js';

export async function signOutTo(target) {
  try {
    await Auth.logout();
    globalThis.location.assign(target);
    return true;
  } catch {
    UI.toast('Sign out could not be confirmed. Check your connection and try again.', 'error');
    return false;
  }
}
