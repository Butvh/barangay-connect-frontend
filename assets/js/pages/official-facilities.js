import { Auth, Api, UI, Icons, e, facilityType, facilityDetail, facts, dialog, errorView, live } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { facilityActive, facilityLocated } from '../core/facilities.js';
import { facilityForm, confirmFacilityStatus } from './facility-form.js';

const statusBadge=f=>`<span class="facility-badge ${facilityActive(f)?'active':'inactive'}"><i aria-hidden="true"></i>${facilityActive(f)?'Active':'Inactive'}</span>`;
let user;
try { Auth.requireRole(['captain','secretary','responder','rescuer']); user=Auth.current(); }
catch(error){if(!['AUTH','FORBIDDEN'].includes(error.code))document.querySelector('#app').innerHTML=UI.empty({title:'Unable to open facilities',text:error.message});}
if(user){
  const main=Shell.official({active:'Facilities'}), params=new URLSearchParams(location.search), types=['','EvacuationCenter','Hospital'];
  const manager=['captain','secretary'].includes(Auth.roleOf(user));
  main.classList.add('facilities-page');
  let type=types.includes(params.get('type'))?params.get('type')||'':'',rows=[],requested=Number(params.get('id')),message='',loaded=false,menuCleanup=()=>{};
  const details=new Set();
  function show(f){
    const el=dialog('Facility details','<div class="stack" data-facility-detail></div><button type="button" class="btn btn-primary full" data-done>Done</button>',{sheet:false});
    el.classList.add('facility-detail-dialog');
    const refresh=()=>{const current=rows.find(row=>row.id===f.id),body=el.querySelector('[data-facility-detail]');if(!current){body.textContent='This facility is no longer in your directory.';return;}
      body.innerHTML=`<div class="row"><span class="icon-tile">${Icons.svg(current.type==='Hospital'?'hospital':'school')}</span><h3>${e(current.name)}</h3></div>${statusBadge(current)}${!facilityActive(current)?'<p class="banner">Inactive — unavailable for new rescue assignments. Historical records are retained.</p>':''}${facts([['Type',facilityType(current)],['Address',current.address],...(current.type==='EvacuationCenter'?[['Capacity',`${current.capacity??'Not provided'} people`]]:[]),['Contact',current.contact||'Not provided']])}${current.notes?`<p class="facility-notes-copy">${e(current.notes)}</p>`:''}${facilityLocated(current)?`<a class="btn" href="official-map.html?facility=${current.id}">View on map</a>`:'<p class="caption">No map pin selected.</p>'}`;
    };
    details.add(refresh);el.addEventListener('close',()=>details.delete(refresh),{once:true});el.querySelector('[data-done]').addEventListener('click',()=>UI.closeDialog(el));refresh();
  }
  function openMenu(button,f){
    menuCleanup();const panel=document.createElement('div');panel.className='facility-menu';panel.popover='auto';panel.setAttribute('role','menu');panel.setAttribute('aria-label',`Actions for ${f.name}`);
    panel.innerHTML=`<button type="button" role="menuitem" data-edit>${Icons.svg('pencil',{size:20})}Edit</button><button type="button" role="menuitem" data-status class="${facilityActive(f)?'danger':''}">${Icons.svg(facilityActive(f)?'ban':'circle-check',{size:20})}${facilityActive(f)?'Deactivate':'Reactivate'}</button>`;
    document.body.append(panel);button.setAttribute('aria-expanded','true');
    const close=()=>{if(panel.matches(':popover-open'))panel.hidePopover();};
    const dispose=()=>{close();panel.remove();button.setAttribute('aria-expanded','false');window.removeEventListener('resize',close);window.removeEventListener('scroll',scroll,true);};
    const scroll=event=>{if(!panel.contains(event.target))close();};
    menuCleanup=dispose;panel.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
    panel.showPopover();const r=button.getBoundingClientRect(),width=Math.min(184,innerWidth-24),height=108;
    Object.assign(panel.style,{width:width+'px',left:Math.max(12,Math.min(r.right-width,innerWidth-width-12))+'px',top:(r.bottom+height+4>innerHeight?Math.max(12,r.top-height-4):r.bottom+4)+'px'});
    window.addEventListener('resize',close);window.addEventListener('scroll',scroll,true);
    panel.querySelector('[data-edit]').addEventListener('click',()=>{dispose();facilityForm({user,facility:f,onSaved:load});});
    panel.querySelector('[data-status]').addEventListener('click',async()=>{
      dispose();const active=!facilityActive(f);if(!await confirmFacilityStatus(f,active))return;
      try{await Api.facilities.setStatus(f.id,{status:active?'Active':'Inactive',expected_revision:f.revision});message=active?'Facility reactivated. It is available for new assignments.':'Facility deactivated. Its information has been retained.';await load();}
      catch(error){UI.toast(error.message,'error');await load();}
    });
    const items=[...panel.querySelectorAll('button')];panel.addEventListener('keydown',event=>{const index=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});items[0].focus();
  }
  function render(){
    menuCleanup();const filtered=rows.filter(f=>!type||f.type===type),focus=document.activeElement?.dataset;
    main.innerHTML=`<header class="official-heading facility-heading"><div><h1>Facilities</h1><p>Facility directory for response and referral</p></div>${manager?'<button class="icon-btn facility-add" type="button" data-add aria-label="Add facility"><img src="assets/img/source/facility-plus.svg" width="20" height="20" alt=""></button>':''}</header><div class="official-facility-filters facility-filters" aria-label="Facility type">${types.map((value,i)=>`<button type="button" class="chip" data-type="${value}" aria-pressed="${type===value}">${['All','Evacuation centers','Hospitals'][i]}</button>`).join('')}</div><div class="facility-grid">${filtered.length?filtered.map(f=>`<article class="card facility-card${facilityActive(f)?'':' is-inactive'}" data-facility-card="${f.id}"><div class="facility-card-heading"><h2>${e(f.name)}</h2>${statusBadge(f)}${f.can_manage?`<button type="button" class="icon-btn" data-menu="${f.id}" aria-label="Actions for ${e(f.name)}" aria-haspopup="menu" aria-expanded="false"><img src="assets/img/source/facility-menu.svg" width="20" height="20" alt=""></button>`:''}</div><div class="facility-card-copy"><small>${e(facilityType(f))}</small><p>${e(f.address||'Address not provided')}</p><p>${e(facilityDetail(f))}</p></div><button type="button" class="btn full" data-view="${f.id}" aria-label="View ${e(f.name)}">View facility</button></article>`).join(''):UI.empty({icon:'hospital',title:'No facilities found',text:manager?'Choose another facility type or add a facility.':'Choose another facility type.'})}</div>${message?`<p class="facility-success" role="status">${e(message)}</p>`:''}`;
    main.querySelector('[data-add]')?.addEventListener('click',()=>facilityForm({user,onSaved:load}));
    main.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{type=button.dataset.type;const next=new URLSearchParams();if(type)next.set('type',type);history.replaceState(null,'',`official-facilities.html${next.size?`?${next}`:''}`);render();main.querySelector(`[data-type="${type}"]`).focus();}));
    main.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>show(rows.find(f=>f.id===Number(button.dataset.view)))));
    main.querySelectorAll('[data-menu]').forEach(button=>button.addEventListener('click',()=>{if(button.getAttribute('aria-expanded')==='true'){menuCleanup();return;}openMenu(button,rows.find(f=>f.id===Number(button.dataset.menu)));}));
    if(focus?.view)main.querySelector(`[data-view="${focus.view}"]`)?.focus({preventScroll:true});
    details.forEach(refresh=>refresh());
  }
  async function load(){
    if(!loaded){main.setAttribute('aria-busy','true');main.innerHTML=UI.skeleton(2);}
    try{const fresh=await Api.facilities.list();if(loaded&&JSON.stringify(rows)===JSON.stringify(fresh))return;rows=fresh;loaded=true;render();if(requested){const f=rows.find(f=>f.id===requested);requested=0;if(f)show(f);else UI.toast('Facility not found in your barangay directory.','error');}}
    catch(error){if(!loaded)errorView(main,error,load);else UI.toast('Facilities could not refresh. '+error.message,'error');}
    finally{main.removeAttribute('aria-busy');}
  }
  live(['facilities','users'],load)();window.addEventListener('pagehide',event=>{if(!event.persisted)menuCleanup();},{once:true});
}
