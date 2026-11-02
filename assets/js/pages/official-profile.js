import { Auth, Api, UI, Fmt } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { signOutTo } from '../core/sign-out.js';
import { openChangePassword } from '../core/change-password.js';
import { officialProfileContent } from './official-profile-view.js';

let user;
try { user=Auth.requireRole(['captain','secretary','responder','rescuer']); }
catch(error){if(!['AUTH','FORBIDDEN'].includes(error.code))document.querySelector('#app').innerHTML=UI.empty({title:'Unable to load your profile',text:error.message});}
if(user){
  const main=Shell.official({active:'Profile'});main.classList.add('official-profile-main');main.innerHTML=UI.skeleton(2);
  let current,dirty=false,busy=false,leaving=false,version=0,refreshing=false,confirming=false;
  async function mayLeave(){if(busy||confirming)return false;if(!dirty)return true;confirming=true;try{if(await UI.confirm({title:'Discard unsaved changes?',text:'Your profile changes have not been saved.',confirmLabel:'Discard changes',danger:true})){dirty=false;return true;}return false;}finally{confirming=false;}}
  async function signOut(event){if(leaving||(!dirty&&!busy))return;event.preventDefault();event.stopImmediatePropagation();if(await mayLeave()){leaving=true;if(!await signOutTo('login.html'))leaving=false;}}
  // Capture before the shell's existing logout handler; preserve its normal behavior when clean.
  document.querySelectorAll('[data-sign-out]').forEach(button=>button.addEventListener('click',signOut,true));
  document.addEventListener('click',async event=>{const link=event.target.closest('a[href]');if(!link||leaving||(!dirty&&!busy)||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(await mayLeave()){leaving=true;location.assign(link.href);}},true);
  const unload=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',unload);
  async function load(saved=false,background=false){const request=++version;
    try{
      const[person,areas]=await Promise.all([Api.users.get(user.id),Api.barangays.list()]);if(request!==version)return;
      if(background&&(dirty||busy)){main.querySelector('[data-updated]').hidden=false;return;}current=person;
      document.querySelectorAll('.official-account>p').forEach(el=>el.textContent=person.full_name);
      const avatar=document.querySelector('.official-avatar');if(avatar){avatar.textContent=Fmt.initials(person.full_name);avatar.title=person.full_name;}
      main.innerHTML=officialProfileContent(person,areas.find(b=>b.id===person.barangay_id));main.querySelector('[data-saved]').hidden=!saved;
      const form=main.querySelector('form'),error=main.querySelector('[data-profile-error]'),save=form.querySelector('[data-save]');
      main.querySelector('[data-edit]').addEventListener('click',()=>{form.querySelectorAll('[data-editable]').forEach(input=>input.readOnly=false);save.disabled=false;form.elements.full_name.focus();});
      form.addEventListener('input',event=>{if(event.target.readOnly)return;dirty=true;main.querySelector('[data-saved]').hidden=true;error.hidden=true;event.target.removeAttribute('aria-invalid');});
      form.addEventListener('submit',async event=>{event.preventDefault();if(busy||save.disabled)return;
        const patch={full_name:form.elements.full_name.value.trim(),contact_number:form.elements.contact_number.value.trim()};
        if(!patch.full_name){error.textContent='Enter your full name.';error.hidden=false;form.elements.full_name.setAttribute('aria-invalid','true');form.elements.full_name.focus();return;}
        busy=true;form.setAttribute('aria-busy','true');form.querySelectorAll('input,button').forEach(el=>el.disabled=true);error.hidden=true;
        try{await Api.users.update(user.id,patch);dirty=false;await load(true);UI.toast('Changes saved.');main.querySelector('[data-edit]').focus();}
        catch(err){error.textContent=err.message;error.hidden=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);}
        finally{busy=false;form.removeAttribute('aria-busy');}
      });
      main.querySelector('[data-reload]').addEventListener('click',async()=>{if(await mayLeave())load();});
      main.querySelector('[data-change-password]').addEventListener('click',openChangePassword);
      main.querySelector('[data-profile-signout]').addEventListener('click',async()=>{if(await mayLeave()){leaving=true;if(!await signOutTo('login.html'))leaving=false;}});
    }catch(err){if(request!==version)return;if(background){UI.toast(err.message,'error');return;}main.innerHTML=UI.empty({title:'Unable to load your profile',text:err.message})+'<button class="btn" data-retry>Try again</button>';main.querySelector('[data-retry]').addEventListener('click',()=>load());}
  }
  async function refresh(){if(busy||refreshing)return;refreshing=true;try{const next=await Api.users.get(user.id);if(busy)return;if(JSON.stringify(next)!==JSON.stringify(current)){if(dirty)main.querySelector('[data-updated]').hidden=false;else await load(false,true);}}catch(err){UI.toast(err.message,'error');}finally{refreshing=false;}}
  const off=Api.subscribe('users',refresh);window.addEventListener('pagehide',event=>{if(!event.persisted){version++;off();window.removeEventListener('beforeunload',unload);}},{once:true});
  load();
}
