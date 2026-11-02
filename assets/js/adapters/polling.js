import { ApiError } from '../core/config.js';

/** P2 provides scoped revision readers; this module never reads browser storage. */
export function createPolling({ auth, sources = {}, interval = 15000, eventTarget = globalThis.window,
  document = globalThis.document, setIntervalImpl = globalThis.setInterval, clearIntervalImpl = globalThis.clearInterval } = {}) {
  const subscribers = new Map(), revisions = new Map();
  let running = false, stopped = false;
  const controller = new AbortController();
  async function tick() {
    if (running || stopped || document?.hidden || !auth.current()) return;
    running = true;
    try {
      await auth.refresh();
      if (!auth.current() || stopped || auth.error?.()) return;
      for (const [entity, handlers] of subscribers) {
        if (!handlers.size || !sources[entity]) continue;
        const revision = await sources[entity]({ signal: controller.signal });
        if (stopped || !auth.current()) return;
        if (!['string', 'number'].includes(typeof revision) || (typeof revision === 'number' && !Number.isFinite(revision))) continue;
        if (revisions.has(entity) && revisions.get(entity) !== revision) for (const handler of handlers) {
          try { await handler({ entity, revision }); } catch { /* A view refresh failure does not fabricate a revision response. */ }
        }
        revisions.set(entity, revision);
      }
    } catch { /* A failed refresh is not a successful write or a demo fallback. Next poll may recover. */ }
    finally { running = false; }
  }
  const timer = setIntervalImpl(tick, Math.max(5000, interval));
  const leave = event => { if (!event.persisted) destroy(); };
  function destroy() {
    if (stopped) return;
    stopped = true; controller.abort(); clearIntervalImpl(timer); subscribers.clear(); revisions.clear(); offAuth();
    eventTarget?.removeEventListener('pagehide', leave); eventTarget?.removeEventListener('pageshow', tick);
    document?.removeEventListener?.('visibilitychange', tick);
  }
  const offAuth = auth.onChange(() => { if (!auth.current()) revisions.clear(); });
  eventTarget?.addEventListener('pagehide', leave);
  eventTarget?.addEventListener('pageshow', tick);
  document?.addEventListener?.('visibilitychange', tick);
  return Object.freeze({
    subscribe(entity, handler) {
      if (stopped || typeof handler !== 'function') throw new ApiError('NOT_AVAILABLE', 'Refresh is not available.');
      if (!subscribers.has(entity)) subscribers.set(entity, new Set());
      subscribers.get(entity).add(handler);
      return () => subscribers.get(entity)?.delete(handler);
    }, destroy,
  });
}
