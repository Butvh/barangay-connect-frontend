import { Api, UI, Icons, e, dialog } from './official-shared.js';
import { BCMap } from '../core/map.js';
import { facilityLocated, facilityActive } from '../core/facilities.js';

// A draft-only picker: its result is persisted only by the parent form.
export function selectFacilityLocation({user, facilityId, type, point, onConfirm}) {
  let selected = point ? {...point} : null, facilities = [], map, closed = false, version = 0;
  const el = dialog('Select facility location', `<p class="facility-subtitle">Choose the facility's location on the Barangay Sampaguita map.</p><div class="facility-location-body"><p>Click the map to place a pin. Drag the selected pin, or focus it and use the arrow keys to adjust it.</p><div data-location-map></div><p class="facility-location-value" role="status" data-location-value></p><small>Map positions are approximate. The address is entered separately.</small><div class="banner banner-error" data-map-error role="alert" hidden></div></div><div class="facility-footer"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn btn-primary" data-confirm>Confirm location</button></div>`, {sheet:false});
  el.classList.add('facility-location-dialog');
  const canvas = el.querySelector('[data-location-map]'), confirm = el.querySelector('[data-confirm]');
  const markers = () => [{id:'hall',kind:'hall',x:54.4,y:22,label:'Barangay hall'}, ...facilities.filter(f=>f.id!==facilityId&&facilityLocated(f)).map(f=>({id:`facility-${f.id}`,kind:f.type==='Hospital'?'hospital':'evacuation',x:f.map_x,y:f.map_y,label:f.name+(facilityActive(f)?'':' · Inactive'),inactive:!facilityActive(f)})), ...(selected?[{id:'draft-facility',kind:type==='Hospital'?'hospital':'evacuation',x:selected.x,y:selected.y,label:'Selected facility location',selected:true}]:[])];
  const update = () => {
    map?.setMarkers(markers()); if(selected) map?.select('draft-facility');
    el.querySelector('[data-location-value]').textContent = selected ? `Selected position: ${selected.x.toFixed(2)}%, ${selected.y.toFixed(2)}%` : 'No location selected. Click the map, or focus the map and press Enter to place a pin.';
    confirm.disabled = !selected || user.barangay_id !== 1;
  };
  map = BCMap.mount(canvas,{barangay_id:user.barangay_id, markers:markers(), draggableMarkerId:'draft-facility'});
  canvas.addEventListener('bc-map-point', event => { selected={...event.detail}; update(); });
  el.querySelector('[data-cancel]').addEventListener('click',()=>UI.closeDialog(el));
  confirm.addEventListener('click',()=>{ if(!selected||confirm.disabled)return;onConfirm({...selected});UI.closeDialog(el); });
  const refresh=async()=>{const request=++version;try{const rows=await Api.facilities.list();if(closed||request!==version)return;facilities=rows;update();}catch(err){if(closed||request!==version)return;const error=el.querySelector('[data-map-error]');error.textContent='Facility markers could not refresh. '+err.message;error.hidden=false;}};
  const off=Api.subscribe('facilities',refresh);el.addEventListener('close',()=>{closed=true;version++;off();map.destroy();},{once:true});
  update(); if(selected)map.centerOn(selected);refresh();return el;
}
