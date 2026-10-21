import { UI, Fmt, e, dialog } from './official-shared.js';

export const announcementAuthor = row => row.author ? `${row.author.is_secretary ? 'Secretary ' : ''}${row.author.full_name}` : 'Barangay official';
export function readAnnouncement(row, onClose = () => {}) {
  const el = dialog('Announcement', `<article class="stack official-announcement-detail"><h3>${e(row.title)}</h3><small>${e(announcementAuthor(row))} · ${e(Fmt.dateTime(row.created_at))}</small><p class="official-long-copy">${e(row.content)}</p><button type="button" class="btn" data-done>Done</button></article>`);
  el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
  el.addEventListener('close', onClose, { once: true }); return el;
}
