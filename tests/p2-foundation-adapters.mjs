import { test } from 'node:test';
import assert from 'node:assert/strict';
// Run this integration-only test in the composed P1+DBA+P2 checkout.
import { createP2DomainFactories } from '../assets/js/adapters/p2-registration.js';
import { createOperations } from '../assets/js/adapters/operations.js';
import { createCommunications } from '../assets/js/adapters/communications.js';
import { createReports } from '../assets/js/adapters/reports.js';
import { createRefreshReaders } from '../assets/js/adapters/p2-domains.js';
const p2DomainFactories = createP2DomainFactories({ createOperations, createCommunications, createReports });

test('P1 factories consume envelopes, normalized paths and query objects', async () => {
  const calls = [];
  const http = { request() { throw Error('metadata would be lost'); }, async envelope(...args) {
    calls.push(args); return { data: [], meta: { complete: true, total: 0 } };
  } };
  await p2DomainFactories.alerts({ http }).list({ status: 'Pending', q: 'A-1' });
  assert.equal(calls[0][0], 'alerts');
  assert.deepEqual(calls[0][1].query, { status: 'Pending', q: 'A-1' });
  await assert.rejects(p2DomainFactories.alerts({ http: { envelope: async () => ({ data: [] }) } }).list(), { code: 'CONTRACT' });
});

test('P1 transport preserves retry intent through the shared transport metadata', async () => {
  const calls = [];
  const http = { async envelope(...args) { calls.push(args); return { data: { id: 1 } }; } };
  const api = p2DomainFactories.alerts({ http });
  for (let i = 0; i < 2; i++) await api.create({ victim_count: null }, { idempotencyKey: 'same-intent-01' });
  assert.deepEqual(calls[0][1].body, { victim_count: null });
  assert.equal(calls[0][1].headers['Idempotency-Key'], 'same-intent-01');
  assert.deepEqual(calls[0][1].body, calls[1][1].body);
  await assert.rejects(api.create({}), { code: 'VALIDATION' });
});

test('refresh reader keeps cancellation signal and accepts only scoped scalar revision', async () => {
  const controller = new AbortController();
  let args;
  const source = createRefreshReaders({ http: { async envelope(...value) { args = value; return { data: { revision: 'scope-17' } }; } } }).alerts;
  assert.equal(await source({ signal: controller.signal }), 'scope-17');
  assert.equal(args[0], 'revisions/alerts');
  assert.equal(args[1].signal, controller.signal);
  await assert.rejects(createRefreshReaders({ http: { envelope: async () => ({ data: { revision: {} } }) } }).feedback({}), { code: 'CONTRACT' });
});
