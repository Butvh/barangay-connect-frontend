import { ApiError } from '../core/config.js';

// JSON administrative creates share the existing form-owned intent primitive.
export async function submitAdministrative({ http, path, input, intent }) {
  if (!intent?.prepare || !intent?.complete) throw new ApiError('NOT_AVAILABLE', 'Reopen the form to prepare the original command.');
  const command = intent.prepare(input);
  try {
    const result = await http.request(path, { method: 'POST', body: command.body, headers: { 'Idempotency-Key': command.idempotencyKey } });
    intent.retry(); // Reject a late result after the form's observed account changed.
    intent.complete();
    return result;
  } catch (error) {
    // A confirmed validation failure has no source mutation. Corrected input
    // starts a new intent; ambiguous transport failures retain the original key.
    if (error.status === 422) intent.discard();
    throw error;
  }
}
