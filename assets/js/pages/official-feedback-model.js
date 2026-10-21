export const FEEDBACK_TYPES = Object.freeze({ complaint: 'Complaints', suggestion: 'Suggestions', general: 'General Feedback' });
export const FEEDBACK_STATUSES = Object.freeze(['Pending', 'Assigned', 'Resolved']);
export const feedbackText = row => row.type === 'general' ? row.comment : row.description;
export function feedbackPage(rows, { type = 'complaint', q = '', status = '', sort = 'newest', page = 1, size = 10 } = {}) {
  const query = String(q).trim().toLowerCase();
  const filtered = rows.filter(row => row.type === type && (type === 'general' || !status || row.status === status) && (!query || [feedbackText(row), row.category, row.location, row.resident?.full_name, row.assigned_tanod?.full_name].some(value => String(value || '').toLowerCase().includes(query))));
  filtered.sort((a, b) => (Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id) * (sort === 'oldest' ? 1 : -1));
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(pages, Math.max(1, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((current - 1) * size, current * size), total: filtered.length, pages, page: current };
}
export const feedbackCounts = rows => Object.fromEntries(FEEDBACK_STATUSES.map(status => [status, rows.filter(row => row.type === 'complaint' && row.status === status).length]));
