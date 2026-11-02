import { ApiError } from '../core/config.js';
import { createAccountSecurity } from '../core/account-security.js';
import { createPasswordRecovery } from '../core/password-recovery.js';
import { createPolling } from './polling.js';
import { domainFactories, refreshSources } from './domains.js';

const methods = {
  barangays: ['list'], users: ['register', 'get', 'update'],
  personnel: ['list', 'get', 'addExternal', 'appoint', 'reassign', 'remove'],
  facilities: ['list', 'get', 'create', 'update', 'setStatus'],
  verification: ['submit', 'list', 'get', 'review', 'expireOverdue'],
  alerts: ['list', 'get', 'create', 'addDetails', 'assignmentOptions', 'acknowledge', 'assign', 'reassign', 'cancelAssignment', 'logResponse', 'logRescue', 'resolve'],
  announcements: ['list', 'get', 'create', 'update', 'archive', 'retract', 'expireOverdue'],
  feedback: ['list', 'get', 'create', 'assignTanod', 'resolve'],
  notifications: ['list', 'get', 'markRead', 'markUnread', 'dismiss', 'markAllRead', 'clearRead'],
  dashboard: ['officialStats'], reports: ['snapshot'],
};
export function createBackendApi({ http, auth, factories = domainFactories, sources = refreshSources, pollingFactory = createPolling } = {}) {
  const polling = pollingFactory({ auth, sources: Object.fromEntries(Object.entries(sources).map(([key, factory]) => [key, factory({ http, auth })])) });
  const api = {
    // Enabled only by the reviewed account/recovery slices, never a demo fallback.
    account: createAccountSecurity({ currentUser: auth.current, transport: null }),
    recovery: createPasswordRecovery({ transport: null }),
    subscribe: polling.subscribe, destroy: polling.destroy,
  };
  for (const [group, names] of Object.entries(methods)) {
    const implementation = factories[group]?.({ http, auth }) || {};
    api[group] = Object.freeze(Object.fromEntries(names.map(name => [name, implementation[name] || (async () => {
      throw new ApiError('NOT_AVAILABLE', 'This backend feature is awaiting integration.');
    })])));
  }
  return Object.freeze(api);
}
