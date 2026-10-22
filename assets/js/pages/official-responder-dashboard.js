import { renderOperationalDashboard } from './official-operational-dashboard.js?v=rescuer-2';
import { responderDashboardData } from './official-responder-model.js';

export function renderResponderDashboard(options) {
  const data = responderDashboardData(options.alerts, options.user, options.now);
  return renderOperationalDashboard({ ...options, data: { ...data, records: data.responses, completedRecords: data.completedResponses } });
}
