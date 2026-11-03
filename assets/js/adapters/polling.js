import { ApiError } from '../core/config.js';

/** P2 provides scoped revision readers; this module never reads browser storage. */
export function createPolling({ auth, sources = {}, interval = 15000, eventTarget = globalThis.window,
  document = globalThis.document, setIntervalImpl = globalThis.setInterval, clearIntervalImpl = globalThis.clearInterval } = {}) {
  const subscribers = new Map(), revisions = new Map();
  let running = false, stopped = false, controller = null;
  const identityKey = () => { const user = auth.current(); return user ? `${user.id}:${user.barangay_id}:${user.role}` : null; };
  let observedIdentity = identityKey();
  async function tick() {
    if (running || stopped || document?.hidden || !auth.current()) return;
    running = true;
    const identity = identityKey(), active = new AbortController(); controller = active;
    try {
      await auth.refresh();
      if (!auth.current() || stopped || auth.error?.() || active.signal.aborted || identityKey() !== identity) return;
      for (const [entity, handlers] of subscribers) {
        if (!handlers.size || !sources[entity]) continue;
        const revision = await sources[entity]({ signal: active.signal });
        if (stopped || active.signal.aborted || identityKey() !== identity) return;
        if (!['string', 'number'].includes(typeof revision) || (typeof revision === 'number' && !Number.isFinite(revision))) continue;
        let applied = true;
        if (revisions.has(entity) && revisions.get(entity) !== revision) for (const handler of handlers) {
          if (active.signal.aborted || identityKey() !== identity) return;
          try { if (await handler({ entity, revision, signal: active.signal }) === false) applied = false; }
          catch { applied = false; }
        }
        if (active.signal.aborted || identityKey() !== identity) return;
        if (applied) revisions.set(entity, revision);
      }
    } catch { /* A failed refresh is not a successful write or a demo fallback. Next poll may recover. */ }
    finally { running = false; if (controller === active) controller = null; }
  }
  const timer = setIntervalImpl(tick, Math.max(5000, interval));
  const leave = event => { if (!event.persisted) destroy(); };
  function destroy() {
    if (stopped) return;
    stopped = true; controller?.abort(); clearIntervalImpl(timer); subscribers.clear(); revisions.clear(); offAuth();
    eventTarget?.removeEventListener('pagehide', leave); eventTarget?.removeEventListener('pageshow', tick);
    document?.removeEventListener?.('visibilitychange', tick);
  }
  const offAuth = auth.onChange(() => {
    const nextIdentity = identityKey();
    if (observedIdentity !== nextIdentity) { controller?.abort(); revisions.clear(); observedIdentity = nextIdentity; }
  });
  eventTarget?.addEventListener('pagehide', leave);
  eventTarget?.addEventListener('pageshow', tick);
  document?.addEventListener?.('visibilitychange', tick);
  return Object.freeze({
    subscribe(entity, handler) {
      if (stopped || typeof handler !== 'function' || typeof sources[entity] !== 'function') throw new ApiError('NOT_AVAILABLE', 'This refresh reader is awaiting integration.');
      if (!subscribers.has(entity)) subscribers.set(entity, new Set());
      subscribers.get(entity).add(handler);
      return () => {
        subscribers.get(entity)?.delete(handler);
        if (![...subscribers.values()].some(handlers => handlers.size)) controller?.abort();
      };
    }, destroy,
  });
}
