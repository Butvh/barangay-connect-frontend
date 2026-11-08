import { createDomainTransport } from './domain-transport.js';

/** Composition only. Global registration stays disabled until P2 readers/forms and server ports are compatible. */
export function createP2DomainFactories({ createOperations, createCommunications, createReports, privatePhotos = false, generalFeedbackTest = false }) {
  if (![createOperations, createCommunications, createReports].every(value => typeof value === 'function')) throw new TypeError('The three owner-supplied P2 factories are required.');
  const operations = group => ({ http }) => {
    const source = createOperations({ request: createDomainTransport(http), privatePhotos })[group];
    if (group !== 'alerts' || !privatePhotos) return source;
    return { ...source, async get(id) {
      const data = await source.get(id);
      try { return { ...data, photos: await http.request('incident-photos/references/' + id), photo_access: true }; }
      catch (error) {
        if (!['FORBIDDEN', 'NOT_FOUND'].includes(error.code)) throw error;
        return { ...data, photos: [], photo_access: false };
      }
    } };
  };
  const communications = group => ({ http, auth }) => {
    const source = createCommunications({ request: createDomainTransport(http) })[group];
    if (group !== 'feedback') return source;
    if (generalFeedbackTest && !['review', 'archive'].every(name => typeof source[name] === 'function')) throw new TypeError('Reviewed General Feedback command adapters are required.');
    return { ...source, generalLifecycleAvailable: generalFeedbackTest === true, list(filters = {}) {
      const actor = auth?.current(), role = auth?.roleOf?.(actor) || actor?.role;
      // Summary population stays complete; P2 owns active-queue presentation.
      return source.list(['captain', 'secretary'].includes(role) ? { archive: 'all', ...filters } : filters);
    } };
  };
  return Object.freeze({
    alerts: operations('alerts'), dashboard: operations('dashboard'), map: operations('map'),
    announcements: communications('announcements'), feedback: communications('feedback'), notifications: communications('notifications'),
    reports: ({ http }) => createReports({ request: createDomainTransport(http) }),
  });
}
