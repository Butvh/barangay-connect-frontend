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
  assertRole(user, rule.role === 'secretary' ? ['secretary', 'captain'] : [rule.role]);
  const stages = action === 'logResponse' ? ['Acknowledged', 'Responding', 'Rescue in progress'] : action === 'logRescue' ? ['Responding', 'Rescue in progress'] : action === 'resolve' ? ['Responding', 'Rescue in progress'] : [rule.from];
  if (!stages.includes(alert.status)) throw new ApiError('INVALID_STATE', `${action} is not available while this alert is ${alert.status}. Refresh the alert.`);
  if (action === 'logResponse' && !alert.active_responder_assignment) throw new ApiError('INVALID_STATE', 'An active responder assignment is required to log a response.');
  if (action === 'logRescue' && !alert.active_rescuer_assignment) throw new ApiError('INVALID_STATE', 'An active rescuer assignment is required to log a rescue.');
  if (action === 'resolve' && alert.status === 'Responding' && !(alert.rescue_required === false && alert.response_completed && !alert.active_rescuer_assignment)) throw new ApiError('INVALID_STATE', 'Complete the response and record that rescue is not needed, or continue the required rescue operation.');
  const result = { ...alert, status: action === 'logResponse' && alert.status === 'Rescue in progress' ? alert.status : rule.to };
  if (action === 'acknowledge') Object.assign(result, { acknowledged_at: at, acknowledged_by: user.id });
  if (action === 'resolve') result.resolved_at = at;
  return result;
}
export function canTransition(alert, action, user) {
  try { transition(alert, action, user, ''); return true; } catch { return false; }
}
export const AlertMachine = Object.freeze({ transition, canTransition, ALERT_STATUSES, ALERT_TYPES, RESPONSE_TYPES, RULES });
export default AlertMachine;
