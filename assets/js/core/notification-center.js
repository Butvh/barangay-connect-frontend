import { Api } from './api.js';
import { Auth } from './auth.js';
import { UI } from './ui.js';
import { Fmt } from './format.js';
import { Icons } from './icons.js';
import { Store } from './store.js';

const e = UI.escape;
const assets = { waves:'waves', 'shield-check':'shield', 'triangle-alert':'alert', mountain:'mountain', 'cloud-rain':'cloud' };
const asset = name => `<img src="assets/img/source/notification-${name}.svg" width="24" height="24" alt="">`;
const icon = name => assets[name] ? asset(assets[name]) : Icons.svg(name, {size:24});
let sequence = 0;
function stylesheet() {
  if (document.querySelector('[data-notification-styles]')) return;
  const link = document.createElement('link'); link.rel='stylesheet'; link.href='assets/css/notifications.css?v=notifications-1'; link.dataset.notificationStyles=''; document.head.append(link);
}
export function mountNotificationCenter(root, { bell, onOpen = row => { location.href=row.link; }, onClose } = {}) {
  stylesheet(); root.classList.add('notification-center');
  const user=Auth.current(), role=Auth.roleOf(user), id=`notification-center-${++sequence}`;
  let rows=[], filter='all', revision=0, alive=true, busy=false, menu, menuTrigger, confirmation, expiryTimer;
  const valid=()=>Auth.current()?.id===user?.id && Auth.roleOf(Auth.current())===role;
  const heading=root.tagName==='DIALOG'?'h2':'h1';
  root.innerHTML=`<${heading} class="notification-heading" id="${id}-heading">Notifications</${heading}><div class="notification-controls"><div class="notification-tabs" role="tablist" aria-label="Notification filter">${['all','unread','read'].map(t=>`<button type="button" role="tab" id="${id}-${t}" data-filter="${t}" aria-controls="${id}-list" aria-selected="${t==='all'}" tabindex="${t==='all'?0:-1}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div><button type="button" class="btn notification-clear" data-clear-read disabled>${asset('trash-blue')}<span>Clear read</span></button></div><div class="notification-list" id="${id}-list" role="tabpanel" aria-labelledby="${id}-all" tabindex="0"><p role="status">Loading notifications…</p></div><p class="sr-only" role="status" data-notice-status></p>${onClose?'<footer class="notification-footer"><button type="button" class="btn" data-close-center>Close</button></footer>':''}`;
  const list=root.querySelector('.notification-list'), clear=root.querySelector('[data-clear-read]'), tabs=[...root.querySelectorAll('[data-filter]')];
  if(root.tagName==='DIALOG')root.setAttribute('aria-labelledby',`${id}-heading`);
  const focusRecord=(record,action='menu')=>{const target=root.querySelector(`[data-${action}="${Number(record)}"]`);(target||tabs.find(t=>t.dataset.filter===filter)).focus({preventScroll:true});};
  function closeMenu(focus=false) { if(!menu)return; const trigger=menuTrigger;menu.remove();menu=null;menuTrigger=null;trigger?.setAttribute('aria-expanded','false');if(focus)focusRecord(trigger?.dataset.menu); }
  function render() {
    const focused=root.contains(document.activeElement)?document.activeElement.closest('[data-menu],[data-open]'):null;
    const focusId=focused?.dataset.menu||focused?.dataset.open, focusAction=focused?.dataset.menu?'menu':'open';
    closeMenu();
    const visible=rows.filter(row=>filter==='all'||(filter==='read'?row.is_read:!row.is_read));
    tabs.forEach(tab=>{const active=tab.dataset.filter===filter;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
    list.setAttribute('aria-labelledby',`${id}-${filter}`);
    list.innerHTML=visible.length?visible.map(row=>`<article class="notice-card${row.is_read?'':' is-new'}"><button type="button" class="notice-open" data-open="${row.id}" aria-label="Open ${e(row.title)}"><span class="notice-meta">${icon(row.icon)}<span class="notice-state">${row.is_read?'Read':'New'}</span></span><strong>${e(row.title)}</strong><span class="notice-description">${e(row.description)}</span><time datetime="${e(row.created_at)}">${e(Fmt.dateTime(row.created_at))}</time></button><button type="button" class="icon-btn notice-menu-trigger" data-menu="${row.id}" aria-label="Actions for ${e(row.title)}" aria-haspopup="menu" aria-expanded="false">${asset('more')}</button></article>`).join(''):UI.empty({icon:'bell',title:filter==='all'?'You’re all caught up':`No ${filter} notifications`,text:'New updates will appear here.'});
    clear.disabled=busy||!rows.some(row=>row.is_read);
    root.querySelector('[data-notice-status]').textContent=`${visible.length} ${filter==='all'?'':filter+' '}notifications`;
    list.querySelectorAll('[data-menu]').forEach(button=>button.addEventListener('click',()=>openMenu(button,rows.find(row=>row.id===Number(button.dataset.menu)))));
    list.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',async()=>{
      if(busy||!valid())return;busy=true;button.disabled=true;
      try {const recordId=Number(button.dataset.open);await Api.notifications.markRead(recordId);if(!alive||!valid())return;await refresh();if(!alive||!valid())return;const row=await Api.notifications.get(recordId);if(!alive||!valid())return;focusRecord(recordId,'open');await onOpen(row);}
      catch(error){UI.toast(error.message,'error');await refresh();}
      finally{busy=false;if(alive){clear.disabled=!rows.some(row=>row.is_read);if(!document.querySelector('dialog[open]:not(.official-notifications)'))focusRecord(button.dataset.open,'open');}}
    }));
    if(focusId)focusRecord(focusId,focusAction);
  }
  async function refresh() {
    const request=++revision;
    try { if(!valid())throw Error('Your account changed. Reload this page.');const result=await Api.notifications.list();if(!alive||request!==revision)return;if(!valid())throw Error('Your account changed. Reload this page.');rows=result;
      clearTimeout(expiryTimer);const expiries=rows.map(row=>Date.parse(row.source_expires_at)).filter(Number.isFinite);if(expiries.length)expiryTimer=setTimeout(refresh,Math.min(2147483647,Math.max(0,Math.min(...expiries)-Date.parse(Store.now()))));
      if(bell){const count=rows.filter(row=>!row.is_read).length;bell.setAttribute('aria-label',`Notifications, ${count} unread`);bell.querySelector('span').hidden=!count;}render();
    }catch(error){if(!alive||request!==revision)return;rows=[];clearTimeout(expiryTimer);closeMenu();if(!valid()&&confirmation?.open)UI.closeDialog(confirmation);clear.disabled=true;if(bell){bell.setAttribute('aria-label','Notifications');bell.querySelector('span').hidden=true;}list.innerHTML=`<p role="alert">${e(error.message)}</p><button type="button" class="btn" data-retry>Try again</button>`;list.querySelector('button').addEventListener('click',refresh);}
  }
  function openMenu(trigger,row) {
    if(menuTrigger===trigger){closeMenu(true);return;}closeMenu();if(!row)return;
    menuTrigger=trigger;trigger.setAttribute('aria-expanded','true');menu=document.createElement('div');menu.className='notification-action-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',`Actions for ${row.title}`);menu.setAttribute('popover','manual');
    menu.innerHTML=`${row.is_read?`<button type="button" role="menuitem" data-unread>${asset('mail')}<span>Mark as unread</span></button>`:''}<button type="button" role="menuitem" class="notice-danger" data-dismiss>${asset('trash-red')}<span>Dismiss notification</span></button>`;
    root.append(menu);menu.showPopover?.();const rect=trigger.getBoundingClientRect(),width=Math.min(208,innerWidth-16);menu.style.width=`${width}px`;menu.style.left=`${Math.max(8,Math.min(rect.right-width,innerWidth-width-8))}px`;menu.style.top=`${Math.max(8,rect.bottom+menu.offsetHeight+4<=innerHeight-8?rect.bottom+4:rect.top-menu.offsetHeight-4)}px`;
    menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',async()=>{closeMenu(true);if(busy||!valid())return;busy=true;try{await Api.notifications[button.hasAttribute('data-unread')?'markUnread':'dismiss'](row.id);await refresh();focusRecord(row.id);}catch(error){UI.toast(error.message,'error');await refresh();}finally{busy=false;clear.disabled=!rows.some(row=>row.is_read);}}));
    menu.addEventListener('keydown',event=>{const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(event.key==='Tab')closeMenu(true);});menu.querySelector('button').focus();
  }
  clear.addEventListener('click',()=>{
    if(confirmation?.open||busy||!valid())return;
    confirmation=document.createElement('dialog');const d=confirmation;d.className='notification-clear-dialog';d.setAttribute('aria-labelledby',`${id}-clear-title`);d.setAttribute('aria-describedby',`${id}-clear-copy`);
    d.innerHTML=`<button type="button" class="icon-btn notice-confirm-close" aria-label="Close confirmation">${asset('close')}</button><span class="notice-clear-symbol">${asset('trash-red')}</span><h2 id="${id}-clear-title">Clear read notifications?</h2><p id="${id}-clear-copy">Only read notifications will be removed from this list. Unread notifications will remain.</p><p role="alert" data-clear-error hidden></p><div class="notice-confirm-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn btn-danger" data-confirm>${asset('trash-white')}Clear read</button></div>`;
    let saving=false;const cancel=()=>{if(!saving)UI.closeDialog(d);};d.querySelector('[data-cancel]').addEventListener('click',cancel);d.querySelector('.notice-confirm-close').addEventListener('click',cancel);d.addEventListener('cancel',event=>{if(saving)event.preventDefault();});d.addEventListener('click',event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){event.stopImmediatePropagation();cancel();}}});
    d.querySelector('[data-confirm]').addEventListener('click',async()=>{if(saving||!valid())return;saving=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);try{await Api.notifications.clearRead({recipient_id:user.id,expected_role:role});if(!alive)return;await refresh();UI.closeDialog(d);if(valid())UI.toast('Read notifications cleared.');}catch(error){const message=d.querySelector('[data-clear-error]');message.hidden=false;message.textContent=error.message;}finally{saving=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}});
    d.addEventListener('close',()=>{d.remove();confirmation=null;if(alive)(clear.disabled?tabs.find(t=>t.dataset.filter===filter):clear).focus();},{once:true});document.body.append(d);UI.openDialog(d);d.querySelector('[data-cancel]').focus();
  });
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>{filter=tab.dataset.filter;render();});tab.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;tabs[target].click();tabs[target].focus();});});
  root.querySelector('[data-close-center]')?.addEventListener('click',()=>{closeMenu();onClose();});
  const outside=event=>{if(menu&&!menu.contains(event.target)&&!menuTrigger?.contains(event.target))closeMenu();};
  const key=event=>{if(menu&&event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu(true);}};
  const reposition=()=>closeMenu(); const visible=()=>{if(!document.hidden)refresh();};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);document.addEventListener('visibilitychange',visible);root.addEventListener('close',reposition);
  const off=['notifications','alerts','verification','announcements','feedback','users'].map(entity=>Api.subscribe(entity,refresh));
  function destroy(){alive=false;revision++;clearTimeout(expiryTimer);closeMenu();confirmation?.remove();off.forEach(stop=>stop());document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);document.removeEventListener('visibilitychange',visible);}
  window.addEventListener('pagehide',event=>{if(!event.persisted)destroy();},{once:true});refresh();return {refresh,destroy};
}
