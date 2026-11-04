import { ApiError } from '../core/config.js';

// Reuses the shared form-owned intent. Actual bytes stay in File objects and
// FormData; only input fingerprints enter the transient canonical intent.
export async function submitPrivateDocuments({ http, auth, path, fields, files, intent, cryptoImpl = globalThis.crypto }) {
  const identity = () => { const u = auth.current(); return u ? `${u.id}:${u.barangay_id}:${u.role}` : null; };
  const original = identity();
  if (!original) throw new ApiError('AUTH', 'Sign in before uploading.');
  if (!intent?.prepare || !intent?.complete || !cryptoImpl?.subtle) throw new ApiError('NOT_AVAILABLE', 'Reopen the form to prepare a secure upload.');
  const manifest = [];
  for (const [field, file, limit] of files) {
    if (!(file instanceof Blob) || typeof file.name !== 'string' || file.size < 1 || file.size > limit) throw new ApiError('VALIDATION', 'Choose actual supported documents within the file limits.');
    const bytes = await file.arrayBuffer();
    const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
    manifest.push({ field, name: file.name, size: file.size, sha256: [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('') });
  }
  if (identity() !== original) throw new ApiError('AUTH', 'Your account changed. Reopen the upload form.');
  const command = intent.prepare({ path, ...fields, files: manifest }, fields.expected_revision ?? null);
  const body = new FormData();
  for (const [field, value] of Object.entries(fields)) if (value !== undefined && value !== null) body.append(field, String(value));
  for (const [field, file] of files) body.append(field, file, file.name);
  let result;
  try { result = await http.request(path, { method: 'POST', body, headers: { 'Idempotency-Key': command.idempotencyKey } }); }
  catch (error) { if (error.status === 422) intent.discard(); throw error; }
  if (identity() !== original) throw new ApiError('AUTH', 'Your account changed. Check the original submission after signing in.');
  intent.complete();
  return result;
}
