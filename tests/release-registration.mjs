import assert from 'node:assert/strict';
import { createAdministrativeFactories } from '../assets/js/adapters/administrative-registration.js';

const actor = { id: 5, barangay_id: 7, role: 'resident' };
const auth = { current: () => actor, roleOf: who => who.role, refresh: async () => {} };
const calls = [];
const http = { async request(path) {
  calls.push(path);
  assert.equal(path, 'profile', 'limited profile must not require full verification integration');
  return { id: 5, verification: { id: 12, review_status: 'Approved', revision: 3 } };
} };
const factories = createAdministrativeFactories({ profileOnly: true });
assert.deepEqual(Object.keys(factories).sort(), ['account', 'barangays', 'users']);
const user = await factories.users({ http, auth }).get(5);
assert.equal(user.verification.review_status, 'Approved');
assert.deepEqual(calls, ['profile']);
await assert.rejects(() => factories.users({ http, auth }).get(99), e => e.code === 'FORBIDDEN');
assert.ok(createAdministrativeFactories().verification, 'original full administrative composition remains available');
console.log('PASS limited release profile uses actual own summary, rejects another user, leaves full administration gated');

