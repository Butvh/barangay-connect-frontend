import { ApiError, copy } from '../core/config.js';

/** Form-owned memory only. Create once per dialog; complete only after confirmed server success. */
export function createSubmissionIntent({ auth, allowAnonymous = false, keyFactory = () => globalThis.crypto.randomUUID() } = {}) {
  let pending = null;
  const actorKey = () => {
    const actor = auth?.current();
    // Resident registration has no actor yet. This is only a browser concurrency
    // observation; the public endpoint independently enforces guest-only creation.
    if (!actor && allowAnonymous) return 'signed-out-registration';
    if (!actor || !Number.isSafeInteger(actor.id) || !Number.isSafeInteger(actor.barangay_id) || !actor.role) throw new ApiError('AUTH', 'Sign in before submitting.');
    return `${actor.id}:${actor.barangay_id}:${actor.role}:${actor.session_observation || ''}`;
  };
  function canonical(value) {
    if (value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) return value;
    if (Array.isArray(value)) return value.map(canonical);
    if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    throw new ApiError('VALIDATION', 'Prepare uploaded files through the private upload contract first.');
  }
  function retry() {
    if (!pending) throw new ApiError('INVALID_STATE', 'There is no pending submission.');
    if (actorKey() !== pending.actor) throw new ApiError('AUTH', 'Your account changed. Reopen the form.');
    return copy({ idempotencyKey: pending.key, body: pending.body });
  }
  return Object.freeze({
    prepare(input, expectedRevision = null) {
      const actor = actorKey();
      if (!input || Object.getPrototypeOf(input) !== Object.prototype || (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0))) throw new ApiError('VALIDATION', 'Use the revision shown when the form opened.');
      if (Object.hasOwn(input, 'expected_revision') && input.expected_revision !== expectedRevision) throw new ApiError('CONFLICT', 'The form revision changed. Review before starting a new submission.');
      const body = canonical({ ...input, ...(expectedRevision === null ? {} : { expected_revision: expectedRevision }) });
      const signature = JSON.stringify(body);
      if (pending && (pending.actor !== actor || pending.signature !== signature)) throw new ApiError('CONFLICT', 'Review or cancel the pending submission before changing it.');
      if (!pending) {
        const key = keyFactory();
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new ApiError('VALIDATION', 'A valid submission key is required.');
        pending = { actor, key, body, signature };
      }
      return retry();
    }, retry,
    complete() { pending = null; },
    discard() { pending = null; },
  });
}
