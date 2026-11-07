import { Runtime } from './runtime-config.js';
import { Api } from './api.js';
import { Auth } from './auth.js';
import { UI } from './ui.js';

const purposes = [
  { key: 'incident_review', label: 'New alerts awaiting review', template: 'alert-review.v1', roles: ['captain', 'secretary'] },
  { key: 'barangay_announcements', label: 'Barangay announcements', template: 'announcement-review.v1', roles: ['resident', 'captain', 'secretary'] },
];
const identity = auth => { const a = auth.current(); return a ? `${a.id}:${a.barangay_id}:${auth.roleOf(a)}:${a.session_observation || ''}` : null; };

// The same self-only component serves both profiles; no contact field grants consent.
export function mountConsentPreferences(host, { api = Api, auth = Auth } = {}) {
  if (Runtime.mode !== 'backend' || Runtime.operationalTest !== true || Runtime.consentTest !== true) return () => {};
  const observed = identity(auth), role = auth.roleOf(auth.current());
  let disposed = false;
  const section = document.createElement('section'); section.className = 'card card-plain stack';
  section.innerHTML = '<h2>SMS preferences</h2><p>Choose the updates you agree to receive by SMS. Each preference is saved separately. You can withdraw it here.</p><div class="stack" data-preferences></div>';
  host.append(section);
  const list = section.querySelector('[data-preferences]');
  const current = () => { if (disposed || identity(auth) !== observed) throw new Error('Your session changed. Reopen your profile.'); };
  for (const purpose of purposes) {
    const form = document.createElement('form'); form.className = 'stack-sm'; form.noValidate = true; form.setAttribute('aria-label', purpose.label + ' SMS preference');
    form.innerHTML = `<h3>${purpose.label}</h3><p role="status" data-state>Loading preference…</p><label class="notification-preference-choice"><input type="checkbox" name="consent" disabled> I agree to receive SMS for ${purpose.label.toLowerCase()}.</label><div class="banner banner-error" role="alert" data-error hidden></div><div class="actions"><button class="btn btn-primary" type="submit" disabled>Save preference</button><button class="btn" type="button" data-reload>Reload preference</button></div>`;
    list.append(form);
    const checkbox = form.elements.consent, save = form.querySelector('[type=submit]'), reload = form.querySelector('[data-reload]'), error = form.querySelector('[data-error]'), state = form.querySelector('[data-state]');
    let row = null, busy = false;
    const allowed = purpose.roles.includes(role);
    function controls() {
      checkbox.disabled = busy || !row || (!allowed && row.state !== 'granted');
      save.disabled = busy || !row || checkbox.checked === (row.state === 'granted') || (!allowed && checkbox.checked);
      reload.disabled = busy;
    }
    function accept(value) {
      if (!value || value.purpose !== purpose.key || value.channel !== 'sms' || !['not_granted', 'granted', 'revoked'].includes(value.state) || !Number.isSafeInteger(value.revision)) throw new Error('This preference could not be read. Reload it to try again.');
      row = value;
      checkbox.checked = row.state === 'granted' && row.policy_version === 'sms-consent.v1' && row.template_version === purpose.template;
      state.textContent = row.state === 'granted' && checkbox.checked ? 'SMS allowed for this purpose.' : row.state === 'revoked' ? 'SMS permission withdrawn.' : 'SMS not enabled for this purpose.';
      if (!allowed) state.textContent += ' Your current role cannot enable this preference.';
    }
    async function load() {
      if (busy) return; busy = true; error.hidden = true; controls();
      try { current(); const value = await api.notificationPreferences.get(purpose.key); current(); accept(value); }
      catch (failure) { error.textContent = failure.message; error.hidden = false; }
      finally { busy = false; controls(); }
    }
    checkbox.addEventListener('change', controls); reload.addEventListener('click', load);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || save.disabled) return;
      busy = true; error.hidden = true; controls(); form.setAttribute('aria-busy', 'true');
      const label = save.textContent; save.textContent = 'Saving…';
      try {
        current(); const value = await api.notificationPreferences.set(purpose.key, { state: checkbox.checked ? 'granted' : 'revoked',
          expected_revision: row.revision, policy_version: 'sms-consent.v1', template_version: purpose.template });
        current(); accept(value); UI.toast('SMS preference saved.');
      } catch (failure) { error.textContent = failure.message + ' Reload the preference to review the saved state.'; error.hidden = false; }
      finally { busy = false; save.textContent = label; form.removeAttribute('aria-busy'); controls(); }
    });
    load();
  }
  return () => { disposed = true; section.remove(); };
}
