export const announcementPublishedAt = row => Object.hasOwn(row, 'published_at') ? row.published_at : row.created_at;
export function announcementStatus(row, at) {
  const now = typeof at === 'number' ? at : Date.parse(at), status = String(row.status ?? 'Active').toLowerCase();
  if (status === 'retracted' || row.retracted_at) return 'Retracted';
  if (status === 'archived' || row.archived_at) return 'Archived';
  const published = Date.parse(announcementPublishedAt(row)), expires = row.expires_at == null ? Infinity : Date.parse(row.expires_at);
  if (!['active', 'published'].includes(status) || row.is_published === false || !Number.isFinite(published) || published > now || Number.isNaN(expires)) return 'Unpublished';
  return expires <= now ? 'Archived' : 'Active';
}
export function nextAnnouncementExpiry(rows, at) {
  const times = rows.filter(row => announcementStatus(row, at) === 'Active' && row.expires_at).map(row => Date.parse(row.expires_at));
  return times.length ? Math.min(...times) : null;
}
