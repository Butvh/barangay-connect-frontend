export function registerCaptainIntegrationTests({test,equal,ok,rejects,fixture}) {
  test('Each SOS handoff sends the newly assigned operator one assignment notification',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');await f.login(f.authB,'carlo.mendoza');const before=f.storeA.read().notifications.length;
    await f.apiA.alerts.acknowledge(1042);equal(f.storeA.read().notifications.slice(before).filter(n=>n.user_id===2).length,1);
    const next=f.storeA.read().notifications.length;await f.apiB.alerts.logResponse(1042,{response_type:'Assessment',response_status:'Completed'});equal(f.storeA.read().notifications.slice(next).filter(n=>n.user_id===3).length,1);
  });
  test('SOS acknowledgement preserves the pending incident when no active local responder exists',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');
    await f.storeA.transact(['users','alerts'],db=>{db.emergency_alerts.find(a=>a.id===1038).status='Resolved';});
    await f.apiA.personnel.remove(2,{effective_date:'2026-10-04',expected_revision:0,notes:'End of assignment'});
    const before=f.storeA.read();await rejects(()=>f.apiA.alerts.acknowledge(1042),'INVALID_STATE');equal(f.storeA.read(),before);
    await f.storeA.transact(['users'],db=>{db.users.push({...db.users.find(u=>u.id===2),id:20,email:'replacement@example.com',is_responder:true,personnel_status:'Active'});});
    const alert=await f.apiA.alerts.acknowledge(1042);equal([alert.status,alert.assigned_responder_id],['Acknowledged',20]);
  });
  test('SOS response preserves the acknowledged incident until an active local rescuer is available',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');await f.login(f.authB,'carlo.mendoza');await f.apiA.alerts.acknowledge(1042);
    await f.storeA.transact(['users'],db=>{db.users.find(u=>u.id===3).personnel_status='Inactive';db.users.push({...db.users.find(u=>u.id===3),id:30,barangay_id:2,personnel_status:'Active'});});
    const input={response_type:'Assessment',response_status:'Completed'},before=f.storeA.read();await rejects(()=>f.apiB.alerts.logResponse(1042,input),'INVALID_STATE');equal(f.storeA.read(),before);
    await f.storeA.transact(['users'],db=>{db.users.find(u=>u.id===3).personnel_status='Active';});
    const alert=await f.apiB.alerts.logResponse(1042,input);equal([alert.status,alert.assigned_rescuer_id],['Responding',3]);
  });
  test('Delayed expiry audit records the effective deadline and separate processing time once',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');
    const row=await f.apiA.announcements.create({title:'Time limited',content:'Advisory',expires_at:'2026-10-05T12:00:00+08:00'});
    const deadline=f.storeA.read().verify_residency.find(v=>v.id===2).deadline_at,processed='2026-11-01T09:00:00+08:00';f.setTime(processed);
    await f.apiA.announcements.expireOverdue();await f.apiA.verification.expireOverdue();
    const events=(await f.apiA.reports.snapshot()).activity_logs.filter(e=>/expired/i.test(e.action));
    const announcement=events.find(e=>e.entity==='announcement'&&e.record_id===row.id),verification=events.find(e=>e.entity==='verification'&&e.record_id===2);
    equal([announcement.at,announcement.recorded_at,announcement.actor_name],['2026-10-05T12:00:00.000+08:00',processed,'System']);equal([verification.at,verification.recorded_at],[deadline,processed]);
    await f.apiA.announcements.expireOverdue();await f.apiA.verification.expireOverdue();equal((await f.apiA.reports.snapshot()).activity_logs.filter(e=>/expired/i.test(e.action)).length,events.length);
  });
  test('Captain signs in with highest role precedence and reads the shared administrative services',async()=>{
    const f=fixture(); await f.login(f.authA,'roberto.aquino'); equal(f.authA.roleOf(f.authA.current()),'captain');
    equal((await f.apiA.alerts.list()).length,3); equal((await f.apiA.alerts.get(1042)).id,1042);
    ok((await f.apiA.verification.list()).length); ok((await f.apiA.feedback.list()).length); ok((await f.apiA.announcements.list()).length); ok((await f.apiA.facilities.list()).length);
    equal((await f.apiA.users.get(5)).verification.review_status,'Pending');
    await f.storeA.transact(['users'],db=>{db.users.find(u=>u.id===7).is_secretary=true;}); equal(f.authA.roleOf(f.authA.current()),'captain');
  });
  test('Captain management follows existing verification, feedback, announcement and SOS transitions',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');await f.login(f.authB,'carlo.mendoza');
    await f.apiA.verification.review(2,{decision:'Approved'}); await f.apiA.feedback.assignTanod(1,6); await f.apiA.feedback.resolve(1);
    const a=await f.apiA.announcements.create({title:'Captain update',content:'Community briefing.'}); await f.apiA.announcements.update(a.id,{title:'Updated briefing',expected_revision:a.revision}); await f.apiA.announcements.archive(a.id);
    await f.apiA.alerts.acknowledge(1042);await rejects(()=>f.apiA.alerts.logResponse(1042,{response_type:'Assessment',response_status:'Completed'}),'FORBIDDEN');
    await f.apiB.alerts.logResponse(1042,{response_type:'Assessment',response_status:'Responding',notes:'Assessed'});await f.login(f.authB,'ramon.bautista');await f.apiB.alerts.logRescue(1042,{facility_id:1,rescue_status:'Completed',notes:'Transported'});equal((await f.apiA.alerts.resolve(1042)).status,'Resolved');
    const data=await f.apiA.reports.snapshot();ok(data.activity_logs.some(x=>x.entity==='feedback'&&/resolved/i.test(x.action)));ok(data.activity_logs.some(x=>x.actor_id===7&&x.entity==='alert'));ok(data.activity_logs.every(x=>x.barangay_id===1));
  });
  test('Personnel and Reports are Captain-only including direct API calls',async()=>{
    const f=fixture();for(const name of ['ana.reyes','carlo.mendoza','ramon.bautista','maria.santos']){await f.login(f.authA,name);await rejects(()=>f.apiA.personnel.list(),'FORBIDDEN');await rejects(()=>f.apiA.personnel.get(6),'FORBIDDEN');await rejects(()=>f.apiA.personnel.addExternal({}),'FORBIDDEN');await rejects(()=>f.apiA.personnel.appoint(6,{}),'FORBIDDEN');await rejects(()=>f.apiA.personnel.reassign(1,{}),'FORBIDDEN');await rejects(()=>f.apiA.personnel.remove(1,{}),'FORBIDDEN');await rejects(()=>f.apiA.reports.snapshot(),'FORBIDDEN');}
  });
  test('Captain reads and changes cannot cross barangay boundaries',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');await f.storeA.transact(['users','alerts'],db=>{db.users.push({...db.users[5],id:60,barangay_id:2,email:'foreign.tanod@example.com'});db.emergency_alerts.push({...db.emergency_alerts[0],id:2000,barangay_id:2});});
    await rejects(()=>f.apiA.alerts.get(2000),'FORBIDDEN');await rejects(()=>f.apiA.personnel.get(60),'FORBIDDEN');await rejects(()=>f.apiA.personnel.appoint(60,{role:'secretary',effective_date:'2026-10-04',expected_revision:0}),'FORBIDDEN');
    const data=await f.apiA.reports.snapshot();ok(!data.alerts.some(x=>x.id===2000));ok(!data.users.some(x=>x.id===60));ok(data.users.every(x=>!('password' in x)));
  });
  test('Captain receives relevant administrative notifications without broadening operational recipients',async()=>{
    const f=fixture();await f.login(f.authA,'maria.santos');await f.login(f.authB,'roberto.aquino');const before=(await f.apiB.notifications.list()).length;
    await f.apiA.feedback.create('suggestion',{category:'Preparedness',description:'Add route signs',location:'Riverside'});const rows=await f.apiB.notifications.list();ok(rows.length>before);ok(rows.some(x=>x.kind==='feedback_update'));
    const own=rows[0];await f.apiB.notifications.markRead(own.id);await f.apiB.notifications.markUnread(own.id);await f.login(f.authA,'carlo.mendoza');ok(!(await f.apiA.notifications.list()).some(x=>x.id===own.id));
  });
  test('Tanod appointment/removal changes auth atomically while retaining pool and history',async()=>{
    const f=fixture();await f.login(f.authA,'roberto.aquino');const before=await f.apiA.personnel.get(6);
    const appointed=await f.apiA.personnel.appoint(6,{role:'secretary',effective_date:'2026-10-04',expected_revision:before.revision,notes:'Office support'});await f.login(f.authB,'luis.garcia');equal(f.authB.roleOf(f.authB.current()),'secretary');
    const removed=await f.apiA.personnel.remove(6,{effective_date:'2026-10-04',expected_revision:appointed.revision,notes:'Return to pool'});equal(removed.role,null);equal(f.authB.current(),null);equal((await f.apiA.personnel.list()).tanods.length,1);ok(removed.history.length>=2);ok(f.storeA.read().users.some(u=>u.id===6&&u.is_tanod));
  });
}
