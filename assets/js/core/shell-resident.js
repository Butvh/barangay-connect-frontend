import { Auth, Api } from '../pages/resident-runtime.js';
import { UI } from './ui.js';
import { Fmt } from './format.js';
import { Icons } from './icons.js';
const nav=[['Home','resident-dashboard.html','house'],['Map','resident-map.html','map'],['Report','resident-report.html','siren'],['Feedback','resident-feedback-new.html','message-square'],['Profile','resident-profile.html','user']];
export const Shell={resident({active='Home'}={}){
const user=Auth.current(),e=UI.escape;const host=document.getElementById('app')||document.body;
const item=([label,url,icon],mobile=false)=>'<a class="'+(mobile?'bottom-item':'nav-item')+(label===active?' active':'')+'" href="'+url+'"'+(label===active?' aria-current="page"':'')+'>'+(mobile?Icons.svg(icon,{size:24}):'')+'<span>'+(mobile&&label==='Report'?'SOS':label)+'</span></a>';
host.innerHTML='<a class="skip-link" href="#main">Skip to content</a><header class="resident-header"><div class="header-inner"><a class="brand" href="resident-dashboard.html"><img src="assets/img/logo.png" alt="" width="36" height="36"><span class="brand-full">Barangay Connect</span><span class="brand-compact">Sampaguita</span></a><nav class="resident-nav" aria-label="Main navigation">'+nav.map(n=>item(n)).join('')+'</nav><div class="identity"><a class="icon-btn notification-link" href="resident-notifications.html" aria-label="Notifications">'+Icons.svg('bell')+'<span class="unread-dot" hidden></span></a><span class="identity-name"></span><a class="avatar" href="resident-profile.html" aria-label="Your profile"></a></div></div></header><main id="main" class="resident-main" tabindex="-1"></main><nav class="bottom-nav" aria-label="Main navigation">'+nav.map(n=>item(n,true)).join('')+'</nav>';
let barangayName='Your barangay';
const update=()=>{const u=Auth.current()||user;host.querySelector('.identity-name').textContent=(u?.full_name||'Resident')+' · '+barangayName;host.querySelector('.avatar').textContent=Fmt.initials(u?.full_name);host.querySelector('.brand-compact').textContent=barangayName;};
update();Api.barangays.list().then(rows=>{barangayName=(rows.find(b=>b.id===user?.barangay_id)?.name||'Your barangay').replace(/^Barangay /,'');update();}).catch(()=>{});const offUsers=Api.subscribe('users',update);
const unread=async()=>{try{const rows=await Api.notifications.list();const count=rows.filter(n=>!n.read_at&&!n.is_read).length;const el=host.querySelector('.unread-dot');if(el)el.hidden=!count;}catch{}};
unread();const offNotifications=Api.subscribe('notifications',unread);
window.addEventListener('pagehide',event=>{if(event.persisted)return;offUsers();offNotifications();},{once:true});
return host.querySelector('main');
}};

