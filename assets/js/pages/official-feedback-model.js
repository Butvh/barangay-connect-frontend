export const FEEDBACK_TYPES = Object.freeze({ complaint: 'Complaints', suggestion: 'Suggestions', general: 'General Feedback' });
export const FEEDBACK_STATUSES = Object.freeze(['Pending', 'Assigned', 'Resolved']);
export const feedbackText = row => row.type === 'general' ? row.comment : row.description;
// null means no linked selection; zero marks an invalid link and cannot match a record.
export function feedbackRequestId(search) {
  const params = new URLSearchParams(search);
  if (!params.has('id')) return null;
  const value = params.get('id'), id = Number(value);
  return params.getAll('id').length === 1 && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(id) ? id : 0;
}
export function feedbackPage(rows, { type = 'complaint', q = '', status = '', sort = 'newest', page = 1, size = 10, id = null, reveal = false } = {}) {
  const target = id === null ? null : rows.find(row => row.type === type && row.id === id);
  const matches = row => row.type === type && (type === 'general' || !status || row.status === status) && (!String(q).trim() || [feedbackText(row), row.category, row.location, row.resident?.full_name, row.assigned_tanod?.full_name].some(value => String(value || '').toLowerCase().includes(String(q).trim().toLowerCase())));
  const filtersCleared = Boolean(reveal && target && !matches(target));
  if (filtersCleared) { q = ''; status = ''; }
  const filtered = rows.filter(matches);
  filtered.sort((a, b) => (Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id) * (sort === 'oldest' ? 1 : -1));
  const index = id === null ? -1 : filtered.findIndex(row => row.id === id);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = index >= 0 ? Math.floor(index / size) + 1 : Math.min(pages, Math.max(1, Math.trunc(Number(page)) || 1));
  const visible = filtered.slice((current - 1) * size, current * size);
  return { rows: visible, total: filtered.length, pages, page: current, selected: id === null ? visible[0] || null : index >= 0 ? filtered[index] : null, selectionMissing: id !== null && index < 0, q, status, filtersCleared };
}
export const feedbackCounts = rows => Object.fromEntries(FEEDBACK_STATUSES.map(status => [status, rows.filter(row => row.type === 'complaint' && row.status === status).length]));

// Calendar periods use the app's explicit clock in Asia/Manila (UTC+08:00).
// Summary labels map Assigned/Resolved to review/implementation; workflows stay unchanged.
export function feedbackStats(rows, at) {
  const now = Date.parse(at), offset = 8 * 3600000, day = 86400000, local = new Date(now + offset);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  const week = midnight - ((local.getUTCDay() + 6) % 7) * day;
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset;
  const inPeriod = (row, start) => { const created = Date.parse(row.created_at); return created >= start && created <= now; };
  const suggestions = rows.filter(row => row.type === 'suggestion'), general = rows.filter(row => row.type === 'general');
  const ratings = general.map(row => row.rating).filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  return {
    complaint: feedbackCounts(rows),
    suggestion: {
      new: suggestions.filter(row => row.status === 'Pending' && inPeriod(row, week)).length,
      review: suggestions.filter(row => row.status === 'Assigned').length,
      implemented: suggestions.filter(row => row.status === 'Resolved').length,
    },
    general: {
      average: ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)) : null,
      received: general.filter(row => inPeriod(row, month)).length,
      positive: ratings.length ? Math.round(ratings.filter(value => value >= 4).length / ratings.length * 100) : null,
    },
  };
}
