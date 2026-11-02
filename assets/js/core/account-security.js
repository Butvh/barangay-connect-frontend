import { ApiError } from './config.js';

export const passwordRequirements = value => [value.length >= 8, /[A-Z]/.test(value), /[a-z]/.test(value), /[0-9]/.test(value)];

export function validatePasswordChange(input = {}) {
  const fields = {}, keys = ['current_password', 'password', 'password_confirmation'];
  for (const key of keys) if (typeof input[key] !== 'string' || !input[key]) fields[key] = 'This field is required.';
  if (typeof input.password === 'string' && input.password) {
    if (!passwordRequirements(input.password).every(Boolean)) fields.password = 'Use at least 8 characters, including uppercase, lowercase and a number.';
    if (input.password.length > 128) fields.password = 'Use 128 characters or fewer.';
    if (input.password === input.current_password) fields.password = 'Choose a password different from your current password.';
    if (input.password_confirmation && input.password !== input.password_confirmation) fields.password_confirmation = 'The new passwords do not match.';
  }
  if (Object.keys(fields).length) throw new ApiError('VALIDATION', 'Check the password fields.', fields);
  return Object.fromEntries(keys.map(key => [key, input[key]]));
}

// Credentials pass straight to a deliberately configured secure server transport.
// Never use the demo store, storage events, activity logs or a pretend success.
export function createAccountSecurity({ currentUser, transport = null }) {
  return Object.freeze({
    async security() { currentUser(); return { password_change_available: typeof transport?.changePassword === 'function' }; },
    async changePassword(input) {
      currentUser();
      const payload = validatePasswordChange(input);
      if (typeof transport?.changePassword !== 'function') throw new ApiError('NOT_AVAILABLE', 'Password changes are unavailable in this browser demo. A secure account server must be connected first.');
      const result = await transport.changePassword(payload);
      if (result?.password_changed !== true) throw new ApiError('SERVER', 'The server did not confirm a password change.');
      return { password_changed: true };
    },
  });
}
