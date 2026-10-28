import { Api, UI, Icons, e, dialog } from './official-shared.js';
import { facilityActive, facilityLocated } from '../core/facilities.js';
import { selectFacilityLocation } from './facility-location.js';

export async function confirmFacilityStatus(facility, active) {
  return UI.confirm({title:active?'Reactivate facility?':'Deactivate facility?',text:active?'Restore this facility for new rescue assignments and active facility selection?':'Are you sure you want to deactivate this facility? It will no longer be available for new rescue assignments or active facility selection. Existing records and previous assignments will be retained.',confirmLabel:active?'Reactivate facility':'Deactivate facility',danger:!active});
}

export function facilityForm({user, facility=null, onSaved=()=>{}}) {
  const editing=Boolean(facility), initial=facility||{}, title=editing?'Edit facility':'Add facility';
  let point=facilityLocated(initial)?{x:Number(initial.map_x),y:Number(initial.map_y)}:null, dirty=false, busy=false, closing=false;
  const requestClose=async()=>{if(busy||closing)return false;if(!dirty)return true;closing=true;try{return await UI.confirm({title:'Discard facility changes?',text:'Your facility changes have not been saved.',confirmLabel:'Discard changes',danger:true});}finally{closing=false;}};
  const required='<span class="facility-required" aria-hidden="true">*</span>';
  const field=(name,label,{max=300,type='text'}={})=>`<div class="field"><label for="facility-${name}">${label}</label><input class="input" id="facility-${name}" name="${name}" type="${type}" maxlength="${max}" value="${e(initial[name]??'')}" aria-describedby="facility-${name}-error"${['name','address'].includes(name)?' required':''}${name==='capacity'?' min="1" max="999999" step="1"':''}><small class="error-text" id="facility-${name}-error" hidden></small></div>`;
  const el=dialog(title, `<p class="facility-subtitle">${editing?'Update':'Enter'} facility information for Barangay Sampaguita.</p><form class="facility-editor" novalidate><div class="facility-form-body"><div class="banner banner-error" data-form-error role="alert" tabindex="-1" hidden></div>${field('name',`Facility name ${required}`,{max:160})}<div class="field"><label for="facility-type">Facility type ${required}</label><select class="select" id="facility-type" name="type" required aria-describedby="facility-type-error"><option value="">Select facility type</option><option value="EvacuationCenter"${initial.type==='EvacuationCenter'?' selected':''}>Evacuation Center</option><option value="Hospital"${initial.type==='Hospital'?' selected':''}>Hospital</option></select><small class="error-text" id="facility-type-error" hidden></small></div>${field('address',`Address ${required}`)}<div class="facility-pin-row"><button class="btn btn-small" type="button" data-pin>${Icons.svg('map-pin',{size:18})}Pin location on map</button><button class="icon-btn" type="button" data-clear-pin aria-label="Remove map pin" hidden>${Icons.svg('x',{size:18})}</button><small data-pin-label role="status"></small><small class="error-text" id="facility-map_x-error" hidden></small></div><div class="facility-two-columns">${field('capacity',`<span data-capacity-label>Capacity (optional)</span>`,{type:'number'})}${field('contact','Contact number (optional)',{max:50})}</div><fieldset class="facility-status"><legend>Status ${required}</legend><div class="facility-two-columns">${['Active','Inactive'].map(status=>`<label><input type="radio" name="status" value="${status}"${status===(facilityActive(initial)?'Active':'Inactive')?' checked':''}><span><img src="assets/img/source/facility-${status.toLowerCase()}.svg" width="20" height="20" alt="">${status}</span></label>`).join('')}</div><small class="error-text" id="facility-status-error" hidden></small></fieldset><div class="field"><label for="facility-notes">Short notes (optional)</label><div class="facility-notes"><textarea class="textarea" id="facility-notes" name="notes" maxlength="300" placeholder="e.g. Additional information about this facility..." aria-describedby="facility-notes-error">${e(initial.notes||'')}</textarea><small data-notes-count>${(initial.notes||'').length}/300</small></div><small class="error-text" id="facility-notes-error" hidden></small></div></div><div class="facility-footer"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${editing?'Save changes':'Add facility'}</button></div></form>`,{sheet:false,beforeClose:requestClose});
  el.classList.add('facility-form');const form=el.querySelector('form'),error=el.querySelector('[data-form-error]'),save=form.querySelector('[type=submit]');
  const updateType=()=>{const required=form.elements.type.value==='EvacuationCenter';form.elements.capacity.required=required;el.querySelector('[data-capacity-label]').innerHTML=`Capacity ${required?'<span class="facility-required" aria-hidden="true">*</span>':'(optional)'}`;};
  const updatePoint=()=>{el.querySelector('[data-pin-label]').textContent=point?`Location pinned · ${point.x.toFixed(2)}%, ${point.y.toFixed(2)}%`:'No map pin selected (optional)';el.querySelector('[data-clear-pin]').hidden=!point;};
  const clearField=event=>{const name=event.target.name,hint=form.querySelector(`#facility-${name}-error`);if(hint)hint.hidden=true;event.target.removeAttribute('aria-invalid');};
  form.addEventListener('input',event=>{clearField(event);dirty=true;el.querySelector('[data-notes-count]').textContent=`${form.elements.notes.value.length}/300`;});
  form.addEventListener('change',event=>{clearField(event);dirty=true;updateType();});
  el.querySelector('[data-pin]').disabled=user.barangay_id!==1;
  el.querySelector('[data-pin]').addEventListener('click',()=>selectFacilityLocation({user,facilityId:initial.id,type:form.elements.type.value,point,onConfirm:value=>{point=value;dirty=true;updatePoint();}}));
  el.querySelector('[data-clear-pin]').addEventListener('click',()=>{point=null;dirty=true;updatePoint();});
  el.querySelector('[data-cancel]').addEventListener('click',async()=>{if(await requestClose())UI.closeDialog(el);});
  const off=editing?Api.subscribe('facilities',async()=>{try{const current=await Api.facilities.get(initial.id);if(el.open&&!busy&&current.revision!==initial.revision){error.textContent='This facility changed in another view. Your draft is retained. Close and reopen the form to review the latest information.';error.hidden=false;}}catch(err){if(el.open){error.textContent=err.message;error.hidden=false;}}}):()=>{};
  el.addEventListener('close',off,{once:true});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    error.hidden=true;form.querySelectorAll('.error-text').forEach(node=>node.hidden=true);form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
    const data=new FormData(form),payload=Object.fromEntries(['name','type','address','capacity','contact','status','notes'].map(name=>[name,data.get(name)]));
    Object.assign(payload,{map_x:point?.x??null,map_y:point?.y??null});
    const problems={};for(const name of ['name','type','address'])if(!String(payload[name]||'').trim())problems[name]='This field is required.';
    if(payload.type==='EvacuationCenter'&&!payload.capacity)problems.capacity='Enter the evacuation center capacity.';
    else if(payload.capacity&&(!Number.isInteger(Number(payload.capacity))||Number(payload.capacity)<1||Number(payload.capacity)>999999))problems.capacity='Use a whole number from 1 to 999999.';
    function showErrors(fields){for(const [name,message]of Object.entries(fields)){const hint=form.querySelector(`#facility-${name}-error`);if(hint){hint.textContent=message;hint.hidden=false;}form.querySelectorAll(`[name="${name}"]`).forEach(node=>node.setAttribute('aria-invalid','true'));}const first=Object.keys(fields)[0],field=form.elements[first];if(field?.tagName==='SELECT'){el.querySelector(`#${field.id}-trigger`)?.focus();}else field?.focus?.();}
    if(Object.keys(problems).length){showErrors(problems);return;}
    busy=true;save.disabled=true;
    try{
      if(editing&&payload.status!== (facilityActive(initial)?'Active':'Inactive')&&!await confirmFacilityStatus(initial,payload.status==='Active'))return;
      form.setAttribute('aria-busy','true');el.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=true);save.textContent='Saving…';
      const result=editing?await Api.facilities.update(initial.id,{...payload,expected_revision:initial.revision}):await Api.facilities.create(payload);
      dirty=false;UI.closeDialog(el);UI.toast(editing?'Facility updated.':'Facility added.');await onSaved(result);
    }catch(err){error.textContent=err.message;error.hidden=false;showErrors(err.fields||{});error.focus();}
    finally{busy=false;form.removeAttribute('aria-busy');el.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=false);el.querySelector('[data-pin]').disabled=user.barangay_id!==1;save.textContent=editing?'Save changes':'Add facility';}
  });
  updateType();updatePoint();return el;
}
