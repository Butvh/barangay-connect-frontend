import { client, identifier, query } from './p2-contract.js';

export function createReports({ request }) {
  const call = client(request);
  return Object.freeze({
    snapshot: async () => call('/reports/snapshot'),
    summary: async month => call(query('/reports/summary', { month })),
    incidents: async filters => call(query('/reports/incidents', filters), { complete: true }),
    incident: async id => call(`/reports/incidents/${identifier(id)}`),
    activity: async filters => call(query('/reports/activity', filters), { complete: true }),
    performance: async (month, role) => call(query('/reports/performance', { month, role })),
    // P1 must use an authenticated same-origin download; do not navigate to an arbitrary API host.
    exportPath: id => `/reports/incidents/${identifier(id)}/export`,
  });
}
