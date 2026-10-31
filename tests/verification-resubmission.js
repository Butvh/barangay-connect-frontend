import { VERIFICATION_STATUSES, verificationStats, verificationPage, reviewable } from '../assets/js/pages/official-verification-model.js';
import { UI } from '../assets/js/core/ui.js';

export function registerVerificationResubmissionTests({ test, equal, ok, rejects, fixture }) {
  const request = (api, revision = 0, reason = 'Upload a readable proof showing your complete address.') => api.verification.review(2, { decision: 'Resubmission requested', reason, expected_revision: revision });
  test('Resubmission request is a distinct nonfinal status with a reason, actor and original submission history', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    const before = f.storeA.read().verify_residency.length;
    const row = await request(f.apiA, 0, '  Replace the blurred proof.  ');
    equal([row.id, row.review_status, row.resubmission_reason, row.reviewed_by, row.revision], [2, 'Resubmission requested', 'Replace the blurred proof.', 1, 1]);
    equal(f.storeA.read().verify_residency.length, before);
    equal(row.history.map(h => h.action), ['Submitted', 'Resubmission requested']);
    equal(row.history[0].file_name, 'jose-proof-of-residence.pdf'); equal(row.history[1].reason, 'Replace the blurred proof.');
    ok(VERIFICATION_STATUSES.includes(row.review_status)); ok(UI.badge(row.review_status).includes('badge-amber')); ok(!reviewable(row, row.reviewed_at));
  });
  test('Correction requests validate reasons atomically', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const before = f.storeA.read();
    for (const reason of ['', ' \n ', 'x'.repeat(1001)]) { await rejects(() => request(f.apiA, 0, reason), 'VALIDATION'); equal(f.storeA.read(), before); }
  });
  test('Captain can request correction, resident replaces files on the same application, and approval unlocks SOS', async () => {
    const f = fixture(); await f.login(f.authA, 'roberto.aquino'); await f.login(f.authB, 'jose.dela.cruz');
    let refreshes = 0; f.apiB.subscribe('verification', () => refreshes++);
    const requested = await request(f.apiA); await rejects(() => f.apiB.alerts.create({}), 'FORBIDDEN');
    const notices = await f.apiB.notifications.list(); const notice = notices.find(n => n.title === 'Verification resubmission requested');
    ok(notice); equal(notice.description, requested.resubmission_reason); equal(notice.link, 'resident-verification.html');
    f.setTime('2026-10-05T10:00:00+08:00');
    const row = await f.apiB.verification.submit(5, { verification_id: 2, expected_revision: 1, document_type: 'Valid ID and proof of residence', file_name: 'corrected-id.pdf; corrected-proof.png' });
    equal([row.id, row.review_status, row.submission_number, row.revision], [2, 'Pending', 2, 2]); equal(row.reviewed_by, null); equal(row.resubmission_reason, '');
    equal(Date.parse(row.deadline_at) - Date.parse(row.submitted_at), 7 * 86400000); equal(row.history.map(h => h.action), ['Submitted', 'Resubmission requested', 'Resubmitted']);
    equal(row.history[0].file_name, 'jose-proof-of-residence.pdf'); equal(row.history.at(-1).file_name, 'corrected-id.pdf; corrected-proof.png');
    equal(f.storeA.read().verify_residency.length, 2); ok(refreshes >= 2);
    equal((await f.apiA.verification.get(2)).file_name, row.file_name); equal((await f.apiA.verification.list({ status: 'Pending' })).length, 1);
    await f.apiA.verification.review(2, { decision: 'Approved', expected_revision: 2 });
    equal((await f.apiB.users.get(5)).verification.review_status, 'Approved'); equal((await f.apiB.alerts.create({})).status, 'Pending');
  });
  test('Repeated correction cycles preserve each document version and review reason without duplicate applications', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'jose.dela.cruz');
    await request(f.apiA); await f.apiB.verification.submit(5, { expected_revision: 1, file_name: 'version-2.pdf', document_type: 'Proof' });
    await request(f.apiA, 2, 'The address is still cropped.');
    const row = await f.apiB.verification.submit(5, { expected_revision: 3, file_name: 'version-3.pdf', document_type: 'Proof' });
    equal(row.history.filter(h => ['Submitted', 'Resubmitted'].includes(h.action)).map(h => h.file_name), ['jose-proof-of-residence.pdf', 'version-2.pdf', 'version-3.pdf']);
    equal(row.history.filter(h => h.action === 'Resubmission requested').map(h => h.reason), ['Upload a readable proof showing your complete address.', 'The address is still cropped.']);
    equal(row.submission_number, 3); equal(f.storeA.read().verify_residency.length, 2);
  });
  test('Awaiting corrections does not expire; corrected submission begins a fresh review window', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'jose.dela.cruz'); await request(f.apiA);
    f.setTime('2026-10-20T10:00:00+08:00'); await f.apiA.verification.expireOverdue(); equal((await f.apiB.verification.get(2)).review_status, 'Resubmission requested');
    const row = await f.apiB.verification.submit(5, { expected_revision: 1, document_type: 'Proof', file_name: 'later-correction.pdf' });
    equal(row.deadline_at, '2026-10-27T10:00:00.000+08:00');
  });
  test('Finalized and awaiting-correction records cannot receive additional review decisions', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    await rejects(() => f.apiA.verification.review(1, { decision: 'Resubmission requested', reason: 'Replace.' }), 'INVALID_STATE');
    await request(f.apiA); const before = f.storeA.read();
    for (const decision of ['Approved', 'Rejected', 'Resubmission requested']) { await rejects(() => f.apiA.verification.review(2, { decision, reason: 'Replace.', expected_revision: 1 }), 'INVALID_STATE'); equal(f.storeA.read(), before); }
    await f.login(f.authB, 'jose.dela.cruz'); await f.apiB.verification.submit(5, { document_type: 'Proof', file_name: 'corrected.pdf', expected_revision: 1 });
    await f.apiA.verification.review(2, { decision: 'Rejected', reason: 'Does not establish residency.', expected_revision: 2 });
    await rejects(() => request(f.apiA, 3), 'INVALID_STATE');
  });
  test('Stale review and duplicate corrected submission cannot overwrite a newer document revision', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); await f.login(f.authB, 'jose.dela.cruz'); await request(f.apiA);
    const input = { verification_id: 2, expected_revision: 1, document_type: 'Proof', file_name: 'corrected.pdf' };
    const results = await Promise.allSettled([f.apiB.verification.submit(5, input), f.apiB.verification.submit(5, input)]); equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const before = f.storeA.read(); await rejects(() => f.apiA.verification.review(2, { decision: 'Approved', expected_revision: 0 }), 'CONFLICT'); equal(f.storeA.read(), before);
    await rejects(() => f.apiB.verification.submit(5, { ...input, verification_id: 999, expected_revision: 2 }), 'CONFLICT');
  });
  test('Only in-barangay Secretary/Captain may request corrections and residents submit only their own documents', async () => {
    const f = fixture();
    for (const who of ['jose.dela.cruz', 'carlo.mendoza', 'ramon.bautista']) { await f.login(f.authA, who); const before = f.storeA.read(); await rejects(() => request(f.apiA), 'FORBIDDEN'); equal(f.storeA.read(), before); }
    await f.login(f.authA, 'maria.santos'); await rejects(() => f.apiA.verification.submit(5, { document_type: 'Proof', file_name: 'wrong.pdf' }), 'FORBIDDEN');
    await f.storeA.transact(['users'], db => db.users.push({ ...db.users[0], id: 50, barangay_id: 2, email: 'foreign@example.com' }));
    await f.authA.login('foreign@example.com', 'demo1234'); await rejects(() => request(f.apiA), 'FORBIDDEN');
  });
  test('Resubmission status filters correctly without inflating completed review counts or dashboards', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes'); const before = await f.apiA.dashboard.officialStats(); await request(f.apiA);
    const rows = await f.apiA.verification.list(); equal(verificationPage(rows, { status: 'Resubmission requested' }).rows.map(r => r.id), [2]);
    equal(verificationStats(rows, '2026-10-04T14:30:00+08:00').reviewed, 0); equal((await f.apiA.dashboard.officialStats()).pending_verifications, before.pending_verifications - 1);
    await f.login(f.authA, 'roberto.aquino'); const snapshot = await f.apiA.reports.snapshot();
    ok(snapshot.activity_logs.some(r => r.action === 'Verification resubmission requested' && r.record_id === 2));
  });
}
