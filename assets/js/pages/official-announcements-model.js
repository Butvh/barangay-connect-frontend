import { announcementStatus, announcementPublishedAt } from '../core/announcements.js';
export function announcementPage(rows, { q = '', status = '', page = 1, size = 10, at = Date.now() } = {}) {
  const query = String(q).trim().toLowerCase();
  const filtered = rows.filter(row => (!status || announcementStatus(row, at) === status) && (!query || [row.title, row.content].some(value => String(value || '').toLowerCase().includes(query))));
  filtered.sort((a, b) => Date.parse(announcementPublishedAt(b)) - Date.parse(announcementPublishedAt(a)) || b.id - a.id);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(pages, Math.max(1, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((current - 1) * size, current * size), page: current, pages, total: filtered.length };
}
