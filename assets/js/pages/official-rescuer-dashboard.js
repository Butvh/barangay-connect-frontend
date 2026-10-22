import { renderOperationalDashboard } from './official-operational-dashboard.js?v=rescuer-2';
import { rescuerDashboardData } from './official-rescuer-model.js?v=rescuer-2';

export function renderRescuerDashboard(options) {
  return renderOperationalDashboard({ ...options, kind: 'rescue', data: rescuerDashboardData(options.alerts, options.user, options.now) });
}
