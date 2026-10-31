export { VERIFICATION_STATUSES } from '../core/verification.js';
const day = at => { const ms = Date.parse(at); return Number.isFinite(ms) ? new Date(ms + 8 * 3600000).toISOString().slice(0, 10) : ''; };
export const reviewable = (record, at) => record?.review_status === 'Pending' && Number.isFinite(Date.parse(record.deadline_at)) && Date.parse(record.deadline_at) >= Date.parse(at);
export function verificationStats(rows, at) {
  const today = day(at);
  return { pending: rows.filter(r => r.review_status === 'Pending').length, due: rows.filter(r => r.review_status === 'Pending' && day(r.deadline_at) === today).length, reviewed: rows.filter(r => ['Approved', 'Rejected'].includes(r.review_status) && day(r.reviewed_at) === today).length };
}
export function verificationPage(rows, { q = '', status = '', sort = 'newest', page = 1, size = 10 } = {}) {
  const query = String(q).trim().toLowerCase();
  const filtered = rows.filter(r => (!status || r.review_status === status) && (!query || [r.resident?.full_name, r.household?.address].some(value => String(value || '').toLowerCase().includes(query))));
  filtered.sort((a, b) => (Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id) * (sort === 'oldest' ? 1 : -1));
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(pages, Math.max(1, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((current - 1) * size, current * size), page: current, pages, total: filtered.length };
}
