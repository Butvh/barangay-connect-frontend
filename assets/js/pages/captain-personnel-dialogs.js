import { Api, Store, UI, Fmt, e, dialog, pagination } from './official-shared.js';
import { personnelPage, roleLabel, sourceLabel } from './captain-personnel-model.js';
import { personnelDetails } from './captain-personnel-details.js';

const roles = ['secretary', 'responder', 'rescuer'];
const badge = (value, tone = '') => `<span class="cp-badge ${tone}">${e(value)}</span>`;
const avatar = row => `<span class="cp-avatar" aria-hidden="true">${e(Fmt.initials(row.full_name))}</span>`;
const today = () => new Date(Date.parse(Store.now()) + 8 * 3600000).toISOString().slice(0, 10);
const profile = row => `<div class="cp-profile">${avatar(row)}<div><h3>${e(row.full_name)}</h3><div class="cp-profile-badges">${badge(roleLabel(row.role))}${badge(row.status, row.status === 'Active' ? 'green' : 'gray')}<small>${e(sourceLabel(row))}</small></div></div></div>`;
const facts = entries => `<dl class="cp-detail-facts">${entries.map(([key, value]) => `<div><dt>${e(key)}</dt><dd>${e(value || 'Not recorded')}</dd></div>`).join('')}</dl>`;
function history(row) {
  return row.history.length ? `<ol class="cp-history">${[...row.history].reverse().map(h => `<li><strong>${e(h.action)}${h.to_role ? ` · ${roleLabel(h.to_role)}` : h.from_role ? ` · ${roleLabel(h.from_role)}` : ''}</strong><p>${h.from_role && h.to_role ? `${roleLabel(h.from_role)} to ${roleLabel(h.to_role)}. ` : ''}Effective ${e(Fmt.date(h.effective_date))} · ${e(h.by_name || 'Unknown actor')}</p><small>Recorded ${e(Fmt.dateTime(h.at))} · ${e(h.status || 'Status not recorded')}</small>${h.notes ? `<p>${e(h.notes)}</p>` : ''}</li>`).join('')}</ol>` : '<p>No appointment history recorded yet. Future role changes will preserve their effective date and responsible Captain.</p>';
}
function busy(row) {
  if (!row?.busy_alert_ids?.length) return '';
  return `<div class="banner banner-error"><div><p>This person is assigned to unresolved incidents. Complete, reassign, or cancel these responsibilities before changing the role.</p><div class="cp-busy-links">${row.busy_alert_ids.map(id => `<a href="official-alert.html?id=${Number(id)}">${e(Fmt.alertId(id))}</a>`).join('')}</div></div></div>`;
}

/** Centered native dialogs share one live list projection and never overwrite an open draft. */
export function createPersonnelDialogs({ getData, isStale, reload, afterSave }) {
  const panels = new Set(), barangayNames = new Map(); let sequence = 0, opening = false;
  const rowInData = id => [...(getData()?.records || []), ...(getData()?.tanods || [])].find(row => row.id === Number(id));
  function track(el, state) { state.el = el; panels.add(state); el.classList.add('cp-dialog'); el.addEventListener('close', () => panels.delete(state), { once: true }); return el; }
  function ensureData() { if (!getData() || isStale()) { UI.toast('Refresh personnel before opening a staffing form.', 'error'); return false; } return true; }
  function field(state, name, label, { type = 'text', required = false, max = 200, value = '', placeholder = '', wide = false, textarea = false, extra = '' } = {}) {
    const id = `cp-${state.uid}-${name}`;
    return `<div class="field${wide ? ' span-2' : ''}"><label for="${id}">${e(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label>${textarea ? `<textarea class="textarea" id="${id}" name="${name}" maxlength="${max}" placeholder="${e(placeholder)}" aria-describedby="${id}-error"${required ? ' required' : ''}>${e(value)}</textarea>` : `<input class="input" id="${id}" type="${type}" name="${name}" value="${e(value)}" maxlength="${max}" placeholder="${e(placeholder)}" aria-describedby="${id}-error"${required ? ' required' : ''} ${extra}>`}<small class="error-text" id="${id}-error" data-error="${name}"></small></div>`;
  }
  function roleField(state, label, wide = false) {
    return `<div class="field${wide ? ' span-2' : ''}"><label for="cp-${state.uid}-role">${e(label)} <span aria-hidden="true">*</span></label><select class="select" name="role" id="cp-${state.uid}-role" required aria-describedby="cp-${state.uid}-role-help cp-${state.uid}-role-error"><option value="">Select a role</option>${roles.filter(role => role !== state.row?.role).map(role => `<option value="${role}">${roleLabel(role)}</option>`).join('')}</select><small class="cp-form-help" id="cp-${state.uid}-role-help" data-capacity-help>Positions include Active and Inactive appointments.</small><small class="error-text" id="cp-${state.uid}-role-error" data-error="role"></small></div>`;
  }
  function dateField(state, label = 'Effective date', wide = false) { return field(state, 'effective_date', label, { type: 'date', required: true, value: today(), wide, extra: `max="${today()}"${state.row?.appointed_at ? ` min="${e(state.row.appointed_at.slice(0, 10))}"` : ''}` }); }
  function formState(kind, row = null) { return { kind, row, targetId: row?.id ?? null, expected_revision: row?.revision ?? null, uid: ++sequence, saving: false, confirming: false, changed: false, dirty: () => false }; }
  function values(state) {
    const result = Object.fromEntries(new FormData(state.form).entries());
    delete result.requirements; delete result.tanod_search; delete result.tanod_id;
    result.notes = [result.transition_notes, result.notes].filter(value => String(value || '').trim()).map(value => String(value).trim()).join('\n\n'); delete result.transition_notes;
    if (state.expected_revision !== null) result.expected_revision = state.expected_revision;
    if (state.kind === 'external') result.requirements = [...state.form.elements.requirements.files].map(file => ({ name: file.name, type: file.type, size: file.size }));
    return result;
  }
  function signature(state) { const entries = [...new FormData(state.form).entries()].filter(([key]) => key !== 'tanod_search').map(([key, value]) => [key, typeof value === 'string' ? value : [value.name, value.type, value.size]]); return JSON.stringify([entries, state.targetId]); }
  async function canClose(state) {
    if (state.saving || state.confirming) return false;
    if (!state.dirty()) return true;
    state.confirming = true;
    try { return await UI.confirm({ title: 'Discard changes?', text: 'The changes in this form have not been saved.', confirmLabel: 'Discard changes', danger: true }); }
    finally { state.confirming = false; }
  }
  function error(state, err) {
    const box = state.el.querySelector('[data-save-error]'); box.textContent = err.message || 'The change could not be saved. Try again.'; box.hidden = false;
    for (const [key, message] of Object.entries(err.fields || {})) { const control = state.form.elements.namedItem(key), help = [...state.form.querySelectorAll('[data-error]')].find(el => el.dataset.error === key); control?.setAttribute?.('aria-invalid', 'true'); if (help) help.textContent = message; }
    box.tabIndex = -1; box.focus();
  }
  function clearErrors(state) { state.el.querySelector('[data-save-error]').hidden = true; state.form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid')); state.form.querySelectorAll('[data-error]').forEach(el => el.textContent = ''); }
  function setBusy(state, value) { state.saving = value; state.el.toggleAttribute('aria-busy', value); state.form.querySelector('fieldset').disabled = value; state.el.querySelector('[data-close]').disabled = value; }
  function refreshForm(state) {
    if (!state.el.open) return;
    const data = getData(), current = state.targetId ? rowInData(state.targetId) : null;
    if (state.expected_revision !== null && (!current || current.revision !== state.expected_revision)) state.changed = true;
    const notice = state.el.querySelector('[data-live-warning]');
    const message = state.changed ? 'This personnel record changed while the form was open. Your draft is preserved. Close this form and review the latest details before trying again.' : isStale() ? 'Personnel could not refresh. Refresh the page data before saving this change.' : '';
    notice.textContent = message; notice.hidden = !message;
    state.el.querySelector('[data-busy-warning]').innerHTML = ['reassign', 'remove'].includes(state.kind) ? busy(current || state.row) : '';
    if (state.form.elements.role && data) {
      for (const option of state.form.elements.role.options) if (option.value) { const c = data.capacities[option.value]; option.disabled = c.available === 0; option.textContent = `${roleLabel(option.value)} · ${c.available} slot${c.available === 1 ? '' : 's'} available`; }
      const chosen = state.form.elements.role.value, c = data.capacities[chosen];
      state.el.querySelector('[data-capacity-help]').textContent = c ? `${c.used} of ${c.limit} positions occupied, including Inactive personnel. ${c.available} available.` : 'Positions include Active and Inactive appointments.';
    }
    const chosenRole = state.form.elements.role?.value, full = chosenRole && data?.capacities[chosenRole]?.available === 0;
    const blockedBusy = ['reassign', 'remove'].includes(state.kind) && current?.busy_alert_ids?.length;
    const invalidTanod = state.kind === 'appoint' && (!current || current.role);
    state.form.querySelector('[type=submit]').disabled = Boolean(state.saving || state.confirming || state.changed || isStale() || full || blockedBusy || invalidTanod);
    if (state.form.elements.effective_date) state.form.elements.effective_date.max = today();
  }
  function mountForm(state, title, subtitle, body, submitLabel, submit) {
    const el = dialog(title, `<p class="cp-dialog-subtitle">${e(subtitle)}</p><div class="banner banner-error" role="alert" data-live-warning hidden></div><div data-busy-warning></div><form novalidate><fieldset><div class="cp-form-grid${state.kind === 'reassign' || state.kind === 'remove' ? ' cp-single-form' : ''}">${body}</div><div class="banner banner-error" role="alert" data-save-error hidden></div><footer class="cp-dialog-footer"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn ${state.kind === 'remove' ? 'cp-danger-outline' : 'btn-primary'}">${e(submitLabel)}</button></footer></fieldset></form>`, { sheet: false, beforeClose: () => canClose(state) });
    track(el, state); el.classList.add(`cp-dialog-${state.kind}`); state.form = el.querySelector('form');
    state.initial = signature(state); state.dirty = () => signature(state) !== state.initial;
    el.querySelector('[data-cancel]').addEventListener('click', async () => { if (await canClose(state)) UI.closeDialog(el); });
    state.form.addEventListener('input', event => { event.target.removeAttribute?.('aria-invalid'); const help = [...state.form.querySelectorAll('[data-error]')].find(node => node.dataset.error === event.target.name); if (help) help.textContent = ''; });
    state.form.addEventListener('change', () => refreshForm(state));
    state.form.addEventListener('submit', async event => {
      event.preventDefault(); if (state.saving || state.confirming) return; clearErrors(state); refreshForm(state);
      if (state.form.querySelector('[type=submit]').disabled || !state.form.reportValidity()) return;
      const input = values(state);
      if (input.notes.length > 500) { error(state, { message: 'Use 500 characters or fewer across transition notes and remarks.', fields: { notes: 'Use 500 characters or fewer in total.' } }); return; }
      if (state.kind !== 'remove') {
        state.confirming = true; refreshForm(state);
        const name = state.kind === 'external' ? input.full_name : rowInData(state.targetId)?.full_name || state.row?.full_name;
        let confirmed;
        try { confirmed = await UI.confirm({ title: state.kind === 'reassign' ? 'Confirm reassignment' : 'Confirm appointment', text: `${name} will be assigned as ${roleLabel(input.role)} effective ${Fmt.date(input.effective_date)}.${input.status === 'Inactive' ? ' This appointment is Inactive and occupies a position.' : ''}`, confirmLabel: state.kind === 'reassign' ? 'Save changes' : submitLabel }); }
        finally { state.confirming = false; refreshForm(state); }
        if (!confirmed || state.form.querySelector('[type=submit]').disabled) return;
      }
      setBusy(state, true);
      try { const row = await submit(input); state.dirty = () => false; UI.closeDialog(el); await reload(); afterSave?.(row); UI.toast(state.kind === 'remove' ? `${row.full_name} removed from the role. Their record and history are preserved.` : state.kind === 'reassign' ? 'Personnel role reassigned.' : 'Personnel appointment saved.'); }
      catch (err) { error(state, err); await reload(); }
      finally { if (el.isConnected) { setBusy(state, false); refreshForm(state); } }
    });
    refreshForm(state); return state;
  }
  function openExternal() {
    if (!ensureData()) return;
    const s = formState('external');
    const body = field(s, 'full_name', 'Full name', { required: true, max: 100, placeholder: 'Enter full name', extra: 'autocomplete="name"' }) + roleField(s, 'Role to assign') + field(s, 'contact_number', 'Contact number', { type: 'tel', required: true, max: 30, placeholder: 'e.g. 0917 123 4567', extra: 'autocomplete="tel"' }) + field(s, 'email', 'Email address', { type: 'email', required: true, max: 254, placeholder: 'e.g. name@example.com', extra: 'autocomplete="email"' }) + field(s, 'address', 'Home address', { required: true, max: 300, placeholder: 'Enter complete home address', wide: true, extra: 'autocomplete="street-address"' }) + dateField(s, 'Date of appointment') + field(s, 'emergency_contact', 'Emergency contact', { required: true, max: 200, placeholder: 'Name and contact number' }) + `<div class="field"><span id="cp-${s.uid}-requirements-label">Upload requirements</span><div class="cp-requirements"><input class="cp-requirements-input" type="file" id="cp-${s.uid}-requirements" name="requirements" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple aria-labelledby="cp-${s.uid}-requirements-label" aria-describedby="cp-${s.uid}-requirements-help cp-${s.uid}-requirements-demo cp-${s.uid}-requirements-error"><label class="cp-requirements-trigger" for="cp-${s.uid}-requirements"><img src="assets/img/source/imgLucideUpload-23cc1.svg" alt=""><span>Click to upload</span><small class="cp-form-help" id="cp-${s.uid}-requirements-help">PDF, JPG or PNG · Max 5 MB each, up to 10 files.</small></label><ul class="cp-file-list" data-file-list></ul></div><small class="cp-form-help" id="cp-${s.uid}-requirements-demo">This demo records file names and details. File contents are not uploaded.</small><small class="error-text" id="cp-${s.uid}-requirements-error" data-error="requirements"></small></div><div class="field"><label for="cp-${s.uid}-status">Status <span aria-hidden="true">*</span></label><select class="select" name="status" id="cp-${s.uid}-status"><option>Active</option><option>Inactive</option></select><small class="cp-form-help">Inactive personnel retain their assigned position.</small></div>` + field(s, 'notes', 'Notes', { textarea: true, wide: true, max: 500, placeholder: 'Add any additional notes (optional)' });
    mountForm(s, 'Add external personnel', 'Enter the details of external personnel to assign a role.', body, 'Add personnel', input => Api.personnel.addExternal(input));
    s.form.elements.requirements.addEventListener('change', () => { s.el.querySelector('[data-file-list]').innerHTML = [...s.form.elements.requirements.files].map(file => `<li>${e(file.name)} (${Math.ceil(file.size / 1024)} KB)</li>`).join(''); });
  }
  function renderPicker(state) {
    const query = state.form.elements.tanod_search.value.trim().toLowerCase(), rows = getData().tanods.filter(row => row.full_name.toLowerCase().includes(query));
    state.el.querySelector('[data-tanod-options]').innerHTML = rows.length ? rows.map(row => `<label class="cp-tanod-choice"><input type="radio" name="tanod_id" value="${row.id}"${state.targetId === row.id ? ' checked' : ''}${row.role ? ' disabled' : ''}><span>${avatar(row)}</span><span><strong>${e(row.full_name)}</strong><small>Current assignment: ${row.role ? roleLabel(row.role) : 'None'}</small></span>${badge(row.role ? 'Assigned' : 'Available', row.role ? '' : 'green')}</label>`).join('') : '<p>No matching Tanods. Try another name.</p>';
    state.el.querySelectorAll('[name=tanod_id]').forEach(input => input.addEventListener('change', () => { const row = rowInData(input.value); state.targetId = row.id; state.expected_revision = row.revision; state.row = row; state.changed = false; state.el.querySelector('[data-selected-tanod]').textContent = `Selected: ${row.full_name}`; const min = row.history.at(-1)?.effective_date; state.form.elements.effective_date.min = min || ''; refreshForm(state); }));
  }
  function openAppoint(id = null) {
    if (!ensureData()) return;
    const row = id ? rowInData(id) : null;
    if (row?.role) { openReassign(id); return; }
    const s = formState('appoint', row);
    const body = field(s, 'tanod_search', 'Search tanods', { placeholder: 'Search tanods by name…', type: 'search', wide: true }) + `<div class="span-2"><div class="cp-tanod-picker" data-tanod-options></div><p class="cp-form-help" data-selected-tanod>${row ? `Selected: ${e(row.full_name)}` : 'Select one available Tanod.'}</p></div>` + roleField(s, 'Role to assign') + dateField(s) + field(s, 'notes', 'Notes (optional)', { textarea: true, wide: true, max: 500, placeholder: 'Add a note for this appointment…' }) + '<p class="cp-form-help span-2">The person remains a member of the barangay tanod pool. Role history is preserved.</p>';
    mountForm(s, 'Appoint from tanods', 'Select one existing barangay tanod to assign to a staffing role.', body, 'Confirm appointment', input => Api.personnel.appoint(s.targetId, input));
    renderPicker(s); s.initial = signature(s); if (row?.history.at(-1)?.effective_date) s.form.elements.effective_date.min = row.history.at(-1).effective_date; s.form.elements.tanod_search.addEventListener('input', () => renderPicker(s));
  }
  async function readRow(id) {
    if (opening) return null;
    opening = true;
    try { return await Api.personnel.get(id); } catch (err) { UI.toast(err.message, 'error'); return null; } finally { opening = false; }
  }
  async function openReassign(id) {
    if (!ensureData()) return; const row = await readRow(id); if (!row) return;
    if (!row.role) { UI.toast('This person has no assigned role.', 'error'); return; }
    const s = formState('reassign', row), body = `<div class="span-2 cp-current-person">${profile(row)}</div>` + roleField(s, 'New role', true) + dateField(s, 'Effective date', true) + field(s, 'transition_notes', 'Transition notes (optional)', { wide: true, max: 500, placeholder: 'Add transition or replacement notes' }) + field(s, 'notes', 'Remarks (optional)', { textarea: true, wide: true, max: 500, placeholder: 'Add details about this reassignment…' }) + '<p class="cp-form-help span-2">Capacity is checked before changes are saved. Existing personnel records and appointment history are maintained. Notes and remarks may contain up to 500 characters in total.</p>';
    mountForm(s, 'Reassign role', 'Update the assigned role for this personnel.', body, 'Save changes', input => Api.personnel.reassign(row.id, input));
  }
  async function openRemove(id) {
    if (!ensureData()) return; const row = await readRow(id); if (!row) return;
    if (!row.role) { UI.toast('This person has no assigned role.', 'error'); return; }
    const s = formState('remove', row), body = `<p class="span-2 cp-long-copy">${row.source === 'tanod' ? 'This Tanod will return to the unassigned tanod pool.' : 'This person will become Unassigned.'} Their record and service history are preserved.</p><div class="span-2 cp-current-person">${profile(row)}</div>` + dateField(s, 'Effective date', true) + field(s, 'notes', 'Notes (optional)', { textarea: true, wide: true, max: 500, placeholder: 'Add a note about this role change' });
    mountForm(s, 'Remove from role?', 'This removes the person from their current assigned role.', body, 'Remove from role', input => Api.personnel.remove(row.id, input));
  }
  function detailsContent(row) {
    if (row.source !== 'tanod') return personnelDetails(row, barangayNames.get(row.barangay_id));
    const tanod = row.source === 'tanod', appointment = row.history.filter(h => h.to_role === row.role && row.role).at(-1);
    return `${profile(row)}<section class="cp-detail-section"><h3>Personal information</h3>${facts([['Full name', row.full_name], ...(tanod ? [['Tanod ID', row.id]] : []), ['Home address', row.address], ['Barangay', barangayNames.get(row.barangay_id) || `Barangay #${row.barangay_id}`]])}</section><section class="cp-detail-section"><h3>Contact information</h3>${facts([['Email', row.email], ['Contact number', row.contact_number], ['Emergency contact', row.emergency_contact]])}</section><section class="cp-detail-section"><h3>${tanod ? 'Current assignment' : 'Role details'}</h3>${facts([['Assigned role', roleLabel(row.role)], ['Source', row.legacy && row.source !== 'tanod' ? 'Not recorded' : sourceLabel(row)], ['Status', row.status], ['Appointment date', row.appointed_at ? Fmt.date(row.appointed_at) : 'Not recorded'], ['Assigned by', appointment?.by_name]])}${tanod && !row.role ? '<p>Eligible for Secretary, Responder, or Rescuer appointment subject to available capacity.</p>' : ''}${busy(row)}</section>${row.requirements.length || row.notes ? `<section class="cp-detail-section"><h3>Requirements and notes</h3>${row.requirements.length ? `<ul class="cp-file-list">${row.requirements.map(file => `<li>${e(file.name)} · ${Math.ceil(file.size / 1024)} KB</li>`).join('')}</ul><p class="cp-form-help">File details are recorded; file contents are not stored in this demo.</p>` : ''}${row.notes ? `<p class="cp-long-copy">${e(row.notes)}</p>` : ''}</section>` : ''}<section class="cp-detail-section"><h3>${tanod ? 'Role history' : 'Appointment history'}</h3>${history(row)}</section><footer class="cp-dialog-footer">${row.role ? `<button type="button" class="btn" data-detail-reassign>Reassign role</button><button type="button" class="btn cp-danger-outline" data-detail-remove>Remove from role</button>` : tanod ? '<button type="button" class="btn btn-primary" data-detail-appoint>Appoint to role</button>' : ''}<button type="button" class="btn btn-primary" data-done>Done</button></footer>`;
  }
  function renderDetails(state, row) {
    const signature = JSON.stringify([row, isStale(), barangayNames.get(row?.barangay_id)]);
    if (state.rendered === signature) return;
    state.rendered = signature;
    const focusedAction = ['data-detail-reassign', 'data-detail-remove', 'data-detail-appoint', 'data-done'].find(attribute => document.activeElement?.hasAttribute(attribute) && state.el.contains(document.activeElement));
    if (!row) { state.el.querySelector('[data-detail-body]').innerHTML = '<p role="alert">This personnel record is no longer available. Close the dialog and refresh personnel.</p>'; return; }
    state.el.querySelector('[data-detail-body]').innerHTML = detailsContent(row);
    const switchTo = callback => { UI.closeDialog(state.el); callback(); };
    state.el.querySelector('[data-detail-reassign]')?.addEventListener('click', () => switchTo(() => openReassign(row.id)));
    state.el.querySelector('[data-detail-remove]')?.addEventListener('click', () => switchTo(() => openRemove(row.id)));
    state.el.querySelector('[data-detail-appoint]')?.addEventListener('click', () => switchTo(() => openAppoint(row.id)));
    state.el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(state.el));
    state.el.querySelectorAll('[data-detail-reassign],[data-detail-remove],[data-detail-appoint]').forEach(button => button.disabled = isStale());
    if (focusedAction) state.el.querySelector(`[${focusedAction}]`)?.focus({ preventScroll: true });
  }
  async function openDetails(id) {
    const row = await readRow(id); if (!row) return;
    const tanod = row.source === 'tanod', state = { kind: 'details', targetId: row.id, dirty: () => false };
    const el = dialog(tanod ? 'Tanod details' : 'Personnel details', `<p class="cp-dialog-subtitle">${tanod ? 'View tanod profile, assignment, and role history.' : 'View personnel information, role assignment, and appointment history.'}</p><div data-detail-body></div>`, { sheet: false });
    track(el, state); el.classList.add(tanod ? 'cp-dialog-tanod' : 'cp-dialog-details'); renderDetails(state, row);
    Api.barangays.list().then(rows => { const b = rows.find(b => b.id === row.barangay_id); if (b) barangayNames.set(b.id, b.name); if (b && el.open) renderDetails(state, rowInData(row.id) || row); }).catch(() => {});
  }
  function renderDirectory(state) {
    const data = getData(); if (!data) return;
    const rows = state.source === 'tanod' ? data.tanods : data.records.filter(row => row.source === 'external' && row.added_externally_at);
    const page = personnelPage(rows, { q: state.q, status: state.status, page: state.page }); state.page = page.page;
    state.el.querySelector('[data-directory-results]').innerHTML = page.total ? `${page.rows.map(row => `<div class="cp-person-row">${avatar(row)}<div class="cp-person-copy"><strong>${e(row.full_name)}</strong><small>${roleLabel(row.role)} · ${e(row.status)}</small></div><div class="cp-row-actions"><button type="button" class="btn" data-directory-view="${row.id}">View</button>${state.source === 'tanod' ? `<button type="button" class="btn btn-primary" data-directory-assign="${row.id}"${isStale() ? ' disabled' : ''}>${row.role ? 'Reassign' : 'Appoint'}</button>` : ''}</div></div>`).join('')}${pagination({ ...page, noun: state.source === 'tanod' ? 'tanods' : 'external additions' })}` : UI.empty({ icon: 'users', title: 'No matching records', text: state.source === 'tanod' ? 'Try another name or status.' : 'Direct external additions will appear here after they are saved.' });
    state.el.querySelectorAll('[data-directory-view]').forEach(button => button.addEventListener('click', () => { UI.closeDialog(state.el); openDetails(Number(button.dataset.directoryView)); }));
    state.el.querySelectorAll('[data-directory-assign]').forEach(button => button.addEventListener('click', () => { const row = rowInData(button.dataset.directoryAssign); UI.closeDialog(state.el); if (row?.role) openReassign(row.id); else openAppoint(row.id); }));
    state.el.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { state.page = Number(button.dataset.page); renderDirectory(state); state.el.querySelector('[data-directory-results]').focus(); }));
  }
  function openDirectory(source) {
    if (!getData()) return;
    const state = { kind: 'directory', source, q: '', status: '', page: 1, dirty: () => false }, uid = ++sequence;
    const el = dialog(source === 'tanod' ? 'Tanod appointments' : 'All external additions', `<p class="cp-dialog-subtitle">${source === 'tanod' ? 'View the existing barangay Tanod roster and current role assignments.' : 'Personnel added directly by the Barangay Captain.'}</p><div class="cp-directory"><form class="cp-directory-filters"><label class="sr-only" for="cp-directory-${uid}-search">Search by name or email</label><input type="search" class="input" id="cp-directory-${uid}-search" name="q" placeholder="Search by name or email…" maxlength="200"><label class="sr-only" for="cp-directory-${uid}-status">Status</label><select class="select" id="cp-directory-${uid}-status" name="status"><option value="">All statuses</option>${['Active', 'Inactive', 'Unassigned'].map(value => `<option>${value}</option>`).join('')}</select></form><div data-directory-results tabindex="-1"></div></div><footer class="cp-dialog-footer"><button type="button" class="btn btn-primary" data-done>Done</button></footer>`, { sheet: false });
    track(el, state); el.querySelector('form').addEventListener('submit', event => event.preventDefault());
    el.querySelector('[name=q]').addEventListener('input', event => { if (event.isComposing) return; state.q = event.target.value; state.page = 1; renderDirectory(state); });
    el.querySelector('[name=status]').addEventListener('change', event => { state.status = event.target.value; state.page = 1; renderDirectory(state); });
    el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el)); renderDirectory(state);
  }
  function refresh() { for (const state of panels) { if (state.kind === 'details') renderDetails(state, rowInData(state.targetId)); else if (state.kind === 'directory') renderDirectory(state); else refreshForm(state); } }
  async function confirmNavigation() {
    if ([...panels].some(state => state.saving || state.confirming)) return false;
    if (![...panels].some(state => state.dirty())) return true;
    const confirmed = await UI.confirm({ title: 'Discard changes and leave?', text: 'The personnel changes in this form have not been saved.', confirmLabel: 'Discard changes', danger: true });
    if (confirmed) for (const state of panels) state.dirty = () => false;
    return confirmed;
  }
  return { openExternal, openAppoint, openDetails, openReassign, openRemove, openDirectory, refresh, confirmNavigation, hasDirty: () => [...panels].some(state => state.saving || state.dirty()) };
}
