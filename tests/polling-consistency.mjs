import assert from 'node:assert/strict';
import { createPolling } from '../assets/js/adapters/polling.js';

function harness(source, handler) {
  let tick, changed, current = { id: 1, barangay_id: 1, role: 'secretary' };
  const polling = createPolling({ auth: { current: () => current, refresh: async () => {}, onChange: fn => { changed = fn; return () => {}; } },
    sources: { alerts: source }, eventTarget: null, document: { hidden: false },
    setIntervalImpl: fn => { tick = fn; return 1; }, clearIntervalImpl() {} });
  polling.subscribe('alerts', handler);
  return { polling, tick: () => tick(), switchAccount: () => { current = { id: 2, barangay_id: 2, role: 'captain' }; changed(); } };
}

let revision = 1, calls = 0, dirty = true;
const deferred = harness(async () => revision, () => { calls++; return !dirty; });
try {
  await deferred.tick(); revision = 2; await deferred.tick();
  dirty = false; await deferred.tick();
  assert.equal(calls, 2, 'A dirty/focused form must be offered the pending revision again after its guard clears.');
  await deferred.tick(); assert.equal(calls, 2);
} finally { deferred.polling.destroy(); }
console.log('PASS deferred dirty/focus guards retain the revision until a successful refresh');

let attempts = 0, fail = true;
const failed = harness(async () => revision, () => { attempts++; if (fail) throw new Error('Refresh unavailable'); });
try {
  await failed.tick(); revision = 3; await failed.tick(); fail = false; await failed.tick();
  assert.equal(attempts, 2, 'A failed view refresh must not consume its revision.');
} finally { failed.polling.destroy(); }
console.log('PASS failed view refreshes do not silently consume a revision');

let finish, signal, events = 0, pending = false;
const switched = harness(async options => { signal = options.signal; return pending ? new Promise(resolve => { finish = resolve; }) : 1; }, () => { events++; });
try {
  await switched.tick(); pending = true;
  const work = switched.tick();
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  switched.switchAccount();
  assert.equal(signal.aborted, true, 'Account switches must cancel in-flight reads.');
  finish(2); await work;
  assert.equal(events, 0, 'An old scoped result must not refresh the new account.');
} finally { switched.polling.destroy(); }
console.log('PASS account switches abort old scoped reads and discard late results');
