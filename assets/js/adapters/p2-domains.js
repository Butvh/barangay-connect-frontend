import { ApiError } from '../core/config.js';

/** P1 owns createP2DomainFactories and the shared envelope transport. */
export function createRefreshReaders({ http }) {
  if (typeof http?.envelope !== 'function') throw new TypeError('P1 Http.envelope is required.');
  return Object.freeze(Object.fromEntries(['alerts', 'announcements', 'feedback', 'notifications', 'reports', 'dashboard', 'map'].map(entity => [entity, async ({ signal } = {}) => {
    const response = await http.envelope('revisions/' + entity, { signal });
    const value = response?.data?.revision;
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new ApiError('CONTRACT', 'Invalid scoped revision.');
    return value;
  }])));
}
