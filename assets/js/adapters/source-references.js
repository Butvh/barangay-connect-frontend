import { ApiError } from '../core/config.js';

export function createSourceFactories() {
  const id = value => { if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new ApiError('VALIDATION', 'Choose a valid reference.'); return Number(value); };
  return Object.freeze({
    users: ({ http }) => ({ get: value => http.request('references/users/' + id(value)) }),
    barangays: ({ http }) => ({ list: () => http.request('references/barangays') }),
    facilities: ({ http }) => ({ list: () => http.request('references/facilities'), get: value => http.request('references/facilities/' + id(value)) }),
  });
}
export const sourceReaders = Object.freeze(Object.fromEntries(['users', 'verification', 'facilities', 'barangays'].map(entity => [entity, ({ http }) => async ({ signal } = {}) => {
  const data = await http.request('references/revisions/' + entity, { signal });
  if (typeof data?.revision !== 'string' || !/^[a-f0-9]{64}$/.test(data.revision)) throw new ApiError('CONTRACT', 'Invalid source revision.');
  return data.revision;
}])));
