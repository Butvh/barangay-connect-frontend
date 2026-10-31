import { ApiError } from '../core/config.js';
import { ALERT_STATUSES } from '../core/alertMachine.js';
import { Fmt } from '../core/format.js';

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

export function reportScreen(alert, details, { justSubmitted = false } = {}) {
  if (!ALERT_STATUSES.includes(alert?.status)) throw new ApiError('INVALID_STATE', 'This SOS status is unavailable. Open your alert from the dashboard.');
  if (alert.status === 'Resolved') return 'resolved';
  if (details) return 'details';
  return justSubmitted && alert.status === 'Pending' ? 'sent' : 'active';
}

const stages = [
  ['amber', 'clock', 'Your SOS has been sent and is waiting for acknowledgement.'],
  ['blue', 'circle-check', 'Barangay officials have received your alert.'],
  ['teal', 'loader-circle', 'Response teams are on the way.'],
  ['teal', 'triangle-alert', 'Rescue and evacuation are ongoing.'],
  ['green', 'circle-check', 'Your alert has been resolved.'],
];
const firstInstant = values => values.filter(value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)))
  .sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;

/** A reached status is not evidence that an earlier stage actually occurred. */
export function responseProgress(alert) {
  const current = ALERT_STATUSES.indexOf(alert.status);
  if (current < 0) throw new ApiError('INVALID_STATE', 'This SOS status is unavailable.');
  const fallback = [[alert.created_at], [alert.acknowledged_at], (alert.responses || []).map(r => r.responded_at), (alert.rescues || []).map(r => r.rescued_at), [alert.resolved_at]];
  return ALERT_STATUSES.map((status, index) => {
    const at = index > current ? null : firstInstant([...(alert.timeline || []).filter(t => t.status === status).map(t => t.at), ...fallback[index]]);
    const phase = index === current ? 'current' : index > current ? 'upcoming' : at ? 'completed' : 'skipped';
    const [tone, stageIcon, stageDescription] = stages[index];
    const description = phase === 'skipped' ? index === 3 && alert.rescue_required === false ? 'This stage was not required.' : 'No event was recorded for this stage.' : stageDescription;
    const timeLabel = at ? Fmt.short(at) : phase === 'skipped' ? (index === 3 && alert.rescue_required === false ? 'Not required' : 'Not recorded') : phase === 'current' ? 'Time not recorded' : 'Waiting for update';
    return { status, phase, tone, icon: phase === 'completed' ? 'circle-check' : phase === 'skipped' ? 'minus' : stageIcon, description, at, timeLabel };
  });
}

export function initialReportLocation(alert, household) {
  const x = alert.map_x ?? household?.map_x ?? 50, y = alert.map_y ?? household?.map_y ?? 50;
  return { mode: x === household?.map_x && y === household?.map_y ? 'home' : 'pin', x, y };
}
