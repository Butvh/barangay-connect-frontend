import { ApiError } from '../core/config.js';
import { submitPrivateDocuments } from './private-document-submission.js';
import { submitAdministrative } from './administrative-submission.js';

const id = value => { if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new ApiError('VALIDATION', 'Use a valid record.'); return Number(value); };
const self = (auth, value) => { const actor = auth.current(); if (!actor || actor.id !== id(value)) throw new ApiError('FORBIDDEN', 'Use your own account.'); return actor; };
export function createConsentFactories() {
  const path = purpose => {
    if (!['incident_review', 'barangay_announcements'].includes(purpose)) throw new ApiError('VALIDATION', 'Choose a supported notification purpose.');
    return 'me/notification-preferences/' + purpose;
  };
  return Object.freeze({ notificationPreferences: ({ http }) => ({
    get: purpose => http.request(path(purpose)),
    set: (purpose, input) => http.request(path(purpose), { method: 'PUT', body: input }),
  }) });
}
export function createAdministrativeFactories() {
  return Object.freeze({
    barangays: ({ http }) => ({ list: () => http.request('barangays') }),
    users: ({ http, auth }) => ({
      register: (input, { intent } = {}) => submitAdministrative({ http, path: 'auth/register', input, intent }),
      get: value => { self(auth, value); return http.request('profile'); },
      async update(value, input) { self(auth, value); const result = await http.request('profile', { method: 'PATCH', body: input }); await auth.refresh(); return result; },
    }),
    account: ({ http, auth }) => ({ async changePassword(input) { const result = await http.request('account/password', { method: 'POST', body: input }); await auth.refresh(); return result; } }),
    recovery: ({ http }) => Object.fromEntries([['requestCode', 'requests'], ['verifyCode', 'verifications'], ['resetPassword', 'resets']]
      .map(([method, route]) => [method, input => http.request('password-recovery/' + route, { method: 'POST', body: input })])),
    facilities: ({ http }) => ({
      list: (query = {}) => http.request('facilities', { query }), get: value => http.request('facilities/' + id(value)),
      create: (input, { intent } = {}) => submitAdministrative({ http, path: 'facilities', input, intent }),
      update: (value, body) => http.request('facilities/' + id(value), { method: 'PATCH', body }),
      setStatus: (value, body) => http.request('facilities/' + id(value) + '/status', { method: 'PATCH', body }),
    }),
    verification: ({ http, auth }) => ({
      list: (query = {}) => http.request('verifications', { query }), get: value => http.request('verifications/' + id(value)),
      review: (value, body) => http.request('verifications/' + id(value) + '/decisions', { method: 'POST', body }),
      expireOverdue: () => http.request('verifications/expire-overdue', { method: 'POST', body: {} }),
      submit(value, input, { intent } = {}) {
        self(auth, value);
        const { valid_id, proof_of_residence, document_type, verification_id, expected_revision, file_name: _displayOnly, ...unexpected } = input;
        if (Object.keys(unexpected).length) throw new ApiError('VALIDATION', 'Unexpected verification fields.');
        const fields = { document_type, ...(verification_id === undefined ? {} : { expected_revision }) };
        const path = verification_id === undefined ? 'me/verifications' : 'verifications/' + id(verification_id) + '/submissions';
        return submitPrivateDocuments({ http, auth, path, fields, files: [['valid_id', valid_id, 10485760], ['proof_of_residence', proof_of_residence, 10485760]], intent });
      },
    }),
    personnel: ({ http, auth }) => ({
      list: () => http.request('personnel'), get: value => http.request('personnel/' + id(value)),
      addExternal(input, { intent } = {}) {
        const { requirements = [], ...fields } = input;
        if (!Array.isArray(requirements) || requirements.length > 10) throw new ApiError('VALIDATION', 'Choose up to ten requirements.');
        return submitPrivateDocuments({ http, auth, path: 'personnel', fields, files: requirements.map(file => ['requirements[]', file, 5242880]), intent });
      },
      ...Object.fromEntries(['appoint', 'reassign', 'remove'].map(action => [action, (value, body) => http.request('personnel/' + id(value) + '/' + action, { method: 'POST', body })])),
    }),
  });
}

// Read-only invalidation uses the same scoped API projections as the pages. No
// browser-storage fallback, alternate writer or private download bytes are read.
export const administrativeReaders = Object.freeze(Object.fromEntries([
  ['users', 'profile'], ['verification', 'verifications'], ['personnel', 'personnel'], ['facilities', 'facilities'], ['barangays', 'barangays'],
].map(([entity, path]) => [entity, ({ http }) => async ({ signal } = {}) => {
  const data = await http.request(path, { signal });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}])));
