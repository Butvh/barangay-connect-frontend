import { client, command, identifier, query, revision } from './p2-contract.js';

export function createCommunications({ request }) {
  const call = client(request);
  return Object.freeze({
    announcements: Object.freeze({
      list: async filters => call(query('/announcements', filters), { complete: true }),
      get: async id => call(`/announcements/${identifier(id)}`),
      create: async (input, intent) => call('/announcements', { method: 'POST', body: input, headers: command(intent) }),
      update: async (id, input) => call(`/announcements/${identifier(id)}`, { method: 'PATCH', body: revision(input) }),
      archive: async (id, input) => call(`/announcements/${identifier(id)}/archive`, { method: 'POST', body: revision(input) }),
      retract: async (id, input) => call(`/announcements/${identifier(id)}/retract`, { method: 'POST', body: revision(input) }),
      expireOverdue: async () => call('/announcements/expire-overdue', { method: 'POST', body: {} }),
    }),
    feedback: Object.freeze({
      list: async filters => call(query('/feedback', filters), { complete: true }),
      get: async id => call(`/feedback/${identifier(id)}`),
      assignmentOptions: async id => call(`/feedback/${identifier(id)}/assignment-options`),
      create: async (type, input, intent) => call('/feedback', { method: 'POST', body: { ...input, type }, headers: command(intent) }),
      assignTanod: async (id, tanodId, observed) => call(`/feedback/${identifier(id)}/assignment`, { method: 'POST', body: { tanod_id: identifier(tanodId), ...revision(observed) } }),
      resolve: async (id, observed) => call(`/feedback/${identifier(id)}/resolution`, { method: 'POST', body: revision(observed) }),
    }),
    notifications: Object.freeze({
      list: async filters => call(query('/notifications', filters), { complete: true }),
      get: async id => call(`/notifications/${identifier(id)}`),
      markRead: async id => call(`/notifications/${identifier(id)}`, { method: 'PATCH', body: { is_read: true } }),
      markUnread: async id => call(`/notifications/${identifier(id)}`, { method: 'PATCH', body: { is_read: false } }),
      dismiss: async id => call(`/notifications/${identifier(id)}`, { method: 'DELETE' }),
      markAllRead: async () => call('/notifications/mark-all-read', { method: 'POST', body: {} }),
      clearRead: async (observed = {}) => call('/notifications/clear-read', { method: 'POST', body: observed }),
    }),
  });
}
