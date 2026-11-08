import { ApiError } from '../core/config.js';
import { client, command, identifier, query, revision } from './p2-contract.js';

export function createOperations({ request, privatePhotos = false }) {
  const call = client(request), alert = id => `/alerts/${identifier(id)}`;
  const options = (id, role) => call(query(`${alert(id)}/assignment-options`, { role }));
  const transfer = async (id, input, cancel) => {
    revision(input);
    const current = await options(id, input.role);
    if (current.alert_revision !== input.expected_revision || !current.current_assignment) throw new ApiError('CONFLICT', 'The assignment changed. Review the latest options.');
    const { role, responder_id, ...body } = input;
    if (responder_id !== undefined && responder_id !== input.personnel_id) throw new ApiError('VALIDATION', 'Choose one consistent personnel identifier.');
    return call(`/assignments/${identifier(current.current_assignment.id)}/${cancel ? 'cancellations' : 'transfers'}`, { method: 'POST', body });
  };
  return Object.freeze({
    alerts: Object.freeze({
      ...(privatePhotos ? { stagePhoto: async (file, intent) => {
        const body = new FormData();
        body.append('photo', file);
        return call('/incident-photos', { method: 'POST', body, headers: command(intent) });
      } } : {}),
      list: async ({ nearby, ...filters } = {}) => call(query(nearby ? '/nearby-alerts' : '/alerts', filters), { complete: true }),
      get: async id => call(alert(id)),
      create: async (input = {}, intent) => call('/alerts', { method: 'POST', body: input, headers: command(intent) }),
      addDetails: async (id, input, intent) => call(alert(id), { method: 'PATCH', body: revision(input), headers: command(intent) }),
      assignmentOptions: async (id, role) => options(id, role),
      acknowledge: async (id, input) => call(`${alert(id)}/acknowledgments`, { method: 'POST', body: revision(input) }),
      assign: async (id, input) => call(`${alert(id)}/assignments`, { method: 'POST', body: revision(input) }),
      reassign: async (id, input) => transfer(id, input, false),
      cancelAssignment: async (id, input) => transfer(id, input, true),
      logResponse: async (id, input, intent) => call(`${alert(id)}/responses`, { method: 'POST', body: input, headers: command(intent) }),
      logRescue: async (id, input, intent) => call(`${alert(id)}/rescues`, { method: 'POST', body: input, headers: command(intent) }),
      resolve: async (id, input) => call(`${alert(id)}/resolution`, { method: 'POST', body: revision(input) }),
    }),
    dashboard: Object.freeze({ officialStats: async () => call('/dashboard') }),
    map: Object.freeze({ get: async filters => call(query('/map', filters)) }),
  });
}
