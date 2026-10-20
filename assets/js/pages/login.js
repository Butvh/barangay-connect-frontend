import { Auth } from '../core/auth.js';
import { Config } from '../core/config.js';
import { Store } from '../core/store.js';
import { UI } from '../core/ui.js';
import { Icons } from '../core/icons.js';

let startupError = null;
try { Auth.requireRole([]); } catch (error) { startupError = error; }
const app = document.querySelector('#app');
if (document.body.dataset.entry === 'index') {
  const current = startupError ? null : Auth.current(); location.replace(current ? Auth.homeFor(current) : 'login.html');
} else {
  const brand = '<a class="brand" href="login.html"><img src="assets/img/logo.png" width="48" height="48" alt=""><span class="brand-full">Barangay Connect</span></a>';
  app.innerHTML = `<main class="login-page"><div class="login-mobile-brand">${brand}</div><section class="login-card" aria-label="Official sign in"><aside class="login-visual"><img src="assets/img/login-community.png" alt="Aerial view of a barangay community">${brand}<div class="login-story"><h2>Report emergencies.<br>Coordinate response.<br>Protect the community.</h2><p>Residents and barangay officials, connected.</p></div></aside><div class="login-form-wrap"><form class="login-form" novalidate id="official-login"><header><span class="official-portal">Official portal</span><h1>Sign in</h1><p>Welcome back to Barangay Connect.</p></header><div class="banner banner-error" id="login-error" role="alert" hidden></div><div class="field"><label for="email">Email</label><div class="official-input-shell"><input class="input" id="email" name="email" type="email" autocomplete="username" placeholder="ana.reyes@example.com" required maxlength="254" aria-describedby="email-error"></div><small class="error-text" id="email-error"></small></div><div class="field"><label for="password">Password</label><div class="official-input-shell"><div class="password-wrap"><input class="input" id="password" name="password" type="password" autocomplete="current-password" required aria-describedby="password-error"><button class="icon-btn" id="show-password" type="button" aria-label="Show password" aria-pressed="false">${Icons.svg('eye', { size: 20 })}</button></div></div><small class="error-text" id="password-error"></small></div><button class="btn btn-primary full official-sign-in" type="submit" id="sign-in"><span>Sign in</span><span class="official-loading" hidden>${Icons.svg('loader-circle', { size: 20 })}</span></button><div class="login-links"><a class="btn btn-ghost" href="resident-login.html">Sign in as resident</a><a href="register.html">Register as resident</a></div>${Config.DEMO_MODE ? `<details class="official-demo"><summary>Demo sign-in</summary><small>Fictional accounts · password: demo1234</small><div class="demo-accounts">${[['Resident', 'maria.santos'], ['Secretary', 'ana.reyes'], ['Responder', 'carlo.mendoza'], ['Rescuer', 'ramon.bautista']].map(([role, account]) => `<button type="button" class="btn btn-small" data-demo="${account}">${role}</button>`).join('')}</div><button type="button" class="btn btn-ghost full" id="reset-demo">Reset demo data</button></details>` : ''}</form></div></section></main>`;
  const form = app.querySelector('form'), email = form.elements.email, password = form.elements.password, error = form.querySelector('#login-error');
  if (startupError) { error.textContent = startupError.message; error.hidden = false; }
  let busy = false;
  function fieldError(name, message = '') {
    const field = form.elements[name]; field.setAttribute('aria-invalid', String(Boolean(message))); form.querySelector(`#${name}-error`).textContent = message;
  }
  for (const field of [email, password]) field.addEventListener('input', () => { fieldError(field.name); error.hidden = true; });
  form.querySelector('#show-password').addEventListener('click', event => {
    const show = password.type === 'password'; password.type = show ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); event.currentTarget.setAttribute('aria-pressed', String(show)); event.currentTarget.innerHTML = Icons.svg(show ? 'eye-off' : 'eye', { size: 20 });
  });
  async function signIn(address, secret) {
    if (busy) return; fieldError('email'); fieldError('password'); error.hidden = true;
    const invalidEmail = !String(address).trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(address).trim());
    if (invalidEmail) fieldError('email', 'Enter a valid email address.');
    if (!secret) fieldError('password', 'Enter your password.');
    if (invalidEmail || !secret) { (invalidEmail ? email : password).focus(); return; }
    busy = true; form.setAttribute('aria-busy', 'true'); form.querySelectorAll('button,input').forEach(el => el.disabled = true);
    const button = form.querySelector('#sign-in'); button.querySelector('span').textContent = 'Signing in…'; button.querySelector('.official-loading').hidden = false;
    try { const user = await Auth.login(address, secret); location.assign(Auth.homeFor(user)); }
    catch (err) { error.textContent = err.message || 'Unable to sign in. Please try again.'; error.hidden = false; if (err.code === 'AUTH') fieldError('password', 'Check your email and password.'); }
    finally { busy = false; form.removeAttribute('aria-busy'); form.querySelectorAll('button,input').forEach(el => el.disabled = false); button.querySelector('span').textContent = 'Sign in'; button.querySelector('.official-loading').hidden = true; if (!error.hidden) password.focus(); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); signIn(email.value, password.value); });
  form.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => signIn(`${button.dataset.demo}@example.com`, 'demo1234')));
  form.querySelector('#reset-demo')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    if (busy) return;
    if (await UI.confirm({ title: 'Reset demo data?', text: 'Restore the fictional sample records in this browser? Changes in the current demo will be replaced.', confirmLabel: 'Reset demo data', danger: true })) {
      button.disabled = true;
      try { await Store.reset(); Auth.logout(); form.reset(); fieldError('email'); fieldError('password'); error.hidden = true; UI.toast('Demo data reset.'); email.focus(); }
      catch (err) { error.textContent = err.message; error.hidden = false; } finally { button.disabled = false; }
    }
  });
}
