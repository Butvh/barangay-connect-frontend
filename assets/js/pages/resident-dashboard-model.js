/** Existing announcements publish at creation. Optional lifecycle metadata takes precedence. */
export function latestHomeAnnouncement(rows, now) {
  let latest = null, latestAt = -Infinity;
  for (const row of rows) {
    const status = String(row.status ?? 'published').toLowerCase();
    const publishedAt = Date.parse(Object.hasOwn(row, 'published_at') ? row.published_at : row.created_at);
    const expiresAt = row.expires_at == null ? Infinity : Date.parse(row.expires_at);
    if (!['published', 'active'].includes(status) || row.is_published === false || row.retracted_at || row.archived_at) continue;
    if (!Number.isFinite(publishedAt) || publishedAt > now || !(expiresAt > now)) continue;
    if (publishedAt > latestAt || (publishedAt === latestAt && Number(row.id) > Number(latest?.id))) {
      latest = row; latestAt = publishedAt;
    }
  }
  return latest;
}
