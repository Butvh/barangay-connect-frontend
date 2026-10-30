import { Auth, Api, UI, Icons, e, dialog } from './official-shared.js';
import { assignmentCards } from './official-assignment-model.js';

let openPicker = null;
export function assignAlert(alert, { role = 'responder', mode = 'assign', saved = () => {} } = {}) {
  if (openPicker?.open) { openPicker.focus(); return openPicker; }
  const label = role === 'rescuer' ? 'rescuer' : 'responder', reassign = mode === 'reassign', title = `${reassign ? 'Reassign' : 'Assign'} ${label}`;
  const captain = Auth.roleOf(Auth.current()) === 'captain';
  let options = null, selected = null, busy = false, loading = true, version = 0, refreshPending = false;
  const el = dialog(title, `<form class="assignment-form" novalidate><div class="assignment-content"><p class="assignment-description">Select a ${label} to handle this ${role === 'rescuer' ? 'operation' : 'report'}.</p><div class="banner banner-error" role="alert" data-error hidden></div><div class="assignment-search">${Icons.svg('search', { size: 24 })}<input class="input" type="search" aria-label="Search ${label} by name" placeholder="Search ${label} by name..." maxlength="200" autocomplete="off"></div><p class="assignment-update" role="status" data-update></p><div class="assignment-people" role="radiogroup" aria-label="Select ${label}" data-people><p class="assignment-empty" role="status">Loading personnel and workloads…</p></div><p class="assignment-capacity-help" data-capacity hidden></p>${reassign ? '<div class="field"><label for="assignment-reason">Reason for reassignment</label><textarea class="textarea" id="assignment-reason" name="reason" maxlength="1000" required></textarea></div>' : ''}${captain ? '<div class="assignment-override"><label class="assignment-override-toggle"><input type="checkbox" name="emergency_override"> Emergency override (Captain only)</label><div class="field" data-override-fields hidden><p>This person is already at capacity. An override adds work beyond their normal limit.</p><label for="assignment-override-reason">Emergency override reason</label><textarea class="textarea" id="assignment-override-reason" name="override_reason" maxlength="1000"></textarea></div></div>' : ''}</div><footer class="assignment-footer"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary" disabled>${title}</button></footer></form>`, { sheet: false, beforeClose: () => !busy });
  el.classList.add('assignment-dialog'); openPicker = el;
  const form = el.querySelector('form'), people = el.querySelector('[data-people]'), error = el.querySelector('[data-error]'), search = el.querySelector('[type=search]'), submit = el.querySelector('[type=submit]');
  const overrideEnabled = () => captain && Boolean(form.elements.emergency_override?.checked);
  const candidate = () => options?.personnel.find(row => row.id === selected);
  const eligible = row => row && !row.assigned && (row.available || overrideEnabled() && row.at_capacity);
  function renderCards() {
    const overrideGroup = el.querySelector('.assignment-override');
    if (overrideGroup) {
      overrideGroup.hidden = !options?.personnel.some(row => row.at_capacity && !row.assigned);
      if (overrideGroup.hidden) { form.elements.emergency_override.checked = false; el.querySelector('[data-override-fields]').hidden = true; }
    }
    if (options) people.innerHTML = assignmentCards(options, search.value, selected, overrideEnabled());
    const allFull = options?.personnel.length && options.personnel.every(row => !row.available);
    const help = el.querySelector('[data-capacity]'); help.hidden = !allFull;
    help.textContent = `No ${label} has an ordinary assignment slot available. ${captain ? 'Reassign existing work where possible, or authorize an emergency override with a reason.' : 'Ask the Barangay Captain to review reassignment or an urgent override.'}`;
    submit.disabled = busy || loading || !eligible(candidate()); submit.textContent = busy ? 'Saving…' : title;
    people.querySelectorAll('input').forEach(input => { if (busy) input.disabled = true; });
    form.setAttribute('aria-busy', String(busy || loading));
  }
  function showError(message) { error.textContent = message; error.hidden = false; error.tabIndex = -1; error.focus(); }
  async function refresh() {
    if (!el.open) return;
    if (busy) { refreshPending = true; return; }
    const request = ++version; loading = true; renderCards();
    try {
      const next = await Api.alerts.assignmentOptions(alert.id, role);
      if (!el.open || request !== version) return;
      const changed = options && next.alert_revision !== options.alert_revision; options = next;
      if (selected && (changed || !eligible(candidate()))) { selected = null; el.querySelector('[data-update]').textContent = 'Availability or incident details changed. Select personnel again.'; }
    } catch (err) { if (!el.open || request !== version) return; options = null; selected = null; people.innerHTML = '<p class="assignment-empty">Personnel could not be loaded. Close this panel and try again.</p>'; showError(err.message); }
    finally { if (el.open && request === version) { loading = false; renderCards(); } }
  }
  search.addEventListener('input', () => { selected = null; error.hidden = true; renderCards(); });
  people.addEventListener('change', event => { const next = Number(event.target.value), row = options?.personnel.find(row => row.id === next); if (eligible(row)) { selected = next; error.hidden = true; renderCards(); el.querySelector(`#assign-person-${next}`)?.focus({ preventScroll: true }); } });
  form.elements.emergency_override?.addEventListener('change', () => { el.querySelector('[data-override-fields]').hidden = !overrideEnabled(); if (!eligible(candidate())) selected = null; renderCards(); });
  el.querySelector('[data-cancel]').addEventListener('click', () => { if (!busy) UI.closeDialog(el); });
  const offs = ['alerts', 'users'].map(entity => Api.subscribe(entity, refresh));
  el.addEventListener('close', () => { version++; offs.forEach(off => off()); if (openPicker === el) openPicker = null; }, { once: true });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || loading || !eligible(candidate())) return;
    const chosen = candidate(), reason = form.elements.reason?.value.trim(), overrideReason = form.elements.override_reason?.value.trim();
    if (reassign && !reason) { showError('Provide a reason for reassignment.'); form.elements.reason.focus(); return; }
    if (chosen.at_capacity && !overrideReason) { showError('Provide an emergency override reason.'); form.elements.override_reason?.focus(); return; }
    const expected = options.alert_revision; busy = true; error.hidden = true; renderCards();
    el.querySelectorAll('button,input,textarea').forEach(control => control.disabled = true);
    try {
      const fresh = await Api.alerts.assignmentOptions(alert.id, role), current = fresh.personnel.find(row => row.id === chosen.id);
      if (fresh.alert_revision !== expected || !eligible(current)) throw new Error('This assignment is no longer available. Review the refreshed list.');
      const override = chosen.at_capacity ? { confirmed: true, reason: overrideReason } : undefined;
      if (override && !await UI.confirm({ title: 'Authorize emergency override?', text: `${chosen.full_name} already has ${current.workload} of ${fresh.limit} assignments. Assign A-${alert.id} beyond the normal limit? Your authorization and reason will be recorded.`, confirmLabel: 'Authorize override and assign', danger: true })) return;
      const payload = { role, personnel_id: chosen.id, responder_id: chosen.id, expected_revision: expected, ...(reassign ? { reason } : {}), ...(override ? { override } : {}) };
      await (mode === 'acknowledge' ? Api.alerts.acknowledge(alert.id, payload) : reassign ? Api.alerts.reassign(alert.id, payload) : Api.alerts.assign(alert.id, payload));
      UI.closeDialog(el); UI.toast(`${reassign ? 'Reassigned' : 'Assigned'} ${label}: ${chosen.full_name}.`); await saved();
    } catch (err) { if (el.open) { selected = null; busy = false; await refresh(); showError(err.message); } }
    finally { busy = false; if (el.open) { el.querySelectorAll('button,input,textarea').forEach(control => control.disabled = false); renderCards(); if (refreshPending) { refreshPending = false; await refresh(); } } }
  });
  refresh(); return el;
}

export function cancelAlertAssignment(alert, role, saved = () => {}) {
  let busy = false, blocked = false, expectedRevision = alert.assignment_revision;
  const original = alert.assignments?.find(row => row.role === role && row.status === 'active');
  const el = dialog('Cancel assignment', `<form class="stack-sm"><p>Release ${e(alert[`assigned_${role}`]?.full_name || `the ${role}`)} from A-${alert.id}. The incident stays open and its assignment history is retained.</p><div class="field"><label for="cancel-assignment-reason">Reason</label><textarea class="textarea" id="cancel-assignment-reason" name="reason" maxlength="1000" required></textarea></div><p class="error-text" role="alert" data-error hidden></p><div class="actions"><button type="button" class="btn" data-cancel>Keep assignment</button><button type="submit" class="btn btn-danger">Cancel assignment</button></div></form>`, { sheet: false, beforeClose: () => !busy });
  el.querySelector('[data-cancel]').addEventListener('click', () => { if (!busy) UI.closeDialog(el); });
  el.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || blocked) return; busy = true; const error = el.querySelector('[data-error]');
    el.querySelectorAll('button,textarea').forEach(control => control.disabled = true);
    try { await Api.alerts.cancelAssignment(alert.id, { role, reason: event.target.elements.reason.value, expected_revision: expectedRevision }); UI.closeDialog(el); UI.toast('Assignment cancelled.'); await saved(); }
    catch (err) {
      error.textContent = err.message;
      if (err.code === 'CONFLICT') {
        try {
          const latest = await Api.alerts.assignmentOptions(alert.id, role), current = latest.current_assignment;
          if (original && current && (current.id === original.id || original.legacy && current.legacy && current.user_id === original.user_id)) {
            expectedRevision = latest.alert_revision; error.textContent = 'This incident progressed while you were reviewing it. The same responsibility is still active. Review your reason and confirm cancellation again.';
          } else { blocked = true; error.textContent = 'This responsibility ended or was replaced. Close this panel and review the incident; your cancellation has not been applied.'; }
        } catch (refreshError) { blocked = true; error.textContent = `${refreshError.message} Close this panel and review the incident.`; }
      }
      error.hidden = false;
    }
    finally { busy = false; el.querySelectorAll('button,textarea').forEach(control => control.disabled = false); el.querySelector('[type=submit]').disabled = blocked; }
  });
  return el;
}
