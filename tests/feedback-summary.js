import * as model from '../assets/js/pages/official-feedback-model.js';

export function registerFeedbackSummaryTests({ test, equal, fixture }) {
  const stats = (rows, at = '2026-10-04T14:10:00+08:00') => model.feedbackStats(rows, at);
  const suggestion = (status, created_at) => ({ type: 'suggestion', status, created_at });
  const general = (rating, created_at = '2026-10-04T10:00:00+08:00') => ({ type: 'general', rating, created_at });

  test('feedback summaries isolate categories and map supported suggestion statuses without mutating records', () => {
    const rows = [suggestion('Pending', '2026-10-04T09:00:00+08:00'), suggestion('Assigned'), suggestion('Resolved'), { type: 'complaint', status: 'Pending', rating: 1 }, general(4), general(5), general(4, '2026-09-28T10:00:00+08:00')];
    const before = JSON.stringify(rows), value = stats(rows);
    equal(value.complaint, { Pending: 1, Assigned: 0, Resolved: 0 });
    equal(value.suggestion, { new: 1, review: 1, implemented: 1 });
    equal(value.general, { average: 4.3, received: 2, positive: 100 });
    equal(JSON.stringify(rows), before);
  });
  test('new suggestions count pending submissions in the Manila Monday-start week through now', () => {
    const rows = [suggestion('Pending', '2026-10-04T15:59:59Z'), suggestion('Pending', '2026-10-04T16:00:00Z'), suggestion('Pending', '2026-10-05T00:30:00+08:00'), suggestion('Pending', '2026-10-05T01:00:01+08:00'), suggestion('Pending', 'invalid'), suggestion('Assigned', '2026-10-05T00:30:00+08:00')];
    equal(stats(rows, '2026-10-05T01:00:00+08:00').suggestion, { new: 2, review: 1, implemented: 0 });
    equal(stats(rows, '2026-10-04T23:59:59+08:00').suggestion.new, 1);
  });
  test('feedback month boundaries use Manila time and exclude future or missing dates from received', () => {
    const rows = [general(4, '2026-09-30T15:59:59Z'), general(5, '2026-09-30T16:00:00Z'), general(3, '2026-10-01T00:30:00+08:00'), general(4, '2026-10-01T01:00:01+08:00'), general(2, null), general(4, 'invalid')];
    equal(stats(rows, '2026-10-01T01:00:00+08:00').general.received, 2);
    equal(stats(rows, '2026-09-30T23:59:59+08:00').general.received, 1);
  });
  test('feedback periods cross year boundaries and an invalid reference never produces invalid counts', () => {
    const rows = [general(4, '2026-12-31T16:00:00Z'), general(5, '2026-12-31T15:59:59Z'), suggestion('Pending', '2026-12-28T00:00:00+08:00'), suggestion('Pending', '2026-12-27T23:59:59+08:00')];
    const value = stats(rows, '2027-01-01T01:00:00+08:00');
    equal(value.general.received, 1); equal(value.suggestion.new, 1);
    equal(stats(rows, 'invalid').suggestion.new, 0); equal(stats(rows, 'invalid').general.received, 0);
  });
  test('general summaries accept only numeric integer ratings from one to five and use rated responses as denominator', () => {
    const rows = [4, 5, 1, null, '', '5', 0, 6, 4.5, NaN, Infinity, undefined, true].map(rating => general(rating));
    equal(stats(rows).general, { average: 3.3, received: 13, positive: 67 });
    equal(stats([general(1), general(2)]).general, { average: 1.5, received: 2, positive: 0 });
  });
  test('empty and unrated feedback show unavailable rating statistics and real zero counts', () => {
    equal(stats([]), { complaint: { Pending: 0, Assigned: 0, Resolved: 0 }, suggestion: { new: 0, review: 0, implemented: 0 }, general: { average: null, received: 0, positive: null } });
    equal(stats([general(null)]).general, { average: null, received: 1, positive: null });
  });
  test('category summaries use full API data independently of search, status and pagination', () => {
    const rows = Array.from({ length: 21 }, (_, id) => ({ id, ...suggestion(id ? 'Assigned' : 'Pending', '2026-10-04T10:00:00+08:00'), description: `Idea ${id}` }));
    const before = stats(rows); equal(model.feedbackPage(rows, { type: 'suggestion', q: 'Idea 0', status: 'Pending', page: 8 }).total, 1);
    equal(stats(rows), before); equal(before.suggestion, { new: 1, review: 20, implemented: 0 });
  });
  test('real feedback assignment, resolution and resident submissions update summary inputs without schema changes', async () => {
    const f = fixture(); await f.login(f.authA, 'ana.reyes');
    equal(stats(await f.apiA.feedback.list()).suggestion, { new: 1, review: 0, implemented: 0 });
    await f.apiA.feedback.assignTanod(2, 6);
    equal(stats(await f.apiA.feedback.list()).suggestion, { new: 0, review: 1, implemented: 0 });
    await f.apiA.feedback.resolve(2);
    equal(stats(await f.apiA.feedback.list()).suggestion, { new: 0, review: 0, implemented: 1 });
    await f.login(f.authB, 'maria.santos'); await f.apiB.feedback.create('general', { rating: 2, comment: 'More updates please.' });
    equal(stats(await f.apiA.feedback.list(), f.storeA.now()).general, { average: 3, received: 2, positive: 50 });
  });
}
