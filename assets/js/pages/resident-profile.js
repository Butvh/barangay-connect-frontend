import { Auth } from '../core/auth.js';
import { Api } from '../core/api.js';
import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';
import { Fmt } from '../core/format.js';
import { BCMap } from '../core/map.js';
import { Shell } from '../core/shell-resident.js';

let user;
try { Auth.requireRole(['resident']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to load your profile', text: error.message, action: { href: 'resident-login.html', label: 'Back to sign in' } }); }
if (user) {
  const main = Shell.resident({ active: 'Profile' }), e = UI.escape; main.classList.add('p1-profile'); main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading profile…</p>' + UI.skeleton(2);
  let dirty = false, busy = false, leaving = false, current, mapView, loadVersion = 0;
  const unload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  async function mayLeave() {
    if (!dirty) return true;
    if (await UI.confirm({ title: 'Discard unsaved changes?', text: 'Your profile changes have not been saved.', confirmLabel: 'Discard changes', danger: true })) { dirty = false; return true; }
    return false;
  }
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]');
    if (!dirty || !link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const url = new URL(link.href); if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault(); if (leaving) return; leaving = true;
    try { if (await mayLeave()) location.assign(link.href); } finally { leaving = false; }
  });
  function field(name, label, value, { readonly = false, type = 'text', max = 200, autocomplete = 'off' } = {}) {
    return `<div class="field"><label for="profile-${name}">${label}</label><input class="input" id="profile-${name}" name="${name}" type="${type}" value="${e(value)}" maxlength="${max}" autocomplete="${autocomplete}"${readonly ? ' readonly' : ''} aria-describedby="profile-${name}-error"><small class="error-text" id="profile-${name}-error"></small></div>`;
  }
  async function load(saved = false) {
    const version = ++loadVersion;
    try {
      const [resident, barangays] = await Promise.all([Api.users.get(user.id), Api.barangays.list()]); if (version !== loadVersion) return; current = resident;
      const barangay = barangays.find(b => b.id === resident.barangay_id)?.name || 'Your barangay', household = resident.household, status = resident.verification?.review_status || 'Pending';
      mapView?.destroy();
      main.innerHTML = `<header class="official-heading"><h1>Profile and household</h1><p>Keep your contact information and household address up to date.</p></header><div class="banner banner-success" role="status" id="profile-saved"${saved ? '' : ' hidden'}>${Icons.svg('circle-check')}<p>Changes saved.</p></div><div id="profile-update-notice" class="banner" role="status" hidden><p>Your saved profile changed in another tab. Your edits are still here.</p><button type="button" class="btn btn-small" id="reload-profile">Reload saved profile</button></div><form id="profile-form" class="p1-profile-grid" novalidate><section class="card card-plain p1-profile-card"><div class="p1-profile-identity"><span class="p1-profile-avatar" aria-hidden="true">${e(Fmt.initials(resident.full_name))}</span><div><h2>${e(resident.full_name)}</h2><p>${e(barangay)}</p></div></div>${field('full_name', 'Full name', resident.full_name, { max: 100, autocomplete: 'name' })}${field('email', 'Email address', resident.email, { readonly: true, type: 'email', max: 254, autocomplete: 'username' })}${field('contact_number', 'Contact number', resident.contact_number || '', { max: 30, type: 'tel', autocomplete: 'tel' })}<div id="profile-error" class="banner banner-error" role="alert" hidden></div><button class="btn btn-primary p1-profile-save-desktop" type="submit" data-save-profile>Save changes</button><div class="p1-profile-signout"><div class="row">${Icons.svg('log-out')}<div><p>Sign out of Barangay Connect</p><small>Sign out in this tab.</small></div></div><button class="btn" type="button" id="profile-signout">Sign out</button></div></section><section class="card card-plain p1-profile-card"><div class="p1-profile-household-heading"><span class="icon-tile round">${Icons.svg('house', { size: 28 })}</span><div class="grow"><h2>Your household</h2><p>Your household address helps us provide location-based services and keep your information accurate.</p></div>${UI.badge(status)}</div><div class="p1-profile-summary"><div class="row">${Icons.svg('shield-check')}<div><strong>${status === 'Approved' ? 'Household verified' : 'Verification ' + e(status.toLowerCase())}</strong><p>${status === 'Approved' ? 'Your household information is verified.' : 'View your verification page for the current review status.'}</p></div></div><div class="row">${Icons.svg('map-pin')}<div><strong>Saved household pin</strong><p>Your address is set on the map.</p></div></div></div><div class="field"><label for="profile-barangay">Barangay</label><input class="input" id="profile-barangay" readonly value="${e(barangay)}"></div>${field('address', 'Household address', household?.address || '', { autocomplete: 'street-address' })}<div class="p1-profile-map"><div id="profile-map"></div><a class="btn btn-small" href="resident-map.html">${Icons.svg('map', { size: 20 })}View on map</a></div></section><button type="submit" class="btn btn-primary p1-profile-save-mobile" data-save-profile>Save changes</button></form>`;
      const form = main.querySelector('#profile-form'), error = main.querySelector('#profile-error');
      const clearError = name => { form.elements[name].removeAttribute('aria-invalid'); form.querySelector(`#profile-${name}-error`).textContent = ''; };
      form.addEventListener('input', event => { if (event.target.readOnly) return; dirty = true; main.querySelector('#profile-saved').hidden = true; error.hidden = true; if (['full_name', 'contact_number', 'address'].includes(event.target.name)) clearError(event.target.name); });
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy) return;
        const data = new FormData(form), patch = { full_name: String(data.get('full_name')).trim(), contact_number: String(data.get('contact_number')).trim(), address: String(data.get('address')).trim() };
        let first;
        for (const name of ['full_name', 'contact_number', 'address']) { clearError(name); if (name !== 'contact_number' && !patch[name]) { form.elements[name].setAttribute('aria-invalid', 'true'); form.querySelector(`#profile-${name}-error`).textContent = 'This field is required.'; first ||= form.elements[name]; } }
        if (first) { first.focus(); return; }
        busy = true; form.setAttribute('aria-busy', 'true'); form.querySelectorAll('input,button').forEach(el => el.disabled = true); form.querySelectorAll('[data-save-profile]').forEach(el => el.textContent = 'Saving…');
        try { await Api.users.update(user.id, patch); dirty = false; await load(true); UI.toast('Changes saved.'); [...main.querySelectorAll('[data-save-profile]')].find(button => button.getClientRects().length)?.focus(); }
        catch (err) { error.textContent = err.message; error.hidden = false; for (const [name, text] of Object.entries(err.fields || {})) { if (!form.elements[name]) continue; form.elements[name].setAttribute('aria-invalid', 'true'); form.querySelector(`#profile-${name}-error`).textContent = text; } }
        finally { busy = false; form.removeAttribute('aria-busy'); form.querySelectorAll('input,button').forEach(el => el.disabled = false); form.querySelectorAll('[data-save-profile]').forEach(el => el.textContent = 'Save changes'); }
      });
      main.querySelector('#reload-profile').addEventListener('click', async () => { if (await mayLeave()) load(); });
      main.querySelector('#profile-signout').addEventListener('click', async () => { if (busy) return; if (await mayLeave()) { Auth.logout(); location.assign('resident-login.html'); } });
      if (household) mapView = BCMap.mount(main.querySelector('#profile-map'), { barangay_id: resident.barangay_id, controls: false, interactive: false, markers: [{ id: 'household', kind: 'own_household', x: household.map_x, y: household.map_y, label: 'My household', selected: true }], onSelect: async () => { if (await mayLeave()) location.assign('resident-map.html'); } });
    } catch (err) { if (version !== loadVersion) return; main.innerHTML = UI.empty({ icon: 'triangle-alert', title: 'Unable to load your profile', text: err.message }) + '<button type="button" class="btn btn-primary" id="profile-retry">Try again</button>'; main.querySelector('button').addEventListener('click', () => load()); }
    finally { if (version === loadVersion) main.removeAttribute('aria-busy'); }
  }
  let refreshing = false;
  async function refresh() {
    if (busy || refreshing) return; refreshing = true;
    try { const next = await Api.users.get(user.id); if (JSON.stringify(next) === JSON.stringify(current)) return; if (dirty) main.querySelector('#profile-update-notice').hidden = false; else await load(); } catch (err) { UI.toast(err.message, 'error'); } finally { refreshing = false; }
  }
  const offs = ['users', 'verification'].map(entity => Api.subscribe(entity, refresh));
  window.addEventListener('pagehide', event => { if (event.persisted) return; offs.forEach(off => off()); mapView?.destroy(); window.removeEventListener('beforeunload', unload); }, { once: true });
  load();
}
