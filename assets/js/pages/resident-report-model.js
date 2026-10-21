import { ApiError } from '../core/config.js';
import { ALERT_STATUSES } from '../core/alertMachine.js';

export function reportRequest(search) {
  const params = new URLSearchParams(search), details = params.get('step') === 'details';
  if (!params.has('id')) {
    if (details) throw new ApiError('VALIDATION', 'Choose an SOS alert before adding details.');
    return { id: null, details: false };
  }
  const value = params.get('id'), id = Number(value);
  if (params.getAll('id').length !== 1 || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
    throw new ApiError('VALIDATION', 'This SOS link has an invalid alert ID. Open your alert from the dashboard.');
  }
  return { id, details };
}

export function reportScreen(alert, details) {
  if (!ALERT_STATUSES.includes(alert?.status)) throw new ApiError('INVALID_STATE', 'This SOS status is unavailable. Open your alert from the dashboard.');
  if (alert.status === 'Resolved') return 'resolved';
  if (details) return 'details';
  return alert.status === 'Pending' ? 'sent' : 'active';
}

export function initialReportLocation(alert, household) {
  const x = alert.map_x ?? household?.map_x ?? 50, y = alert.map_y ?? household?.map_y ?? 50;
  return { mode: x === household?.map_x && y === household?.map_y ? 'home' : 'pin', x, y };
}
