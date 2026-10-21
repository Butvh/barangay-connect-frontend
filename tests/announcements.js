import { announcementStatus } from '../assets/js/core/announcements.js';
import { announcementPage } from '../assets/js/pages/official-announcements-model.js';

export function registerAnnouncementTests({ test, equal, ok, rejects, fixture }) {
  const at = '2026-10-04T14:20:00+08:00';
  test('announcement status preserves legacy publication and expires at the exact deadline', () => {
    const row = { created_at: '2026-10-04T12:00:00+08:00' };
    equal(announcementStatus(row, at), 'Active');
    equal(announcementStatus({ ...row, expires_at: at }, at), 'Archived');
    equal(announcementStatus({ ...row, status: 'Retracted', expires_at: at }, at), 'Retracted');
    for (const patch of [{ published_at: null }, { published_at: 'invalid' }, { published_at: '2026-10-05T12:00:00+08:00' }, { is_published: false }, { status: 'Draft' }, { expires_at: 'invalid' }]) equal(announcementStatus({ ...row, ...patch }, at), 'Unpublished');
  });
  test('announcement search combines status and content with immutable date-sorted pagination', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, title: `Update ${i}`, content: i ? 'Community meeting' : 'Flood preparation', status: i === 0 ? 'Archived' : 'Active', created_at: at }));
    const before = JSON.stringify(rows), page = announcementPage(rows, { page: 2, size: 10, at });
    equal([page.total, page.page, page.pages, page.rows.map(r => r.id)], [12, 2, 2, [2, 1]]);
    equal(announcementPage(rows, { q: ' FLOOD ', status: 'Archived', page: 8, at }).rows.map(r => r.id), [1]);
    equal(announcementPage(rows, { q: 'Flood', status: 'Active', at }).total, 0);
    equal(JSON.stringify(rows), before);
  });
  test('new announcements persist expiry, immutable publication identity and publication history', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    const row = await f.apiA.announcements.create({ title: ' Advisory ', content: ' Community update. ', expires_at: '2026-10-05T14:20:00+08:00' });
    equal([row.status, row.title, row.published_at, row.expires_at, row.posted_by], ['Active', 'Advisory', at, '2026-10-05T14:20:00.000+08:00', 1]);
    equal(row.history.map(h => [h.action, h.by, h.title, h.content]), [['Published', 1, 'Advisory', 'Community update.']]);
    equal((await f.apiA.announcements.get(row.id)).status, 'Active');
  });
  test('announcement creation and editing reject invalid expiry and preserve records on validation failure', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    for (const expires_at of ['invalid', at, '2026-10-03T10:00:00+08:00', '2026-10-05T12:00']) {
      const before = f.storeA.read(); await rejects(() => f.apiA.announcements.create({ title: 'Update', content: 'Details', expires_at }), 'VALIDATION'); equal(f.storeA.read(), before);
    }
    for (const patch of [{ title: ' ' }, { content: '' }, { title: 'x'.repeat(201) }, { content: 'x'.repeat(5001) }, { expires_at: at }]) {
      const before = f.storeA.read(); await rejects(() => f.apiA.announcements.update(1, patch), 'VALIDATION'); equal(f.storeA.read(), before);
    }
  });
  test('editing retains original publication and author while appending complete content history', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const before = await f.apiA.announcements.get(1);
    const row = await f.apiA.announcements.update(1, { title: 'Edited title', content: 'Edited full content', posted_by: 99, created_at: at, status: 'Retracted', barangay_id: 2 });
    equal([row.title, row.content, row.created_at, row.published_at, row.posted_by, row.barangay_id, row.status], ['Edited title', 'Edited full content', before.created_at, before.created_at, before.posted_by, 1, 'Active']);
    equal(row.history.map(h => [h.action, h.title]), [['Published', before.title], ['Edited', 'Edited title']]);
    equal(row.history[0].content, before.content); equal(row.history[1].content, 'Edited full content');
    equal(row.updated_at, at);
  });
  test('archiving preserves records and makes public list and direct detail unavailable', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'maria.santos');
    const length = f.storeA.read().announcements.length; let changes = 0; f.apiB.subscribe('announcements', () => changes++);
    const row = await f.apiA.announcements.archive(1);
    equal([row.status, row.archived_at, row.history.at(-1).action], ['Archived', at, 'Archived']);
    equal(f.storeA.read().announcements.length, length); equal((await f.apiB.announcements.list()).map(r => r.id), [2]);
    await rejects(() => f.apiB.announcements.get(1), 'NOT_FOUND'); ok(changes > 0);
    equal((await f.apiA.announcements.list()).length, length);
    await rejects(() => f.apiA.announcements.update(1, { title: 'Restore' }), 'INVALID_STATE');
    await rejects(() => f.apiA.announcements.archive(1), 'INVALID_STATE');
  });
  test('retraction requires a trimmed reason within 500 characters and cannot restore or repeat', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'maria.santos');
    for (const reason of ['', '  ', 'x'.repeat(501)]) { const before = f.storeA.read(); await rejects(() => f.apiA.announcements.retract(1, { reason }), 'VALIDATION'); equal(f.storeA.read(), before); }
    const row = await f.apiA.announcements.retract(1, { reason: ' Incorrect information. ' });
    equal([row.status, row.retraction_reason, row.retracted_at, row.retracted_by], ['Retracted', 'Incorrect information.', at, 1]);
    equal([row.history.at(-1).action, row.history.at(-1).reason], ['Retracted', 'Incorrect information.']);
    await rejects(() => f.apiA.announcements.retract(1, { reason: 'Again' }), 'INVALID_STATE');
    await rejects(() => f.apiA.announcements.update(1, { content: 'Restore' }), 'INVALID_STATE');
    equal((await f.apiB.announcements.list()).map(r => r.id), [2]); await rejects(() => f.apiB.announcements.get(1), 'NOT_FOUND');
  });
  test('expiry hides public rows before maintenance and automatic archive persists exactly once', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'maria.santos');
    const row = await f.apiA.announcements.create({ title: 'Timed', content: 'Expires soon', expires_at: '2026-10-04T14:21:00+08:00' });
    f.setTime('2026-10-04T14:21:00+08:00');
    ok(!(await f.apiB.announcements.list()).some(a => a.id === row.id));
    await rejects(() => f.apiB.announcements.get(row.id), 'NOT_FOUND');
    equal(await f.apiA.announcements.expireOverdue(), 1); const saved = await f.apiA.announcements.get(row.id);
    equal([saved.status, saved.history.at(-1).action, saved.history.at(-1).by], ['Archived', 'Expired', null]);
    const before = f.storeA.read(); equal(await f.apiA.announcements.expireOverdue(), 0); equal(f.storeA.read(), before);
  });
  test('announcement management is Secretary-only and isolated to the signed-in barangay', async () => {
    const f = fixture();
    const actions = api => [() => api.announcements.update(1, { title: 'Edit' }), () => api.announcements.archive(1), () => api.announcements.retract(1, { reason: 'Reason' }), () => api.announcements.expireOverdue()];
    for (const action of actions(f.apiA)) await rejects(action, 'AUTH');
    for (const name of ['maria.santos', 'carlo.mendoza', 'ramon.bautista']) { await f.login(f.authA, name); const before = f.storeA.read(); for (const action of actions(f.apiA)) await rejects(action, 'FORBIDDEN'); equal(f.storeA.read(), before); }
    await f.storeA.transact([], db => db.users.push({ ...db.users[0], id: 99, email: 'other.secretary@example.com', barangay_id: 2 }));
    await f.login(f.authA, 'other.secretary'); const before = f.storeA.read();
    for (const action of actions(f.apiA).slice(0, 3)) await rejects(action, 'FORBIDDEN');
    equal(await f.apiA.announcements.expireOverdue(), 0); equal(f.storeA.read(), before);
  });
  test('public announcement reads never expose management history and reloads retain saved state', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'maria.santos');
    await f.apiA.announcements.update(1, { title: 'Saved edit' });
    const publicRow = await f.apiB.announcements.get(1); equal(publicRow.title, 'Saved edit'); ok(!Object.hasOwn(publicRow, 'history')); ok(!Object.hasOwn(publicRow.author, 'password'));
    await f.apiA.announcements.archive(1); const reread = await f.apiA.announcements.get(1); equal(reread.status, 'Archived'); equal(reread.history.length, 3);
  });
  test('stale announcement editors and confirmations cannot overwrite a newer revision', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'ana.reyes');
    const old = await f.apiA.announcements.get(1);
    await f.apiB.announcements.update(1, { title: 'Newer title', expected_revision: old.revision });
    const before = f.storeA.read();
    await rejects(() => f.apiA.announcements.update(1, { title: 'Old draft', expected_revision: old.revision }), 'CONFLICT');
    await rejects(() => f.apiA.announcements.archive(1, { expected_revision: old.revision }), 'CONFLICT');
    await rejects(() => f.apiA.announcements.retract(1, { reason: 'Old confirmation', expected_revision: old.revision }), 'CONFLICT');
    equal(f.storeA.read(), before);
  });
}
