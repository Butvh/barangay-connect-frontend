import { ApiError } from '../core/config.js';

/** Inject this envelope function into P2's actual createOperations/Communications/Reports factories. */
export function createDomainTransport(http) {
  if (typeof http?.envelope !== 'function') throw new TypeError('The shared envelope transport is required.');
  return async (path, options = {}) => {
    if (typeof path !== 'string' || !/^\/?[a-z][a-z0-9/-]*(?:\?[^#]*)?$/i.test(path) || /\/\//.test(path)) {
      throw new ApiError('VALIDATION', 'Choose a valid API path.');
    }
    const normalized = path.replace(/^\//, ''), index = normalized.indexOf('?');
    const segments = index < 0 ? normalized : normalized.slice(0, index), search = index < 0 ? '' : normalized.slice(index + 1);
    if (segments.startsWith('api/')) throw new ApiError('VALIDATION', 'Use a path relative to the API root.');
    const query = Object.fromEntries(new URLSearchParams(search || ''));
    if (Object.keys(query).length !== [...new URLSearchParams(search || '')].length) throw new ApiError('VALIDATION', 'Query keys must be unique.');
    return http.envelope(segments, { ...options, query });
  };
}
