import { ApiError } from '../core/config.js';
import { createFormSubmission } from './p2-form-intent.js';

/** Optional details-only upload; shared P1 intent/transport remain the authority. */
export function createPhotoUpload({ auth }) {
  const submission = createFormSubmission({ auth, demo: false });
  let original = null, digest = null, receipt = null, sending = null;
  const assertObserved = submission.assertCurrent;
  return Object.freeze({
    async stage(file, upload) {
      assertObserved();
      if (original && file !== original) throw new ApiError('CONFLICT', 'Reopen the details form before changing a pending photo.');
      if (!(file instanceof Blob) || !['image/png', 'image/jpeg'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new ApiError('VALIDATION', 'Choose a JPG or PNG up to 10 MB.');
      if (typeof upload !== 'function') throw new ApiError('NOT_AVAILABLE', 'Private uploads are awaiting reviewed integration.');
      original ||= file;
      if (receipt) return receipt;
      if (sending) return sending;
      sending = (async () => {
        digest ||= Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await original.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
        assertObserved();
        const result = await submission.submit({ sha256: digest, bytes: original.size }, async (_, intent) => {
          assertObserved();
          const result = await upload(original, intent);
          assertObserved();
          if (!result || Object.keys(result).sort().join(',') !== 'bytes,expires_at,mime,upload_id' ||
              !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(result.upload_id) ||
              !['image/png', 'image/jpeg'].includes(result.mime) || !Number.isSafeInteger(result.bytes) || result.bytes < 1 ||
              result.bytes > 10 * 1024 * 1024 || !Number.isFinite(Date.parse(result.expires_at))) throw new ApiError('CONTRACT', 'The service returned an invalid private upload receipt.');
          // Retain the confirmed receipt before the shared helper completes its key.
          // A later account switch can deny this result without causing a second upload.
          receipt = Object.freeze({ ...result });
          return receipt;
        });
        assertObserved();
        return result;
      })();
      try { return await sending; } finally { sending = null; }
    },
  });
}
