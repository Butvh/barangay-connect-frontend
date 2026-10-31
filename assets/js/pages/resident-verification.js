import {Auth,Api,UI,Fmt,e,icon,heading,link,live,errorView,householdUser,verificationFor} from './resident-shared.js';
import {Shell} from '../core/shell-resident.js';
import {Store} from './resident-runtime.js';
import {verificationHistory} from './verification-history.js';
Auth.requireRole(['resident']);
const user = Auth.current();
if (user) {
  const main = Shell.resident({active:'Home'});
  main.innerHTML = UI.skeleton(2);
  async function render() {
    try {
      const [resident,v] = await Promise.all([householdUser(),verificationFor(user)]);
      const status = v?.review_status || 'Pending', pending = status === 'Pending', approved = status === 'Approved', correction = status === 'Resubmission requested';
      const title = approved ? 'Your residency is verified' : correction ? 'Please correct your documents' : status === 'Rejected' ? 'Your documents need attention' : status === 'Expired' ? 'Your verification window has expired' : 'Documents under review';
      const message = approved ? 'Your residency is approved. You can now send SOS alerts.' : correction ? 'An official requested corrected documents. Follow the reason below and resubmit your valid ID and proof of residence.' : status === 'Rejected' ? (v?.rejection_reason || 'Please review your documents and submit a clearer copy.') : status === 'Expired' ? 'Submit your documents again to start a new review window.' : 'Officials are reviewing your documents. SOS remains locked until approval.';
      const files = String(v?.file_name || '').split('; ').filter(Boolean);
      main.innerHTML = heading('Residency verification','Barangay Sampaguita · '+resident.full_name)+`<div class="split-layout"><section class="card card-plain verification-status">${UI.badge(status)}<h2>${title}</h2>${pending ? `<div class="verification-days">${e(Fmt.countdown(v?.deadline_at,Store.now()))}</div>` : ''}<p>${e(message)}</p>${correction ? `<div class="banner" style="margin-top:16px"><div><strong>Reason for resubmission</strong><p class="verification-correction">${e(v.resubmission_reason)}</p></div></div>` : ''}${v ? `<p class="caption" style="margin:16px 0">Submitted ${e(Fmt.date(v.submitted_at))}${pending ? ` · Deadline ${e(Fmt.date(v.deadline_at))}` : ''}</p>` : ''}<div class="stack-sm" style="margin:24px 0"><h3>Uploaded documents</h3>${files.length ? files.map(name=>`<div class="file-box">${icon('shield-check',{size:20})}<strong>${e(v.document_type)}</strong><p>${e(name)}</p><small>Submitted ${e(Fmt.date(v.submitted_at))}</small></div>`).join('') : UI.empty({icon:'upload',title:'No documents submitted',text:'Upload a valid ID and proof of residence.'})}</div>${verificationHistory(v || {})}<div class="actions" style="margin-top:24px">${!approved ? link('register.html?resubmit=1',correction ? 'Resubmit documents' : v ? 'Resubmit' : 'Upload documents','btn-primary') : ''}${link('resident-dashboard.html','Back to dashboard')}</div></section><aside class="card card-tint sidebar-note">${icon('shield-check')}<h2>What happens next</h2><p>${correction ? 'Your status remains Resubmission requested until you submit corrected documents. Your existing application and earlier submissions are retained.' : 'The barangay checks your name, address and document clarity. Your review status appears here when an official takes action.'}</p><p class="text-blue">Each document submission starts a 7-day review window.<br>SOS remains locked until your residency is Approved.</p></aside></div>`;
    } catch (err) { errorView(main,err,render); }
  }
  const update = live(['verification','users'],render);
  Api.verification.expireOverdue().then(update).catch(err=>errorView(main,err,render));
  const timer = setInterval(async()=>{try { await Api.verification.expireOverdue(); update(); } catch (err) { errorView(main,err,render); }},60000);
  window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);},{once:true});
}
