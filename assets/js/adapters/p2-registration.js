import { createDomainTransport } from './domain-transport.js';

/** Composition only. Global registration stays disabled until P2 readers/forms and server ports are compatible. */
export function createP2DomainFactories({ createOperations, createCommunications, createReports, privatePhotos = false }) {
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
  const communications = group => ({ http }) => createCommunications({ request: createDomainTransport(http) })[group];
  return Object.freeze({
    alerts: operations('alerts'), dashboard: operations('dashboard'), map: operations('map'),
    announcements: communications('announcements'), feedback: communications('feedback'), notifications: communications('notifications'),
    reports: ({ http }) => createReports({ request: createDomainTransport(http) }),
  });
}
