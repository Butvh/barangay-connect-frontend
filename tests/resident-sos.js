export function registerResidentSosTests({ test, equal, ok, fixture, model }) {
  test('SOS create identifies a new record versus the same active SOS reused by another tab', async () => {
    const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'maria.santos');
    await f.storeA.transact(['alerts'], db => { db.emergency_alerts = db.emergency_alerts.filter(a => a.resident_id !== 4); });
    const created = await f.apiA.alerts.create({ alert_type: 'Other' });
    equal(created.was_created, true);
    const reused = await f.apiB.alerts.create({ alert_type: 'Other' });
    equal([reused.id, reused.was_created], [created.id, false]);
    equal(model.reportScreen(reused, false, { justSubmitted: reused.was_created }), 'active');
    ok(!Object.hasOwn(f.storeA.read().emergency_alerts.find(a => a.id === created.id), 'was_created'));
  });
  const statuses = ['Pending', 'Acknowledged', 'Responding', 'Rescue in progress', 'Resolved'];
  const times = statuses.map((_, i) => `2026-10-04T14:${10 + i * 2}:00+08:00`);
  for (const [index, status] of statuses.entries()) {
    test(`Resident SOS ${status} has its own current tone and only recorded previous stages complete`, () => {
      const alert = { status, timeline: statuses.map((status, i) => ({ status, at: i <= index ? times[i] : null })) };
      const steps = model.responseProgress(alert);
      equal(steps.map(s => s.phase), statuses.map((_, i) => i < index ? 'completed' : i === index ? 'current' : 'upcoming'));
      equal(steps[index].tone, ['amber', 'blue', 'teal', 'teal', 'green'][index]);
      equal(steps.filter(s => s.phase === 'current').length, 1);
      equal(steps.map(s => s.at), times.map((time, i) => i <= index ? time : null));
      ok(steps.filter(s => s.phase === 'completed').every(s => s.icon === 'circle-check'));
      equal(model.responseProgress(JSON.parse(JSON.stringify(alert))), steps, 'refresh preserves projection');
    });
  }
  test('Resident SOS resolved without rescue leaves that step skipped without a timestamp or green check', () => {
    const steps = model.responseProgress({ status: 'Resolved', rescue_required: false, timeline: statuses.map((status, i) => ({ status, at: i === 3 ? null : times[i] })) });
    equal([steps[3].phase, steps[3].at, steps[3].timeLabel], ['skipped', null, 'Not required']);
    ok(steps[3].icon !== 'circle-check');
    equal(steps[4].phase, 'current');
  });
  test('Resident SOS invalid or missing historical timestamps are never inferred from current status', () => {
    const steps = model.responseProgress({ status: 'Resolved', created_at: times[0], timeline: [{ status: 'Acknowledged', at: 'invalid' }, { status: 'Resolved', at: times[4] }] });
    equal(steps.map(s => s.phase), ['completed', 'skipped', 'skipped', 'skipped', 'current']);
    equal(steps[1].timeLabel, 'Not recorded');
    equal(steps[1].at, null);
  });
  test('Resident SOS uses first recorded response and rescue instants even when logs arrive out of order', () => {
    const steps = model.responseProgress({ status: 'Rescue in progress', created_at: times[0], acknowledged_at: times[1],
      responses: [{ responded_at: times[4] }, { responded_at: 'invalid' }, { responded_at: times[2] }],
      rescues: [{ rescued_at: times[4] }, { rescued_at: times[3] }] });
    equal(steps.map(s => s.at), [...times.slice(0, 4), null]);
    equal(steps[4].phase, 'upcoming');
  });
  test('Resident SOS assigning a rescuer does not fabricate a started rescue', () => {
    const steps = model.responseProgress({ status: 'Responding', created_at: times[0], acknowledged_at: times[1], assigned_rescuer: { full_name: 'Ramon Bautista' }, rescuer_assigned_at: times[3], responses: [{ responded_at: times[2] }], rescues: [] });
    equal([steps[3].phase, steps[3].at], ['upcoming', null]);
  });
  test('Report opens existing active SOS directly; only a newly submitted Pending SOS confirms', () => {
    for (const status of statuses.slice(0, 4)) {
      equal(model.reportScreen({ status }, false), 'active');
      equal(model.reportScreen({ status }, true), 'details');
      equal(model.reportScreen({ status }, false, { justSubmitted: true }), status === 'Pending' ? 'sent' : 'active');
    }
    equal(model.reportScreen({ status: 'Resolved' }, true, { justSubmitted: true }), 'resolved');
  });
  test('Resident SOS projection follows the real manual workflow and never auto-assigns rescue', async () => {
    const f = fixture(); await f.login(f.authA, 'maria.santos'); await f.login(f.authB, 'ana.reyes');
    let alert = await f.apiA.alerts.get(1042);
    equal(model.responseProgress(alert)[0].phase, 'current');
    await f.apiB.alerts.acknowledge(alert.id, { responder_id: 2, expected_revision: alert.assignment_revision });
    alert = await f.apiA.alerts.get(alert.id);
    equal(model.responseProgress(alert)[1].phase, 'current');
    await f.login(f.authB, 'carlo.mendoza');
    await f.apiB.alerts.logResponse(alert.id, { response_type: 'Assessment', response_status: 'Completed', rescue_required: false, notes: 'No rescue needed.' });
    alert = await f.apiA.alerts.get(alert.id);
    equal(model.responseProgress(alert)[2].phase, 'current');
    equal(alert.assigned_rescuer_id, null);
    await f.login(f.authB, 'ana.reyes'); await f.apiB.alerts.resolve(alert.id);
    alert = await f.apiA.alerts.get(alert.id);
    equal([model.responseProgress(alert)[3].phase, model.responseProgress(alert)[3].at], ['skipped', null]);
    equal(model.reportScreen(alert, true), 'resolved');
    const next = await f.apiA.alerts.create({ alert_type: 'Other' });
    ok(next.id !== alert.id); equal(next.status, 'Pending');
    equal(model.reportScreen(next, false, { justSubmitted: true }), 'sent');
  });
}
