import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createStore, memoryStorage } from '../assets/js/core/store.js';
import { createAuth } from '../assets/js/core/auth.js';
import { createApi } from '../assets/js/core/api.js';
import { Fmt } from '../assets/js/core/format.js';
import { UI } from '../assets/js/core/ui.js';
import { officialProfileContent } from '../assets/js/pages/official-profile-view.js';

async function run() {
  let passed=0;
  const check=async(name,fn)=>{await fn();passed++;console.log(`PASS ${name}`);};
  const settle=async()=>{for(let n=0;n<6;n++)await new Promise(r=>setImmediate(r));};
  const source=await readFile(new URL('../assets/js/core/change-password.js',import.meta.url),'utf8');
  async function modal({available=false,changePassword}={}) {
    const els=new Map(),inputs=['current_password','password','password_confirmation'];let calls=0,toasts=[];
    const element=selector=>{if(!els.has(selector))els.set(selector,{value:'',type:'password',dataset:{},hidden:false,disabled:false,textContent:'',listeners:{},classList:{toggle(k,v){this[k]=v;}},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},focus(){this.focused=true;},querySelector:element,querySelectorAll:selector=>selector==='input'?inputs.map(element):selector==='[data-toggle-password]'?inputs.map(k=>element('toggle-'+k)):[],remove(){this.isConnected=false;},isConnected:true});return els.get(selector);};
    for(const k of inputs){element(k).name=k;element('toggle-'+k).dataset.togglePassword=k;}
    const d=element('dialog'),form=element('form'); form.elements=Object.fromEntries(inputs.map(k=>[k,element(k)]));form.reset=()=>inputs.forEach(k=>element(k).value='');
    d.close=()=>{d.open=false;d.listeners.close?.();};
    const document={createElement:()=>d,body:{append(){}},activeElement:null};
    const api={account:{security:async()=>({password_change_available:available}),changePassword:async input=>{calls++;return changePassword?changePassword(input):Promise.reject(Object.assign(new Error('Secure server unavailable.'),{code:'NOT_AVAILABLE'}));}}};
    const context=vm.createContext({document,window:{addEventListener(){},removeEventListener(){}}});
    const mod=new vm.SourceTextModule(source,{context});
    await mod.link(async spec=>{const values=spec.endsWith('/api.js')?{Api:api}:spec.endsWith('/ui.js')?{UI:{...UI,openDialog:el=>{el.open=true;},toast:m=>toasts.push(m)}}:await import(new URL('../assets/js/core/'+spec.split('/').at(-1),import.meta.url));return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});
    await mod.evaluate();mod.namespace.openChangePassword();await settle();
    return {d,form,element,inputs,calls:()=>calls,toasts,fill(key,value){element(key).value=value;form.listeners.input?.({target:{name:key}});},async event(selector,type,extra={}){await element(selector).listeners[type]?.({preventDefault(){},target:element(selector),...extra});await settle();}};
  }
  async function official(who='ana.reyes') {
    const store=createStore({storage:memoryStorage(),eventTarget:new EventTarget()}),auth=createAuth({store,session:memoryStorage(),wait:async()=>{}});await auth.login(who+'@example.com','demo1234');
    const api=createApi({store,auth,wait:async()=>{}}),els=new Map(),state={saved:[],getCalls:0,renders:0,releases:{}};
    const el=key=>{if(!els.has(key))els.set(key,{value:'',disabled:false,readOnly:true,hidden:false,listeners:{},classList:{add(){}},setAttribute(){},removeAttribute(){},focus(){},addEventListener(type,fn){this.listeners[type]=fn;},querySelector:el,querySelectorAll:()=>[]});return els.get(key);};
    const main=el('main'),form=el('form');form.elements={full_name:el('full_name'),contact_number:el('contact_number')};
    main.querySelector=el;form.querySelectorAll=sel=>sel==='[data-editable]'?[el('full_name'),el('contact_number')]:[];
    Object.defineProperty(main,'innerHTML',{get:()=>state.html||'',set:value=>{state.renders++;state.html=value;for(const name of ['full_name','contact_number']){const match=value.match(new RegExp('name="'+name+'"[^>]*value="([^"]*)"'));if(match)el(name).value=match[1];el(name).readOnly=true;}el('[data-save]').disabled=true;}});
    const realGet=api.users.get;const users={...api.users,get:async id=>{const call=++state.getCalls;const result=await realGet(id);if(state.deferAt===call||state.deferCalls?.includes(call))await new Promise(resolve=>{state.release=resolve;state.releases[call]=resolve;});return result;}};
    const shared={Auth:auth,Api:{...api,users},UI:{...UI,toast(){},confirm:async()=>true},Fmt};
    const context=vm.createContext({document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},removeEventListener(){}},location:{assign(){}}});
    const mod=new vm.SourceTextModule(await readFile(new URL('../assets/js/pages/official-profile.js',import.meta.url),'utf8'),{context});
    await mod.link(async spec=>{
      if(spec.endsWith('sign-out.js')){
        const helper=new vm.SourceTextModule(await readFile(new URL('../assets/js/core/sign-out.js',import.meta.url),'utf8'),{context});
        await helper.link(name=>{const values=name.endsWith('auth.js')?{Auth:auth}:{UI:shared.UI};return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});
        return helper;
      }
      const values=spec.endsWith('official-shared.js')?shared:spec.endsWith('shell-official.js')?{Shell:{official:()=>main}}:spec.endsWith('change-password.js')?{openChangePassword(){}}:{officialProfileContent};return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});
    });
    await mod.evaluate();await settle();return {main,form,el,state,store,auth,api,async click(key){await el(key).listeners.click?.();await settle();},input(name,value){el(name).value=value;form.listeners.input({target:el(name)});}};
  }
  await check('Actual official controller loads for all roles using only supported store subscriptions',async()=>{
    for(const who of ['ana.reyes','roberto.aquino','carlo.mendoza','ramon.bautista']){const f=await official(who);assert.match(f.main.innerHTML,/official-profile-form/);assert.match(f.main.innerHTML,new RegExp(f.auth.current().full_name));}
  });
  await check('Actual official edit/save locks protected inputs and saves only owner name/contact',async()=>{
    const f=await official();assert.equal(f.el('full_name').readOnly,true);await f.click('[data-edit]');assert.equal(f.el('full_name').readOnly,false);f.input('full_name','Edited Official');await f.form.listeners.submit({preventDefault(){}});await settle();assert.equal((await f.api.users.get(f.auth.current().id)).full_name,'Edited Official');assert.equal(f.el('full_name').readOnly,true);
  });
  await check('Background refresh rechecks dirty state after loading and preserves edits begun during the request',async()=>{
    const f=await official();f.state.deferAt=3;
    await f.store.transact(['users'],db=>{db.users.find(u=>u.id===1).full_name='Remote Name';});await settle();assert.equal(typeof f.state.release,'function');
    await f.click('[data-edit]');f.input('full_name','Unsaved Local Name');f.state.release();await settle();assert.equal(f.el('full_name').value,'Unsaved Local Name');assert.equal(f.el('[data-updated]').hidden,false);
  });
  await check('A refresh begun before Save cannot invalidate the successful save reload',async()=>{
    const f=await official();f.state.deferCalls=[2,3];await f.store.transact(['users'],db=>{db.users.find(u=>u.id===1).full_name='Remote Name';});await settle();
    await f.click('[data-edit]');f.input('full_name','Saved Local Name');const saving=f.form.listeners.submit({preventDefault(){}});await settle();assert.equal(typeof f.state.releases[3],'function');
    f.state.releases[2]();await settle();assert.equal(f.state.getCalls,3);f.state.releases[3]();await saving;await settle();assert.match(f.main.innerHTML,/Saved Local Name/);assert.equal(f.el('full_name').readOnly,true);
  });
  await check('Official profile content uses actual role/account/barangay data and truthful missing login/location fields',()=>{
    for(const role of ['captain','secretary','responder','rescuer']) {
      const html=officialProfileContent({id:1,full_name:'Actual Official',email:'official@example.com',contact_number:'', ['is_'+role]:true},{name:'Assigned Barangay'});
      assert.match(html,/Actual Official/);assert.match(html,/Assigned Barangay/);assert.match(html,/Not recorded/);assert.doesNotMatch(html,/Maria Dela Cruz|Sampaguita City|This device|Jan 26/);
      assert.match(html,/name="full_name"[^>]*readonly/);assert.match(html,/name="contact_number"[^>]*readonly/);assert.match(html,/data-change-password/);
    }
    const inactive=officialProfileContent({full_name:'<unsafe>',personnel_status:'Inactive',is_secretary:true},{});
    assert.match(inactive,/Inactive/);assert.doesNotMatch(inactive,/<unsafe>/);
  });
  await check('Password modal starts with explicit demo limitation, three hidden inputs and Cancel/Close controls',async()=>{
    const f=await modal();assert.match(f.d.innerHTML,/Current password/);assert.match(f.d.innerHTML,/Confirm new password/);assert.match(f.element('[data-availability]').textContent,/unavailable/i);assert.equal(f.calls(),0);
  });
  await check('Password validation blocks empty, weak, matching-current and mismatched confirmation inputs',async()=>{
    const f=await modal();await f.event('form','submit');assert.equal(f.calls(),0);assert.match(f.element('[data-error="current_password"]').textContent,/required/);
    f.fill('current_password','Old12345');f.fill('password','short');f.fill('password_confirmation','short');await f.event('form','submit');assert.equal(f.calls(),0);assert.match(f.element('[data-error="password"]').textContent,/8 characters/);
    f.fill('password','Old12345');f.fill('password_confirmation','Old12345');await f.event('form','submit');assert.match(f.element('[data-error="password"]').textContent,/different/);
    f.fill('password','Fictional123');await f.event('form','submit');assert.match(f.element('[data-error="password_confirmation"]').textContent,/match/);
  });
  await check('Unavailable demo update reports an error without success, and Cancel clears every sensitive field',async()=>{
    const f=await modal();f.fill('current_password','demo1234');f.fill('password','Fictional123');f.fill('password_confirmation','Fictional123');await f.event('form','submit');assert.equal(f.calls(),1);assert.equal(f.toasts.length,0);assert.match(f.element('[data-submit-error]').textContent,/unavailable/);
    await f.event('[data-cancel]','click');for(const key of f.inputs)assert.equal(f.element(key).value,'');assert.equal(f.d.isConnected,false);
  });
  await check('A confirmed secure transport update closes/clears the modal and only then shows success',async()=>{
    const f=await modal({available:true,changePassword:async()=>({password_changed:true})});f.fill('current_password','demo1234');f.fill('password','Fictional123');f.fill('password_confirmation','Fictional123');await f.event('form','submit');assert.equal(f.calls(),1);assert.equal(f.toasts.length,1);for(const key of f.inputs)assert.equal(f.element(key).value,'');
  });
  await check('Pending updates cannot be double submitted and failures keep the dialog usable',async()=>{
    let release;const f=await modal({available:true,changePassword:()=>new Promise((resolve,reject)=>{release=reject;})});f.fill('current_password','demo1234');f.fill('password','Fictional123');f.fill('password_confirmation','Fictional123');
    const first=f.event('form','submit');await settle();await f.event('form','submit');assert.equal(f.calls(),1);release(new Error('Please try again.'));await first;assert.equal(f.d.open,true);assert.match(f.element('[data-submit-error]').textContent,/try again/);
  });
  await check('Each visibility toggle is independent, live requirements update, and Close clears visible passwords',async()=>{
    const f=await modal();f.fill('password','Fictional123');for(let n=0;n<4;n++)assert.equal(f.element(`[data-requirement="${n}"]`).classList.satisfied,true);
    await f.event('toggle-password','click');assert.equal(f.element('password').type,'text');assert.equal(f.element('current_password').type,'password');assert.equal(f.element('toggle-password')['aria-pressed'],'true');
    await f.event('toggle-password','click');assert.equal(f.element('password').type,'password');
    f.fill('current_password','fictional-current');await f.event('[data-close]','click');for(const key of f.inputs)assert.equal(f.element(key).value,'');
  });
  await check('Resident button is icon-free and placed directly after both existing Save changes locations',async()=>{
    const src=await readFile(new URL('../assets/js/pages/resident-profile.js',import.meta.url),'utf8');
    assert.match(src,/Save changes<\/button><button[^>]+data-change-password[^>]*>Change password<\/button>/);
    assert.equal((src.match(/data-change-password>Change password/g)||[]).length,2);
    assert.match(src,/openChangePassword/);
  });
  console.log(`${passed} profile/security page tests passed.`);
}
if(typeof vm.SourceTextModule!=='function'){const r=spawnSync(process.execPath,['--experimental-vm-modules','--no-warnings',fileURLToPath(import.meta.url)],{stdio:'inherit'});process.exitCode=r.status??1;}else{try{await run();}catch(e){console.error(e);process.exitCode=1;}}
