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
  const actorKey = () => {
    const actor = auth?.current();
    return actor ? JSON.stringify([actor.id, actor.barangay_id, auth.roleOf?.(actor) || actor.role, actor.session_observation ?? null]) : null;
  };
  const openingActor = demo ? null : actorKey();
  let intent = null, invalidated = false;
  function assertCurrent() {
    if (demo) return;
    if (invalidated || !openingActor || actorKey() !== openingActor) {
      invalidated = true;
      throw new ApiError('AUTH', 'Your session changed. Reopen the form.');
    }
  }
  return Object.freeze({
    assertCurrent,
    async submit(input, write) {
      if (demo) return write(input);
      assertCurrent();
      if (!createIntent) throw new ApiError('NOT_AVAILABLE', 'This operational form is awaiting reviewed integration.');
      intent ||= createIntent({ auth: { current() {
        const actor = auth?.current();
        return actor ? { ...actor, role: auth.roleOf?.(actor) || actor.role } : null;
      } } });
      const pending = intent.prepare(input, observedRevision);
      assertCurrent();
      let result;
      try { result = await write(pending.body, { idempotencyKey: pending.idempotencyKey }); }
      catch (error) { assertCurrent(); throw error; }
      assertCurrent();
      intent.complete();
      return result;
    },
    discard() { intent?.discard(); },
  });
}
