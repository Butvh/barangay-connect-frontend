import { createDomainTransport } from './domain-transport.js';

/** Composition only. Global registration stays disabled until P2 readers/forms and server ports are compatible. */
export function createP2DomainFactories({ createOperations, createCommunications, createReports }) {
  if (![createOperations, createCommunications, createReports].every(value => typeof value === 'function')) throw new TypeError('The three owner-supplied P2 factories are required.');
  const operations = group => ({ http }) => createOperations({ request: createDomainTransport(http) })[group];
  const communications = group => ({ http }) => createCommunications({ request: createDomainTransport(http) })[group];
  return Object.freeze({
    alerts: operations('alerts'), dashboard: operations('dashboard'), map: operations('map'),
    announcements: communications('announcements'), feedback: communications('feedback'), notifications: communications('notifications'),
    reports: ({ http }) => createReports({ request: createDomainTransport(http) }),
  });
}
