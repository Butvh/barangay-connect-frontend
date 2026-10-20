import { Config, ApiError, copy, zonedISO } from './config.js';
import { createSeed } from '../data/seed.js';

const ENTITIES = Object.freeze(['alerts', 'verification', 'announcements', 'feedback', 'notifications', 'users']);
export function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function browserStorage() {
  try { if (globalThis.localStorage) return globalThis.localStorage; } catch { /* file/private contexts */ }
  return memoryStorage();
}
export function createStore({ storage = browserStorage(), eventTarget = globalThis.window, key = Config.storage_key, clock = null, locks = globalThis.navigator?.locks } = {}) {
  const subscribers = new Map(ENTITIES.map(entity => [entity, new Set()]));
  let queue = Promise.resolve();
  function emit(entities = ENTITIES) {
    for (const entity of new Set(entities)) for (const callback of subscribers.get(entity) || []) {
      try { callback({ entity, revision: read().revision }); } catch (error) { console.error('Subscriber failed', error); }
    }
  }
  function persist(db) {
    try { storage.setItem(key, JSON.stringify(db)); }
    catch { throw new ApiError('VALIDATION', 'Demo data could not be saved. Free browser storage and try again.'); }
  }
  function read() {
    let db;
    try { const raw = storage.getItem(key); if (raw) db = JSON.parse(raw); }
    catch { throw new ApiError('VALIDATION', 'Demo storage is unreadable. Use Reset demo data to recover.'); }
    if (!db) { db = createSeed(); db.demo_started_at = Date.now(); persist(db); }
    if (db.version !== Config.schema_version) throw new ApiError('INVALID_STATE', 'This demo data version is unsupported. Reset demo data to continue.');
    return copy(db);
  }
  function currentTime() {
    if (clock) return clock();
    if (!Config.DEMO_MODE) return zonedISO(Date.now());
    const db = read();
    // One reference epoch shared by every tab, even when tabs open minutes apart.
    return zonedISO(Date.parse(Config.demo_time) + Date.now() - (db.demo_started_at || Date.now()));
  }
  async function transact(entities, update) {
    const run = () => {
      const db = read();
      const before = JSON.stringify(db);
      const result = update(db); // No await between fresh read and commit.
      if (result && typeof result.then === 'function') throw new Error('Store updates must be synchronous.');
      // A no-op expiry/read marker must not retrigger a subscribed page forever.
      if (JSON.stringify(db) === before) return copy(result ?? null);
      db.revision += 1; db.updated_at = currentTime(); persist(db); emit(entities);
      return copy(result ?? null);
    };
    // Web Locks serializes writers in separate tabs on localhost / HTTPS.
    const task = () => locks ? locks.request(key, run) : run();
    const pending = queue.then(task, task); queue = pending.catch(() => {}); return pending;
  }
  function subscribe(entity, callback) {
    if (!subscribers.has(entity) || typeof callback !== 'function') throw new Error('Choose a supported subscription entity.');
    subscribers.get(entity).add(callback);
    return () => subscribers.get(entity).delete(callback);
  }
  const onStorage = event => { if (event.key === key || event.key === null) emit(); };
  eventTarget?.addEventListener('storage', onStorage);
  async function reset() {
    const run = () => {
      let revision = 0;
      try { revision = Number(JSON.parse(storage.getItem(key))?.revision) || 0; } catch { /* recover corrupt demo data */ }
      const db = createSeed(); db.demo_started_at = Date.now(); db.revision = revision + 1; db.updated_at = clock ? clock() : Config.demo_time;
      persist(db); emit(); return true;
    };
    const task = () => locks ? locks.request(key, run) : run();
    const pending = queue.then(task, task); queue = pending.catch(() => {}); return pending;
  }
  return Object.freeze({ read, transact, subscribe, reset, now: currentTime, destroy: () => { eventTarget?.removeEventListener('storage', onStorage); subscribers.forEach(set => set.clear()); }, key });
}
export const Store = createStore();
export default Store;
