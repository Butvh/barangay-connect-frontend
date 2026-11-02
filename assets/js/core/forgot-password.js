import { Api } from './api.js';
import { UI } from './ui.js';
import { Icons } from './icons.js';
import { passwordRequirements, validateResetPassword } from './account-security.js';

let active;
const requirements=['At least 8 characters','Includes an uppercase letter (A–Z)','Includes a lowercase letter (a–z)','Includes a number (0–9)'];
const messages={NOT_AVAILABLE:'Password recovery is unavailable in this browser demo. A secure account server must be connected before codes can be emailed or passwords reset.',INVALID_CODE:'The code is incorrect or no longer valid. Check your code or request another one.',CODE_EXPIRED:'This code has expired. Request another code.',AUTHORIZATION_EXPIRED:'Your reset authorization has expired. Close this panel and start again.',RATE_LIMIT:'Too many attempts. Wait before trying again.',COOLDOWN:'Wait for the countdown before requesting another code.',RECOVERY_STATE:'Close this panel and start password recovery again.'};
export function openPasswordRecovery({portal,service=Api.recovery,email=''}={}){
  if(!['resident','official'].includes(portal))throw new Error('A sign-in origin is required.');
  if(active?.isConnected){UI.openDialog(active);return active;}
  service.clear();
  const d=document.createElement('dialog');active=d;d.className='recovery-dialog';d.setAttribute('aria-labelledby','recovery-title');d.setAttribute('aria-describedby','recovery-description');
  let busy=false,closed=false,timer;
  const q=selector=>d.querySelector(selector);
  const wipe=()=>d.querySelectorAll('input').forEach(input=>{input.value='';if(input.type==='text'&&input.name?.includes('password'))input.type='password';});
  function close(){if(!busy)d.close();}
  function cleanup(){if(closed)return;closed=true;wipe();clearInterval(timer);service.clear();active=null;window.removeEventListener('pagehide',pagehide);d.remove();}
  const pagehide=()=>{wipe();service.clear();d.close();cleanup();};
  d.addEventListener('close',cleanup,{once:true});d.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  d.addEventListener('click',event=>{if(busy&&event.target===d)event.stopImmediatePropagation();},true);
  window.addEventListener('pagehide',pagehide,{once:true});
  const input=(name,label,placeholder,autocomplete)=>`<div class="field"><label for="recovery-${name}">${label}</label><div class="recovery-password"><input class="input" id="recovery-${name}" name="${name}" type="password" autocomplete="${autocomplete}" placeholder="${placeholder}" required aria-describedby="recovery-${name}-error"><button type="button" class="icon-btn" data-password-toggle="${name}" aria-label="Show ${label.toLowerCase()}" aria-pressed="false">${Icons.svg('eye',{size:20})}</button></div><small class="error-text" id="recovery-${name}-error"></small></div>`;
  function payload(){return {password:q('[name="password"]').value,password_confirmation:q('[name="password_confirmation"]').value};}
  function code(){return [...d.querySelectorAll('[data-code-digit]')].map(el=>el.value).join('');}
  function sync(){
    if(closed)return;const {stage,retry_in}=service.state();
    d.querySelectorAll('input,button').forEach(el=>el.disabled=busy);
    q('[data-close]').disabled=busy;q('[data-submit]').disabled=busy;
    q('form').setAttribute('aria-busy',String(busy));
    if(stage==='verify'){q('[data-resend]').disabled=busy||retry_in>0;q('[data-countdown]').textContent=retry_in>0?` (in ${retry_in}s)`:'';q('[data-submit]').disabled=busy||!/^\d{6}$/.test(code());}
    if(stage==='reset'){
      const p=payload();let valid=true;try{validateResetPassword(p);}catch{valid=false;}q('[data-submit]').disabled=busy||!valid;
      passwordRequirements(p.password).forEach((met,i)=>{const item=q(`[data-requirement="${i}"]`);item.classList.toggle('satisfied',met);item.querySelector('[data-check]').innerHTML=Icons.svg(met?'check':'minus',{size:16});item.querySelector('[data-state]').textContent=met?'Met':'Not met';});
    }
    q('[data-submit]').textContent=busy?'Processing…':({request:'Send reset code',verify:'Verify code',reset:'Reset password'})[stage];
  }
  function showError(err){
    const error=q('[data-error]');error.textContent=messages[err.code]||(err.code==='VALIDATION'?'Check the highlighted fields.':'Unable to complete password recovery. Try again later.');error.hidden=false;
    if(err.code==='VALIDATION')for(const key of ['email','password','password_confirmation']){if(!err.fields?.[key])continue;const field=q(`[name="${key}"]`);if(!field)continue;field.setAttribute('aria-invalid','true');q(`#recovery-${key}-error`).textContent=key==='email'?'Enter a valid email address.':key==='password_confirmation'?'The new passwords must match.':'Use 8–128 characters with uppercase, lowercase and a number.';field.focus();break;}
  }
  async function action(fn){if(busy||closed)return;busy=true;sync();q('[data-error]').hidden=true;
    try{await fn();if(closed)return;busy=false;if(service.state().stage==='request'){wipe();d.close();UI.toast('Password updated. Sign in with your new password.');}else render();}
    catch(err){if(!closed){busy=false;sync();showError(err);}}finally{busy=false;if(!closed)sync();}
  }
  function render(){
    wipe();clearInterval(timer);
    const {stage}=service.state(), title={request:'Forgot password?',verify:'Enter reset code',reset:'Reset your password'}[stage];
    const description={request:'Enter your registered email address and we’ll send you a password reset code.',verify:'Enter the six-digit verification code sent to your registered email address.',reset:'Create a new password for your account.'}[stage];
    const body=stage==='request'?`<div class="field"><label for="recovery-email">Email address</label><div class="recovery-email">${Icons.svg('mail',{size:20})}<input class="input" id="recovery-email" name="email" type="email" autocomplete="email" placeholder="Enter your email address" maxlength="254" required aria-describedby="recovery-email-error"></div><small class="error-text" id="recovery-email-error"></small></div>`:stage==='verify'?`<p class="recovery-neutral" role="status">If this email is registered, a verification code will be sent.</p><div class="recovery-code" role="group" aria-label="Six-digit verification code">${Array.from({length:6},(_,i)=>`<input class="input" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="${i===0?'one-time-code':'off'}" data-code-digit="${i}" aria-label="Code digit ${i+1}" aria-describedby="recovery-error">`).join('')}</div><p class="recovery-resend">Didn’t receive the code? <button class="login-text-action" type="button" data-resend>Resend code</button><span data-countdown></span></p>`:`${input('password','New password','Enter new password','new-password')}${input('password_confirmation','Confirm new password','Re-enter new password','new-password')}<section class="recovery-requirements" aria-label="Password requirements"><div>${Icons.svg('shield-check')}<strong>Password requirements</strong></div><ul>${requirements.map((label,i)=>`<li data-requirement="${i}"><span data-check></span>${label}<span class="sr-only" data-state>Not met</span></li>`).join('')}</ul></section>`;
    d.innerHTML=`<header class="recovery-brand"><img src="assets/img/logo.png" width="28" height="28" alt=""><strong>Barangay Connect</strong><button type="button" class="icon-btn" data-close aria-label="Close password recovery">${Icons.svg('x')}</button></header><div class="recovery-heading"><span class="icon-tile round">${Icons.svg({request:'mail',verify:'shield-check',reset:'lock'}[stage],{size:36})}</span><h2 id="recovery-title">${title}</h2><p id="recovery-description">${description}</p></div>${stage==='request'&&!service.available?'<p class="recovery-unavailable" role="status">Email codes and password resets require a secure backend and are unavailable in this browser demo. Use fictional values for testing.</p>':''}<form novalidate>${body}<p class="error-text" id="recovery-error" data-error role="alert" hidden></p><div class="recovery-actions">${stage==='reset'?'<button class="btn" type="button" data-cancel>Cancel</button>':''}<button class="btn btn-primary" type="submit" data-submit>${stage==='request'?'Send reset code':stage==='verify'?'Verify code':'Reset password'}</button></div></form>${stage==='reset'?'':'<footer class="recovery-footer"><button type="button" class="login-text-action" data-back>Back to sign in</button></footer>'}`;
    q('[data-close]').addEventListener('click',close);q('[data-back]')?.addEventListener('click',close);q('[data-cancel]')?.addEventListener('click',close);
    q('form').addEventListener('input',event=>{q('[data-error]').hidden=true;event.target.removeAttribute('aria-invalid');if(['email','password','password_confirmation'].includes(event.target.name))q(`#recovery-${event.target.name}-error`).textContent='';sync();});
    q('form').addEventListener('submit',event=>{event.preventDefault();if(busy)return;if(stage==='reset'){try{validateResetPassword(payload());}catch(err){showError(err);return;}}return action(()=>stage==='request'?service.requestCode({email:q('[name="email"]').value,portal}):stage==='verify'?service.verifyCode(code()):service.resetPassword(payload()));});
    if(stage==='request')q('[name="email"]').value=email;
    if(stage==='verify'){
      const boxes=[...d.querySelectorAll('[data-code-digit]')];
      const put=(index,text)=>{if(!/^\d{1,6}$/.test(text)){showError({code:'INVALID_CODE'});return;}if(text.length===6)index=0;[...text].slice(0,6-index).forEach((digit,n)=>boxes[index+n].value=digit);boxes[Math.min(5,index+text.length)].focus();q('[data-error]').hidden=true;sync();};
      boxes.forEach((box,i)=>{box.addEventListener('input',()=>{const value=box.value;if(value===''){sync();return;}box.value='';put(i,value);});box.addEventListener('paste',event=>{event.preventDefault();put(i,event.clipboardData?.getData('text').trim()||'');});box.addEventListener('focus',()=>box.select());box.addEventListener('keydown',event=>{if(event.key==='Backspace'&&!box.value&&i>0){event.preventDefault();boxes[i-1].value='';boxes[i-1].focus();sync();}if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();boxes[Math.max(0,Math.min(5,i+(event.key==='ArrowRight'?1:-1)))].focus();}});});
      q('[data-resend]').addEventListener('click',()=>action(()=>service.resendCode()));timer=setInterval(sync,1000);
    }
    d.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{const field=q(`[name="${button.dataset.passwordToggle}"]`),show=field.type==='password';field.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',`${show?'Hide':'Show'} ${field.name==='password'?'new password':'confirm new password'}`);button.innerHTML=Icons.svg(show?'eye-off':'eye',{size:20});}));
    sync();(stage==='request'?q('[name="email"]'):stage==='verify'?q('[data-code-digit]'):q('[name="password"]'))?.focus();
  }
  document.body.append(d);render();UI.openDialog(d);return d;
}
