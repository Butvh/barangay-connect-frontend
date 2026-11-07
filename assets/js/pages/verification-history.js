import { UI } from '../core/ui.js';
import { Fmt } from '../core/format.js';
import { privateDocumentsEnabled, privateDocumentLabel } from '../core/private-documents.js';

export function verificationDocuments(row) {
  if (!privateDocumentsEnabled) return null;
  const e = UI.escape;
  return `<header class="spread"><div class="official-section"><h2>${e(row.document_type)}</h2><small>Private supporting documents</small></div></header><div class="official-document-preview">${row.documents?.length ? row.documents.map(file => `<p>${privateDocumentLabel(file)} · ${e(file.kind === 'valid_id' ? 'Valid ID' : 'Proof of residence')}</p>`).join('') : '<p>No private document is available for this recorded submission.</p>'}</div><hr class="divider"><p class="caption">Downloads require your current verification access.</p>`;
}

// The same saved document/review history is visible to its resident and officials.
export function verificationHistory(row) {
  if (!row.history?.length) return '';
  const e = UI.escape;
  return `<details class="verification-history"><summary>Verification history (${row.history.length})</summary><ol>${row.history.map(h => `<li><strong>${e(h.action)}${h.submission_number ? ` · Submission ${e(h.submission_number)}` : ''}</strong><small>${e(Fmt.dateTime(h.at))}${h.actor_name ? ` · ${e(h.actor_name)}` : ''}</small>${h.reason ? `<p>${e(h.reason)}</p>` : ''}${h.file_name ? `<p>${e(h.document_type)}: ${e(h.file_name)}</p>` : ''}</li>`).join('')}</ol></details>`;
}
