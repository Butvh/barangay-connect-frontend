import { announcementStatus, announcementPublishedAt } from '../core/announcements.js';
/** Legacy and managed announcements share the same public eligibility rules. */
export function latestHomeAnnouncement(rows, now) {
  let latest = null, latestAt = -Infinity;
  for (const row of rows) {
    const publishedAt = Date.parse(announcementPublishedAt(row));
    if (announcementStatus(row, now) !== 'Active') continue;
    if (publishedAt > latestAt || (publishedAt === latestAt && Number(row.id) > Number(latest?.id))) {
      latest = row; latestAt = publishedAt;
    }
  }
  return latest;
}
