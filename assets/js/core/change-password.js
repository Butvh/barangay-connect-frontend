import { Api } from './api.js';
import { UI } from './ui.js';
import { Icons } from './icons.js';
import { passwordRequirements, validatePasswordChange } from './account-security.js';

let active;
const requirements = ['At least 8 characters', 'Includes an uppercase letter (A–Z)', 'Includes a lowercase letter (a–z)', 'Includes a number (0–9)'];
export function openChangePassword() {
  if (active?.isConnected) { UI.openDialog(active); return active; }
  const d = document.createElement('dialog'); active = d;
  d.className = 'password-dialog'; d.setAttribute('aria-labelledby', 'password-title'); d.setAttribute('aria-describedby', 'password-subtitle');
  const fields = [['current_password', 'Current password', 'Enter your current password', 'current-password'], ['password', 'New password', 'Enter a new password', 'new-password'], ['password_confirmation', 'Confirm new password', 'Re-enter your new password', 'new-password']];
  d.innerHTML = `<button type="button" class="icon-btn password-close" data-close aria-label="Close change password">${Icons.svg('x')}</button><header class="password-heading"><span class="icon-tile round">${Icons.svg('lock', {size:32})}</span><h2 id="password-title">Change password</h2><p id="password-subtitle">Update your password to keep your account secure.</p></header><p class="password-availability" role="status" data-availability>Checking account security…</p><form novalidate>${fields.map(([name,label,placeholder,autocomplete])=>`<div class="field"><label for="change-${name}">${label}</label><div class="password-input"><input class="input" id="change-${name}" name="${name}" type="password" autocomplete="${autocomplete}" placeholder="${placeholder}"${name==='current_password'?'':' maxlength="128"'} required aria-describedby="change-${name}-error"><button type="button" class="icon-btn" data-toggle-password="${name}" aria-label="Show ${label.toLowerCase()}" aria-pressed="false">${Icons.svg('eye')}</button></div><small class="error-text" id="change-${name}-error" data-error="${name}"></small></div>`).join('')}<section class="password-requirements" aria-label="Password requirements"><div>${Icons.svg('shield-check')}<strong>Password requirements</strong></div><ul>${requirements.map((label,index)=>`<li data-requirement="${index}"><span data-requirement-icon>${Icons.svg('minus',{size:16})}</span><span>${label}</span><span class="sr-only" data-requirement-state>Not met</span></li>`).join('')}</ul></section><p class="error-text" role="alert" data-submit-error hidden></p><div class="password-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary" data-update disabled>Update password</button></div></form>`;
  const form = d.querySelector('form'), submit = d.querySelector('[data-update]'), error = d.querySelector('[data-submit-error]');
  let busy = false, ready = false, closed = false;
  function controls() { d.querySelectorAll('input,button').forEach(el=>el.disabled=busy); submit.disabled=busy||!ready; submit.textContent=busy?'Updating…':'Update password'; }
  function clear() { form.reset(); form.querySelectorAll('input').forEach(input=>{input.value='';input.type='password';}); }
  function close() { if (!busy) d.close(); }
  d.querySelector('[data-close]').addEventListener('click', close); d.querySelector('[data-cancel]').addEventListener('click', close);
  d.addEventListener('cancel', event=>{if(busy)event.preventDefault();});
  d.addEventListener('click', event=>{if(busy&&event.target===d)event.stopImmediatePropagation();},true);
  const pagehide=()=>{clear();d.close();}; window.addEventListener('pagehide',pagehide,{once:true});
  d.addEventListener('close',()=>{closed=true;clear();active=null;window.removeEventListener('pagehide',pagehide);d.remove();},{once:true});
  d.querySelectorAll('[data-toggle-password]').forEach(button=>button.addEventListener('click',()=>{
    const input=form.elements[button.dataset.togglePassword], show=input.type==='password'; input.type=show?'text':'password';
    const label=fields.find(([name])=>name===input.name)[1].toLowerCase(); button.setAttribute('aria-label',`${show?'Hide':'Show'} ${label}`); button.setAttribute('aria-pressed',String(show)); button.innerHTML=Icons.svg(show?'eye-off':'eye');
  }));
  form.addEventListener('input', event=>{
    const name=event.target.name;if(!fields.some(([key])=>key===name))return;
    form.elements[name].removeAttribute('aria-invalid');d.querySelector(`[data-error="${name}"]`).textContent='';error.hidden=true;
    passwordRequirements(form.elements.password.value).forEach((met,index)=>{
      const item=d.querySelector(`[data-requirement="${index}"]`);item.classList.toggle('satisfied',met);item.querySelector('[data-requirement-icon]').innerHTML=Icons.svg(met?'check':'minus',{size:16});item.querySelector('[data-requirement-state]').textContent=met?'Met':'Not met';
    });
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!ready)return;
    for(const[name]of fields){form.elements[name].removeAttribute('aria-invalid');d.querySelector(`[data-error="${name}"]`).textContent='';}
    error.hidden=true;
    try {
      const payload=validatePasswordChange(Object.fromEntries(fields.map(([name])=>[name,form.elements[name].value])));
      busy=true;controls();
      await Api.account.changePassword(payload);
      if(!closed){busy=false;d.close();UI.toast('Password updated.');}
    } catch(err) {
      if(closed)return;
      // Do not echo credentials, server response bodies or arbitrary server messages.
      const known = err.code === 'NOT_AVAILABLE' ? 'Password changes are unavailable in this browser demo. Connect a secure account server first.' : err.code === 'VALIDATION' ? 'Check the password fields.' : 'Unable to update your password. Check your current password or try again later.';
      error.textContent=known;error.hidden=false;
      let first;for(const[name,message]of Object.entries(err.fields||{})){if(!fields.some(([key])=>key===name))continue;const input=form.elements[name];input.setAttribute('aria-invalid','true');d.querySelector(`[data-error="${name}"]`).textContent=message;first||=input;}first?.focus();
    } finally {busy=false;if(!closed)controls();}
  });
  document.body.append(d);UI.openDialog(d);
  Api.account.security().then(info=>{if(closed)return;ready=true;d.querySelector('[data-availability]').textContent=info.password_change_available?'': 'Password updates are unavailable in this browser demo until a secure server is connected. Use fictional values for testing.';d.querySelector('[data-availability]').hidden=info.password_change_available;controls();}).catch(()=>{if(!closed){d.querySelector('[data-availability]').textContent='Account security is unavailable. Close this dialog and sign in again.';}});
  return d;
}
