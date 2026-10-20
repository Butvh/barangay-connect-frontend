import { ApiError } from './config.js';
import { assertRole } from './permissions.js';

export const ALERT_STATUSES = Object.freeze(['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved']);
export const ALERT_TYPES = Object.freeze(['Fire', 'Flood', 'Typhoon/Storm', 'Landslide', 'Earthquake', 'Other']);
export const RESPONSE_TYPES = Object.freeze(['First aid', 'Assessment', 'Evacuation assistance', 'Other']);
export const RULES = Object.freeze({
  acknowledge: { from: 'Pending', to: 'Acknowledged', role: 'secretary' },
  logResponse: { from: 'Acknowledged', to: 'Responding', role: 'responder' },
  logRescue: { from: 'Responding', to: 'Rescue in progress', role: 'rescuer' },
  resolve: { from: 'Rescue in progress', to: 'Resolved', role: 'secretary' },
});

/** Pure: validates the caller/status and returns a new alert. Never mutates input. */
export function transition(alert, action, user, at) {
  const rule = RULES[action];
  if (!rule) throw new ApiError('INVALID_STATE', 'That alert action is not available.');
  assertRole(user, [rule.role]);
  if (alert.status !== rule.from) throw new ApiError('INVALID_STATE', `${action} requires ${rule.from}; this alert is ${alert.status}. Refresh the alert.`);
  const result = { ...alert, status: rule.to };
  if (action === 'acknowledge') Object.assign(result, { acknowledged_at: at, acknowledged_by: user.id });
  if (action === 'resolve') result.resolved_at = at;
  return result;
}
export function canTransition(alert, action, user) {
  try { transition(alert, action, user, ''); return true; } catch { return false; }
}
export const AlertMachine = Object.freeze({ transition, canTransition, ALERT_STATUSES, ALERT_TYPES, RESPONSE_TYPES, RULES });
export default AlertMachine;
