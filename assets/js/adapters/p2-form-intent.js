import { Config, ApiError } from '../core/config.js';

// P1 supplies its existing createSubmissionIntent during reviewed composition.
// No global transport registration, localStorage fallback or duplicate key generator lives here.
let createIntent = null;
export function configureOperationalSubmissions({ createSubmissionIntent }) {
  if (typeof createSubmissionIntent !== 'function') throw new TypeError('P1 submission-intent helper is required.');
  createIntent = createSubmissionIntent;
}

export function createFormSubmission({ auth, revision = null, demo = Config.DEMO_MODE } = {}) {
  const observedRevision = revision;
  let intent = null;
  return Object.freeze({
    async submit(input, write) {
      if (demo) return write(input);
      if (!createIntent) throw new ApiError('NOT_AVAILABLE', 'This operational form is awaiting reviewed integration.');
      intent ||= createIntent({ auth: { current() {
        const actor = auth?.current();
        return actor ? { ...actor, role: auth.roleOf?.(actor) || actor.role } : null;
      } } });
      const pending = intent.prepare(input, observedRevision);
      const result = await write(pending.body, { idempotencyKey: pending.idempotencyKey });
      intent.complete();
      return result;
    },
    discard() { intent?.discard(); },
  });
}
