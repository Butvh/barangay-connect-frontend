import { Icons } from './icons.js';
import { UI } from './ui.js';
import { clamp, pointFromViewport, centeredTransform } from './map-geometry.js';
const kindIcon={household:'house',own_household:'house',hall:'building-2',evacuation:'school',hospital:'hospital',alert:'triangle-alert',complaint:'message-square'};
export const BCMap={mount(container,{barangay_id=1,markers=[],controls=true,interactive=true,onSelect=()=>{},draggableMarkerId=null}={}){
  if(Number(barangay_id)!==1){container.innerHTML=UI.empty({icon:'map',title:'Map coverage is not available yet',text:'Contact your barangay office for local directions.'});return {setMarkers(){},select(){},centerOn(){},zoomIn(){},zoomOut(){},destroy(){container.replaceChildren();}};}
  let list=[...markers],selected=list.find(m=>m.selected)?.id,scale=1,dx=0,dy=0,pointer=null,moved=false,destroyed=false;
  container.innerHTML='<div class="bc-map-viewport" role="region" aria-label="Illustrated barangay map. Approximate locations." '+(interactive?'tabindex="0"':'')+'><div class="bc-map-stage"><img class="bc-map-image" src="assets/img/maps/sampaguita.png" alt="Barangay Sampaguita street illustration, community park, civic center and river" draggable="false"><div class="bc-map-markers"></div></div></div>'+(controls?'<div class="bc-map-controls"><button type="button" class="btn map-zoom" data-zoom="-1" aria-label="Zoom out">'+Icons.svg('minus')+'</button><button type="button" class="btn map-zoom" data-zoom="1" aria-label="Zoom in">'+Icons.svg('plus')+'</button><p>Barangay overview · Use + to zoom and drag</p><span class="sr-only" role="status" data-zoom-status></span></div>':'');
  const viewport=container.querySelector('.bc-map-viewport'),stage=container.querySelector('.bc-map-stage'),layer=container.querySelector('.bc-map-markers');
  const abort=new AbortController(),options={signal:abort.signal};
  const transform=()=>{const w=viewport.clientWidth,h=viewport.clientHeight;dx=clamp(dx,w*(1-scale),0);dy=clamp(dy,h*(1-scale),0);stage.style.transform='translate('+dx+'px,'+dy+'px) scale('+scale+')';layer.querySelectorAll('.map-marker').forEach(b=>b.style.setProperty('--counter-scale',1/scale));const status=container.querySelector('[data-zoom-status]');if(status)status.textContent='Zoom '+Math.round(scale*100)+' percent';};
  const render=()=>{layer.innerHTML=list.map(m=>{const kind=Object.hasOwn(kindIcon,m.kind)?m.kind:'alert';return '<button type="button" class="map-marker kind-'+kind+(m.status==='Pending'?' marker-pending':'')+(m.inactive?' marker-inactive':'')+(m.id===draggableMarkerId?' marker-draggable':'')+(m.id===selected?' selected':'')+'" data-marker="'+UI.escape(m.id)+'" style="left:'+clamp(m.x,0,100)+'%;top:'+clamp(m.y,0,100)+'%;--counter-scale:'+1/scale+'" aria-label="'+UI.escape(m.label||kind)+(m.id===draggableMarkerId?'. Drag or use arrow keys to move.':'')+'" aria-pressed="'+String(m.id===selected)+'"><span class="marker-dot">'+Icons.svg(kindIcon[kind],{size:18})+'</span><span class="marker-label">'+UI.escape(m.label||'')+'</span></button>';}).join('');};
  const zoom=(amount,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2)=>{const next=clamp(scale+amount,1,3),ratio=next/scale;dx=cx-(cx-dx)*ratio;dy=cy-(cy-dy)*ratio;scale=next;transform();};
  const point=e=>pointFromViewport(e,viewport.getBoundingClientRect(),{scale,dx,dy});
  const emit=position=>{if(position)container.dispatchEvent(new CustomEvent('bc-map-point',{detail:position}));};
  const focusMarker=id=>layer.querySelectorAll('button').forEach(el=>{if(el.dataset.marker===String(id))el.focus({preventScroll:true});});
  render();
  layer.addEventListener('click',e=>{const b=e.target.closest('[data-marker]');if(!b||moved)return;const marker=list.find(m=>String(m.id)===b.dataset.marker);if(!marker)return;selected=marker.id;render();focusMarker(selected);onSelect(marker);},options);
  container.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>zoom(Number(b.dataset.zoom)*.25),options));
  if(interactive){
    viewport.addEventListener('pointerdown',e=>{
      moved=false;if(e.button!==0)return;const button=e.target.closest('[data-marker]'),drag=button&&button.dataset.marker===String(draggableMarkerId);
      if(e.target.closest('button')&&!drag)return;
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,dx,dy,drag};viewport.setPointerCapture(e.pointerId);
    },options);
    viewport.addEventListener('pointermove',e=>{
      if(pointer?.id!==e.pointerId)return;const x=e.clientX-pointer.x,y=e.clientY-pointer.y;if(Math.abs(x)+Math.abs(y)>4)moved=true;
      if(pointer.drag){if(moved)emit(point(e));}else{dx=pointer.dx+x;dy=pointer.dy+y;transform();}
    },options);
    viewport.addEventListener('pointerup',e=>{
      if(pointer?.id!==e.pointerId)return;if(pointer.drag&&moved)emit(point(e));else if(!pointer.drag&&!moved)emit(point(e));pointer=null;
    },options);
    viewport.addEventListener('pointercancel',()=>pointer=null,options);
    viewport.addEventListener('wheel',e=>{if(document.activeElement!==viewport&&!viewport.contains(document.activeElement))return;e.preventDefault();const r=viewport.getBoundingClientRect();zoom(e.deltaY<0?.15:-.15,e.clientX-r.left,e.clientY-r.top);},{...options,passive:false});
    viewport.addEventListener('keydown',e=>{
      const steps={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]},button=e.target.closest('[data-marker]');
      if(button?.dataset.marker===String(draggableMarkerId)&&steps[e.key]){e.preventDefault();const marker=list.find(m=>m.id===draggableMarkerId),n=e.shiftKey?5:1;emit({x:clamp(Number(marker.x)-Math.sign(steps[e.key][0])*n,0,100),y:clamp(Number(marker.y)-Math.sign(steps[e.key][1])*n,0,100)});focusMarker(draggableMarkerId);return;}
      if(e.target!==viewport)return;
      if(steps[e.key]){e.preventDefault();dx+=steps[e.key][0];dy+=steps[e.key][1];transform();}
      if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?-.25:.25);}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();const r=viewport.getBoundingClientRect();emit(point({clientX:r.left+r.width/2,clientY:r.top+r.height/2}));}
    },options);
  }
  const resize=new ResizeObserver(transform);resize.observe(viewport);
  return {setMarkers(newList){if(destroyed)return;list=[...newList];render();},select(id){if(selected===id)return;selected=id;render();},centerOn(position,zoom=1.5){if(destroyed)return;({scale,dx,dy}=centeredTransform(position,{width:viewport.clientWidth,height:viewport.clientHeight},zoom));transform();},zoomIn(){zoom(.25);},zoomOut(){zoom(-.25);},destroy(){destroyed=true;abort.abort();resize.disconnect();container.replaceChildren();}};
}};
