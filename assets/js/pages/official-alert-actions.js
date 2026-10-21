import { Auth, Api, UI, Icons, Fmt, Store, e, roleLabel, alertName, facts, facilityType, facilityDetail, dialog } from './official-shared.js';
import { RESPONSE_TYPES } from '../core/alertMachine.js';

export function alertSummary(alert) {
  return dialog('Alert summary', `<div class="stack"><div class="spread wrap"><h3>${e(alertName(alert))}</h3>${UI.badge(alert.status)}</div>${facts([['Location', alert.location_label], ['Reporter', alert.resident?.full_name || 'Not provided'], ['Victims', alert.victim_count ?? 'Not confirmed'], ['Reported', Fmt.dateTime(alert.created_at)]])}<p class="official-long-copy">${e(alert.description || 'No description provided.')}</p><a class="btn btn-primary" href="official-alert.html?id=${alert.id}">View alert</a></div>`);
}

export async function resolveAlert(alert, saved = () => {}) {
  if (!await UI.confirm({ title: 'Resolve alert?', text: `Mark ${Fmt.alertId(alert.id)} at ${alert.location_label} as Resolved? The resident will receive an update.`, confirmLabel: 'Resolve', danger: true })) return;
  try { await Api.alerts.resolve(alert.id); UI.toast(`${Fmt.alertId(alert.id)} resolved.`); await saved(); }
  catch (error) { UI.toast(error.message, 'error'); await saved(); }
}

export async function logAlert(alert, kind, saved = () => {}) {
  const rescue = kind === 'rescue', title = rescue ? 'Log rescue' : 'Log response', user = Auth.current();
  let dirty = false, busy = false, facilities = [], chosen = null, closing = false;
  const requestClose = async () => {
    if (busy || closing) return false;
    if (!dirty) return true;
    closing = true;
    try { return await UI.confirm({ title: 'Discard this log?', text: 'The log has not been saved.', confirmLabel: 'Discard changes', danger: true }); }
    finally { closing = false; }
  };
  const select = (name, label, values, helper) => `<div class="field"><label for="log-${name}">${label}</label><select class="select" id="log-${name}" name="${name}" aria-describedby="log-${name}-error">${values.map(v => `<option value="${e(v)}">${e(v)}</option>`).join('')}</select><small>${e(helper)}</small><small class="error-text" id="log-${name}-error"></small></div>`;
  const el = dialog(title, `<form class="stack-sm official-log-form" novalidate><p>${e(alertName(alert))} · ${e(alert.location_label)}</p><p>Logged by ${e(roleLabel(Auth.roleOf(user)))} ${e(user.full_name)}</p><div class="banner banner-error" role="alert" data-error hidden></div>${rescue ? '<div class="field"><label for="choose-destination" id="destination-label">Destination facility</label><button type="button" class="btn official-facility-trigger" id="choose-destination" aria-haspopup="dialog" aria-labelledby="destination-label destination-value" aria-describedby="log-facility-info log-facility_id-error" disabled><span id="destination-value">Loading facilities…</span>' + Icons.svg('chevron-down', { size: 20 }) + '</button><small>Choose a Hospital or Evacuation Center.</small><small id="log-facility-info" data-facility-info></small><small class="error-text" id="log-facility_id-error"></small></div>' : select('response_type', 'Response type', RESPONSE_TYPES, 'First aid, Assessment, Evacuation assistance or Other')}${select(rescue ? 'rescue_status' : 'response_status', rescue ? 'Rescue status' : 'Response status', rescue ? ['In progress', 'Completed'] : ['Responding', 'Completed'], rescue ? 'In progress or Completed' : 'Responding or Completed')}<div class="field"><label for="log-notes">Notes</label><textarea class="textarea" id="log-notes" name="notes" maxlength="2000" aria-describedby="log-notes-error"></textarea><small>${rescue ? 'Describe extraction and transport assistance.' : 'Describe the assistance provided.'}</small><small class="error-text" id="log-notes-error"></small></div><small>Automatic timestamp: <time data-auto-time>${e(Fmt.dateTime(Store.now()))}</time></small><div class="actions official-log-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save ${rescue ? 'rescue' : 'response'}</button></div></form>`, { beforeClose: requestClose });
  el.classList.add('official-log-dialog');
  const form = el.querySelector('form'), error = form.querySelector('[data-error]');
  form.addEventListener('input', () => { dirty = true; error.hidden = true; });
  form.querySelector('[data-cancel]').addEventListener('click', async () => { if (await requestClose()) UI.closeDialog(el); });
  const timestamp = setInterval(() => { if (el.open && !busy) form.querySelector('[data-auto-time]').textContent = Fmt.dateTime(Store.now()); }, 30000);
  el.addEventListener('close', () => clearInterval(timestamp), { once: true });
  function chooseFacility() {
    const picker = dialog('Choose destination facility', `<div class="stack"><p>${e(alertName(alert))} · ${e(alert.location_label)}</p>${facilities.map(f => `<article class="card official-section"><h3>${e(f.name)}</h3><p>${e(facilityType(f))} · ${e(facilityDetail(f))}</p><small>${e(f.address)}</small><button type="button" class="btn" data-facility="${f.id}">Choose ${f.type === 'Hospital' ? 'hospital' : 'evacuation center'}</button></article>`).join('')}<button type="button" class="btn" data-picker-cancel>Cancel</button></div>`);
    picker.querySelector('[data-picker-cancel]').addEventListener('click', () => UI.closeDialog(picker));
    picker.querySelectorAll('[data-facility]').forEach(button => button.addEventListener('click', () => { chosen = facilities.find(f => f.id === Number(button.dataset.facility)); dirty = true; form.querySelector('#choose-destination span').textContent = chosen.name; form.querySelector('[data-facility-info]').textContent = `${facilityType(chosen)} · ${facilityDetail(chosen)}`; form.querySelector('#log-facility_id-error').textContent = ''; form.querySelector('#choose-destination').removeAttribute('aria-invalid'); UI.closeDialog(picker); }));
  }
  async function loadFacilities() {
    const button = form.querySelector('#choose-destination');
    try { facilities = await Api.facilities.list(); if (!el.isConnected) return; button.querySelector('span').textContent = facilities.length ? 'Choose destination facility' : 'No facilities available'; button.disabled = !facilities.length; }
    catch (err) { error.textContent = err.message; error.hidden = false; button.querySelector('span').textContent = 'Try loading facilities again'; button.disabled = false; }
  }
  if (rescue) { form.querySelector('#choose-destination').addEventListener('click', () => facilities.length ? chooseFacility() : loadFacilities()); loadFacilities(); }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    if (rescue && !chosen) { form.querySelector('#log-facility_id-error').textContent = 'Choose a destination facility.'; const button = form.querySelector('#choose-destination'); button.setAttribute('aria-invalid', 'true'); button.focus(); return; }
    const data = new FormData(form), payload = rescue ? { facility_id: chosen.id, rescue_status: data.get('rescue_status'), notes: data.get('notes') } : { response_type: data.get('response_type'), response_status: data.get('response_status'), notes: data.get('notes') };
    busy = true; error.hidden = true; form.setAttribute('aria-busy', 'true'); el.querySelectorAll('input,select,textarea,button').forEach(button => button.disabled = true); const save = form.querySelector('[type="submit"]'); save.textContent = 'Saving…';
    try { await (rescue ? Api.alerts.logRescue(alert.id, payload) : Api.alerts.logResponse(alert.id, payload)); dirty = false; UI.closeDialog(el); UI.toast(rescue ? 'Rescue logged.' : 'Response logged.'); await saved(); }
    catch (err) { error.textContent = err.message; error.hidden = false; for (const [name, message] of Object.entries(err.fields || {})) { const hint = form.querySelector(`#log-${name}-error`); if (hint) hint.textContent = message; form.elements[name]?.setAttribute('aria-invalid', 'true'); } error.tabIndex = -1; error.focus(); }
    finally { busy = false; form.removeAttribute('aria-busy'); el.querySelectorAll('input,select,textarea,button').forEach(button => button.disabled = false); save.textContent = `Save ${rescue ? 'rescue' : 'response'}`; }
  });
  return el;
}
