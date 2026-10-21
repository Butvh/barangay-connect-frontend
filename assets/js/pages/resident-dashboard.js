import {Auth,Api,UI,Fmt,BCMap,Icons,e,icon,tile,link,live,errorView,dialog,householdUser,verificationFor,baseMarkers,alertLabel} from './resident-shared.js';
import {Shell} from '../core/shell-resident.js';
import {Store} from './resident-runtime.js';
import {latestHomeAnnouncement} from './resident-dashboard-model.js';
Auth.requireRole(['resident']);
const signed=Auth.current();
if(signed){
  const main=Shell.resident({active:'Home'});
  main.classList.add('dashboard'); main.innerHTML=UI.skeleton(3);
  let maps=[], announcementTimer;

  function activeCard(latest){
    const active=latest&&latest.status!=='Resolved';
    const action=latest?link('resident-alert.html?id='+latest.id,active?'View my alert':'View resolved alert','btn-primary home-alert-action'):'';
    const header='<div class="home-alert-header"><h2>My active alert</h2><div class="home-alert-actions"><button type="button" class="btn btn-ghost" id="history">View history '+icon('chevron-right',{size:20})+'</button>'+(active?action:'')+'</div></div>';
    const content=latest?'<div class="home-alert-inner'+(active?'':' is-resolved')+'"><div class="home-alert-title">'+icon(Icons.disaster(latest.alert_type),{size:24})+'<h3>'+e(alertLabel(latest))+'</h3>'+UI.badge(latest.status)+'</div><div class="home-alert-copy"><p>'+e(latest.location_label||'Location not provided')+(latest.victim_count==null?'':' · '+e(latest.victim_count)+' '+(latest.victim_count===1?'victim':'victims'))+'</p><p>'+(active?'SOS sent ':'Resolved ')+e(Fmt.dateTime(active?latest.created_at:latest.resolved_at||latest.created_at))+'.</p></div>'+(!active?action:'')+'</div>':'<div class="home-alert-inner home-alert-empty">'+tile('bell','',32)+'<div><h3>No active SOS</h3><p>Your alert timeline appears here after you send SOS.</p></div></div>';
    return '<section class="card card-plain active-alert-card" data-alert-state="'+e(latest?.status||'empty')+'">'+header+content+'</section>';
  }

  function updateCard(a,barangay){
    return '<article class="home-announcement">'+tile('megaphone','',24)+'<div class="home-announcement-copy"><h3>'+e(a.title)+'</h3><p class="home-announcement-meta">'+e(Fmt.date(a.published_at??a.created_at))+' · '+e(barangay)+'</p><p>'+e(a.content.slice(0,170))+(a.content.length>170?'…':'')+'</p><a class="btn home-read-announcement" href="resident-announcements.html?id='+a.id+'">Read announcement '+icon('chevron-right',{size:20})+'</a></div></article>';
  }

  async function render(){try{
    const [user,alerts,nearby,announcements,facilities,barangays]=await Promise.all([householdUser(),Api.alerts.list({resident_id:signed.id}),Api.alerts.list({nearby:true}),Api.announcements.list(),Api.facilities.list({barangay_id:signed.barangay_id}),Api.barangays.list()]);
    const verification=await verificationFor(user),verified=verification?.review_status==='Approved',active=alerts.find(a=>a.status!=='Resolved'),latest=active||alerts[0],first=user.full_name.trim().split(/\s+/)[0],alert=nearby.find(a=>a.id!==active?.id&&a.status!=='Resolved');
    const barangay=barangays.find(b=>b.id===user.barangay_id)?.name||'Your barangay';
    const announcement=latestHomeAnnouncement(announcements,Date.parse(Store.now()));
    clearTimeout(announcementTimer);
    if(announcement?.expires_at)announcementTimer=setTimeout(()=>update(),Math.min(2147483647,Math.max(0,Date.parse(announcement.expires_at)-Date.parse(Store.now()))));
    maps.forEach(m=>m.destroy()); maps=[];
    main.innerHTML='<header class="page-heading home-introduction"><h1>Good afternoon, '+e(first)+'</h1><p class="home-verification"><span>'+e(barangay)+' · Your residency is '+(verified?'verified':'awaiting verification')+'</span>'+(verified?'<span class="home-verified" aria-label="Residency verified">'+icon('check',{size:16})+'</span>':'')+'</p></header>'+
      (!verified?'<div class="banner home-verification-banner">'+icon('shield-check')+'<div class="grow"><strong>Verify your residency to unlock SOS</strong><p>Your documents are reviewed by the barangay office.</p></div>'+link('resident-verification.html','View verification','btn-small')+'</div>':'')+
      '<div class="emergency-grid"><section class="card sos-hero"><div class="home-sos-copy"><h2>Need emergency help?</h2><p class="home-sos-lead">Send SOS first. Add details when you can.</p><p>Your household location goes directly to barangay officials.</p><div class="row address-row">'+icon('map-pin',{size:20})+'<span>'+e(user.household?.address||'Household address not provided')+'</span></div></div><a class="sos-button '+(!verified?'locked':'')+'" href="'+(!verified?'resident-verification.html':active?'resident-alert.html?id='+active.id:'resident-report.html')+'" aria-label="'+(!verified?'Verify residency to unlock SOS':active?'View your active SOS':'Send SOS')+'">'+icon(verified?'triangle-alert':'lock',{size:26})+'<span>SOS</span></a></section>'+activeCard(latest)+'</div>'+
      '<div class="quick-grid"><button type="button" class="card card-plain quick-link" id="contacts">'+tile('phone','',32)+'<span class="home-quick-copy"><strong>Emergency contacts</strong><span>View important numbers</span></span>'+icon('chevron-right',{size:24})+'</button><a class="card card-plain quick-link" href="resident-map.html">'+tile('map','',32)+'<span class="home-quick-copy"><strong>Open map</strong><span>See alerts and important locations</span></span>'+icon('chevron-right',{size:24})+'</a><a class="card card-plain quick-link" href="resident-feedback-new.html">'+tile('message-square','',32)+'<span class="home-quick-copy"><strong>Send feedback</strong><span>Share concerns with the barangay</span></span>'+icon('chevron-right',{size:24})+'</a></div>'+
      '<div class="dashboard-lower"><section class="card card-plain home-nearby"><h2>Active alerts near me</h2><div class="home-nearby-grid"><div class="home-nearby-detail">'+(alert?'<div class="home-nearby-title">'+icon('triangle-alert',{size:24})+'<h3>'+e(alertLabel(alert))+'</h3></div>'+UI.badge(alert.status)+'<p>'+e(alert.location_label||'Approximate area')+' · Approximate area<br>Reporter identity is kept private.</p><a class="btn full" href="resident-map.html">View nearby alert</a>':'<div class="home-nearby-title">'+icon('shield-check',{size:24})+'<h3>No active alerts nearby</h3></div><p>Nearby incident updates will appear here. Reporter identity is kept private.</p>'+link('resident-map.html','Open map','full'))+'</div><div class="home-map"><div id="dashboard-map"></div></div></div><p class="home-nearby-note">Nearby alerts show the type, status and approximate area. Reporter names stay private.</p></section><section class="card card-plain updates-card"><div class="spread home-updates-heading"><h2>Barangay updates</h2><a href="resident-announcements.html">View all</a></div><div class="home-announcements">'+(announcement?updateCard(announcement,barangay):UI.empty({icon:'megaphone',title:'No announcements available at the moment.'}))+'</div></section></div>';
    const markers=baseMarkers(user,facilities);
    if(alert)markers.push({id:'alert-'+alert.id,kind:'alert',status:alert.status,x:alert.map_x,y:alert.map_y,label:alertLabel(alert)});
    maps.push(BCMap.mount(main.querySelector('#dashboard-map'),{barangay_id:user.barangay_id,markers,controls:false,interactive:false,onSelect:()=>location.href='resident-map.html'}));
    main.querySelector('#history').addEventListener('click',()=>dialog('My SOS history','<div class="stack-sm">'+(alerts.length?alerts.map(a=>'<a class="card spread" href="resident-alert.html?id='+a.id+'"><span><strong>'+e(alertLabel(a))+'</strong><p>'+e(Fmt.short(a.created_at))+'</p></span>'+UI.badge(a.status)+'</a>').join(''):UI.empty({icon:'clock',title:'No SOS history',text:'Your previous SOS alerts will appear here.'}))+'</div>'));
    main.querySelector('#contacts').addEventListener('click',()=>dialog('Emergency contacts','<div class="stack"><p>Contact the barangay office or a nearby facility for assistance.</p>'+facilities.map(f=>'<div class="card stack-sm"><h3>'+e(f.name)+'</h3><p>'+e(f.address)+'</p>'+(f.contact?'<a href="tel:'+e(f.contact.replace(/[^+0-9]/g,''))+'">'+e(f.contact)+'</a>':'<p class="muted">Contact number not provided</p>')+'</div>').join('')+link('resident-map.html','View facilities on map')+'</div>'));
  }catch(err){errorView(main,err,render);}}
  const update=live(['alerts','verification','announcements','users'],render);update();
  const onVisible=()=>{if(document.visibilityState==='visible')update();};
  const onPageShow=event=>{if(event.persisted)update();};
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('pageshow',onPageShow);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;clearTimeout(announcementTimer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('pageshow',onPageShow);maps.forEach(m=>m.destroy());},{once:true});
}
