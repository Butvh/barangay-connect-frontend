import { passwordRequirements, validatePasswordChange } from '../assets/js/core/account-security.js';
import { createApi } from '../assets/js/core/api.js';

export function registerProfileSecurityTests({ test, equal, ok, rejects, fixture }) {
  test('Password policy reports live requirements and distinct field errors without trimming passwords', async () => {
    equal(passwordRequirements('abc'), [false, false, true, false]);
    equal(passwordRequirements('Strong123'), [true, true, true, true]);
    for (const input of [{}, { current_password: 'Old12345', password: 'short', password_confirmation: 'short' }, { current_password: 'Strong123', password: 'Strong123', password_confirmation: 'Strong123' }, { current_password: 'Old12345', password: 'Strong123', password_confirmation: 'different' }]) await rejects(() => validatePasswordChange(input), 'VALIDATION');
    equal(validatePasswordChange({ current_password: ' Old12345 ', password: ' New12345 ', password_confirmation: ' New12345 ' }).password, ' New12345 ');
  });
  test('Demo password changes fail closed and never mutate stored credentials or data', async () => {
    const f = fixture(); await f.login(f.authA, 'maria.santos'); const before = f.storage.getItem('barangay-connect:data:v1');
    equal((await f.apiA.account.security()).password_change_available, false);
    await rejects(() => f.apiA.account.changePassword({ current_password: 'demo1234', password: 'Fictional123', password_confirmation: 'Fictional123' }), 'NOT_AVAILABLE');
    equal(f.storage.getItem('barangay-connect:data:v1'), before);
    ok(!JSON.stringify(f.storeA.read()).includes('Fictional123'));
  });
  test('Future secure transport receives validated credentials without browser-store writes; malformed success is rejected', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const before = f.storeA.read(); let calls = 0;
    const api = createApi({ store: f.storeA, auth: f.authA, wait: async () => {}, accountTransport: { changePassword: async input => { calls++; equal(input.password, 'Fictional123'); return { password_changed: true }; } } });
    equal((await api.account.security()).password_change_available, true);
    equal((await api.account.changePassword({ current_password: 'demo1234', password: 'Fictional123', password_confirmation: 'Fictional123' })).password_changed, true);
    equal(calls, 1); equal(f.storeA.read(), before);
    const broken = createApi({ store: f.storeA, auth: f.authA, accountTransport: { changePassword: async () => ({}) } });
    await rejects(() => broken.account.changePassword({ current_password: 'demo1234', password: 'Fictional123', password_confirmation: 'Fictional123' }), 'SERVER');
  });
  test('All four officials can update only their own name/contact without altering assignments or household records', async () => {
    for (const who of ['ana.reyes', 'roberto.aquino', 'carlo.mendoza', 'ramon.bautista']) {
      const f = fixture(); await f.login(f.authA, who); const person = f.authA.current(), before = f.storeA.read();
      const updated = await f.apiA.users.update(person.id, { full_name: ' Updated Name ', contact_number: '09171234567' });
      equal(updated.full_name, 'Updated Name'); equal(f.storeA.read().households, before.households);
      for (const patch of [{ is_captain: true }, { barangay_id: 2 }, { email: 'changed@example.com' }, { personnel_status: 'Inactive' }, { address: 'Changed household' }, { map_x: 99 }]) await rejects(() => f.apiA.users.update(person.id, patch), 'VALIDATION');
      await rejects(() => f.apiA.users.update(5, { full_name: 'Other resident' }), 'FORBIDDEN');
    }
  });
  test('Password API requires a current authenticated account and profile views never expose password fields', async () => {
    const f = fixture(); await rejects(() => f.apiA.account.security(), 'AUTH');
    await rejects(() => f.apiA.account.changePassword({}), 'AUTH');
    await f.login(f.authA, 'carlo.mendoza'); const person = await f.apiA.users.get(2); ok(!('password' in person));
  });
}
