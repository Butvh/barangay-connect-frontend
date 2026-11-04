import { Runtime } from './runtime-config.js';
import { UI } from './ui.js';

export const privateDocumentsEnabled = Runtime.mode === 'backend' && Runtime.administrationTest === true;
export function privateDocumentLabel(file, personnel = false) {
  const name = UI.escape(file.name ?? file.original_name ?? 'Document');
  if (!privateDocumentsEnabled || !Number.isSafeInteger(file.id) || file.id < 1) return name;
  const path = personnel ? '/api/v1/personnel/documents/' : '/api/v1/private-documents/';
  return `<a class="private-document-link" href="${path}${file.id}" download>${name}</a>`;
}
