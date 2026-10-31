import { UI } from '../core/ui.js';
import { Fmt } from '../core/format.js';

// The same saved document/review history is visible to its resident and officials.
export function verificationHistory(row) {
  if (!row.history?.length) return '';
  const e = UI.escape;
  return `<details class="verification-history"><summary>Verification history (${row.history.length})</summary><ol>${row.history.map(h => `<li><strong>${e(h.action)}${h.submission_number ? ` · Submission ${e(h.submission_number)}` : ''}</strong><small>${e(Fmt.dateTime(h.at))}${h.actor_name ? ` · ${e(h.actor_name)}` : ''}</small>${h.reason ? `<p>${e(h.reason)}</p>` : ''}${h.file_name ? `<p>${e(h.document_type)}: ${e(h.file_name)}</p>` : ''}</li>`).join('')}</ol></details>`;
}
