import { facilityActive, facilityLocated } from '../core/facilities.js';
import {Auth,Api} from './resident-runtime.js';
import {UI} from '../core/ui.js';
import {Icons} from '../core/icons.js';
import {Fmt} from '../core/format.js';
import {BCMap} from '../core/map.js';
export {Auth,Api,UI,Icons,Fmt,BCMap};
export const e=UI.escape,icon=Icons.svg;
export const link=(href,label,kind='')=>'<a class="btn '+kind+'" href="'+e(href)+'">'+e(label)+'</a>';
export const heading=(title,subtitle,eyebrow='')=>'<header class="page-heading">'+(eyebrow?'<span class="eyebrow">'+e(eyebrow)+'</span>':'')+'<h1>'+e(title)+'</h1><p>'+e(subtitle)+'</p></header>';
export const field=(name,label,value='',{type='text',required=false,placeholder='',readonly=false,autocomplete=''}={})=>'<div class="field"><label for="'+e(name)+'">'+e(label)+'</label><input class="input" id="'+e(name)+'" name="'+e(name)+'" type="'+type+'" value="'+e(value)+'"'+(required?' required':'')+(readonly?' readonly':'')+' placeholder="'+e(placeholder)+'" autocomplete="'+e(autocomplete||'off')+'"></div>';
export const textarea=(name,label,value='',required=false)=>'<div class="field"><label for="'+e(name)+'">'+e(label)+'</label><textarea class="textarea" id="'+e(name)+'" name="'+e(name)+'" '+(required?'required':'')+' maxlength="2000">'+e(value)+'</textarea></div>';
export const tile=(name,tone='',size=28)=>'<span class="icon-tile '+tone+'">'+icon(name,{size})+'</span>';
export const stars=n=>'<span class="stars" aria-label="'+Number(n)+' of 5 stars">'+Array.from({length:5},(_,i)=>'<span class="'+(i<n?'':'unfilled')+'">'+icon('star',{size:20})+'</span>').join('')+'</span>';
export function errorView(main,error,retry){main.innerHTML=UI.empty({icon:'triangle-alert',title:'Unable to load this page',text:error.message||'Please try again.'})+'<div class="actions">'+link('resident-dashboard.html','Back to dashboard')+'<button class="btn btn-primary" id="retry">Try again</button></div>';main.querySelector('#retry').addEventListener('click',retry);}
export function live(entities,render){let running=false,queued=false;const update=async()=>{if(running){queued=true;return;}running=true;try{await render();}catch(err){UI.toast(err.message,'error');}finally{running=false;if(queued){queued=false;update();}}};const offs=entities.map(entity=>Api.subscribe(entity,update));window.addEventListener('pagehide',event=>{if(event.persisted)return;offs.forEach(off=>off());},{once:true});return update;}
export async function busy(button,task,label='Saving…'){if(button.disabled)return;const old=button.innerHTML;button.disabled=true;button.textContent=label;try{return await task();}catch(err){UI.toast(err.message||'Something went wrong. Please try again.','error');throw err;}finally{button.disabled=false;button.innerHTML=old;}}
export function dialog(title,body,{wide=false,sheet=false}={}){const d=document.createElement('dialog');d.className=(wide?'dialog-wide ':'')+(sheet?'sheet':'');d.setAttribute('aria-label',title);d.innerHTML='<div class="dialog-head"><h2>'+e(title)+'</h2><button class="icon-btn" data-close aria-label="Close">'+icon('x')+'</button></div>'+body;d.querySelector('[data-close]').addEventListener('click',()=>d.close());d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);UI.openDialog(d);return d;}
export async function householdUser(){return Api.users.get(Auth.current().id);}
export async function verificationFor(user){const resident=await Api.users.get(user.id);return resident.verification||null;}
export function baseMarkers(user,facilities=[]){const hh=user.household;return [...(hh?[{id:'home',kind:'own_household',x:hh.map_x,y:hh.map_y,label:'My household'}]:[]),{id:'hall',kind:'hall',x:55,y:22,label:'Barangay hall'},...facilities.filter(facilityActive).filter(facilityLocated).map(f=>({id:'facility-'+f.id,kind:f.type==='Hospital'?'hospital':'evacuation',x:f.map_x,y:f.map_y,label:f.name,record:f}))];}
export function alertLabel(a){return Fmt.alertId(a.id)+' · '+(a.incident_name||a.alert_type);}
export function safety(a){return a.alert_type==='Flood'?'Avoid floodwater, move to a safe higher area if possible, and keep your phone available for updates.':a.alert_type==='Fire'?'Move away from smoke and fire. Keep access clear for emergency responders.':'Stay in a safe area, follow barangay instructions, and keep your phone available for updates.';}
export function safeDestination(n){const route=String(n.link||'');if(/^resident-(alert|verification|announcements|feedback|my-feedback)\.html(?:\?id=\d+)?$/.test(route))return route.replace('resident-my-feedback.html','resident-feedback.html');const id=encodeURIComponent(n.entity_id??n.alert_id??'');switch(n.kind){case 'alert_status':case 'alert_new':return 'resident-alert.html?id='+id;case 'verification':return 'resident-verification.html';case 'announcement':return 'resident-announcements.html?id='+id;case 'feedback_update':return 'resident-feedback.html';default:return 'resident-dashboard.html';}}

