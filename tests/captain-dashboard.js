import { captainDashboard } from '../assets/js/pages/captain-dashboard-model.js';
export function registerCaptainDashboardTests({test,equal,ok,fixture}) {
  test('Captain dashboard derives actual operational and staffing counts without changing records',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');const data=await f.apiA.reports.snapshot(),before=JSON.stringify(data),m=captainDashboard(data);
    equal(m.metrics.active,2);equal(m.metrics.verifications,1);equal(m.metrics.feedback,2);equal(m.personnelUsed,3);equal(m.personnelLimit,15);equal(m.tanodCount,1);equal(JSON.stringify(data),before);ok(m.priority.id===1042);
  });
  test('Captain dashboard reflects personnel and shared workflow changes across clients',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');const p=await f.apiA.personnel.get(6);await f.apiA.personnel.appoint(6,{role:'secretary',effective_date:'2026-10-04',expected_revision:p.revision});await f.apiA.verification.review(2,{decision:'Approved'});await f.apiA.feedback.resolve(1);
    const m=captainDashboard(await f.apiA.reports.snapshot());equal(m.personnelUsed,4);equal(m.metrics.verifications,0);equal(m.metrics.feedback,1);ok(m.activity.some(a=>a.actor_id===7));
  });
  test('Captain dashboard treats absent maps and empty operational data truthfully',()=>{
    const m=captainDashboard({barangay_id:2,at:'2026-10-04T14:20:00+08:00',alerts:[],personnel:{records:[],tanods:[],capacities:{}}});equal(m.priority,null);equal(m.metrics.active,0);equal(m.personnelUsed,0);equal(m.personnelLimit,15);equal(m.mapAvailable,false);equal(m.activity,[]);
  });
}
