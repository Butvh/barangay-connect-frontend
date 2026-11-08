import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapScopeFor, mapCoordinates, scopedMarkers } from '../assets/js/core/map-scope.js';
import { createSeed } from '../assets/js/data/seed.js';
import { createFacility, updateFacility, facilitySnapshot, facilityActive } from '../assets/js/core/facilities.js';
import { createStore, memoryStorage } from '../assets/js/core/store.js';

test('coverage selects exact declared artwork independently of IDs, names and generic flags', () => {
  assert.equal(mapScopeFor({ id: 99, name: 'Other name', map_scope: 'sampaguita' }, 99).supported, true);
  for (const scope of [null, undefined, true, 'unknown', 'Sampaguita', ' sampaguita ']) {
    assert.equal(mapScopeFor({ id: 1, name: 'Barangay Sampaguita', map_scope: scope, map_available: true }, 1).supported, false);
  }
  assert.equal(mapScopeFor({ id: 99, map_scope: 'sampaguita' }, 1).supported, false);
});
test('percentage edge coordinates survive and invalid or absent pairs never become pins', () => {
  for (const [x,y] of [[0,100],[100,0],[0,0]]) assert.equal(mapCoordinates({x,y}), true);
  for (const x of [null, undefined, '', ' ', false, [], {}, NaN, Infinity, -1, 101]) assert.equal(mapCoordinates({x,y:50}), false);
});
test('foreign and wrong-artwork facility markers stay off the current map without changing referral records', () => {
  const context = mapScopeFor({ id: 99, map_scope: 'sampaguita' }, 99);
  const marker = (id, tenant, scope) => ({ id, kind: 'hospital', x:0, y:100, record: { id, managed_by_barangay_id: tenant, barangay_id:null, map_scope:scope } });
  const rows = [marker('own',99,'sampaguita'),marker('foreign',1,'sampaguita'),marker('wrong-scope',99,'unknown'),marker('missing-scope',99,null)];
  const before = structuredClone(rows);
  assert.deepEqual(scopedMarkers(rows,context).map(row=>row.id),['own']);
  assert.deepEqual(rows,before);
  assert.deepEqual(scopedMarkers(rows,mapScopeFor({id:99,map_scope:null},99)),[]);
});
test('foreign alert/household pins and undeclared backend hall are filtered, explicit demo hall survives', () => {
  const context=mapScopeFor({id:99,map_scope:'sampaguita'},99);
  const rows=[{id:'hall',kind:'hall',x:54,y:22},{id:'own',kind:'alert',x:0,y:100,record:{barangay_id:99}},{id:'foreign',kind:'household',x:10,y:20,record:{barangay_id:1}}];
  assert.deepEqual(scopedMarkers(rows,context).map(row=>row.id),['own']);
  assert.deepEqual(scopedMarkers(rows,context,{demo:true}).map(row=>row.id),['hall','own']);
});
test('explicit demo declaration supports a non-1 tenant and preserves pin/history scope across edits', () => {
  const db=createSeed(), user={...db.users[0],barangay_id:99};
  db.barangays.push({id:99,name:'Fictional declared demo',map_scope:'sampaguita'});
  const row=createFacility(db,user,{name:'Demo hospital',type:'Hospital',address:'Fictional road',map_x:0,map_y:100},'2026-11-08T08:00:00Z');
  assert.equal(row.map_scope,'sampaguita'); assert.equal(row.managed_by_barangay_id,99);
  const updated=updateFacility(db,user,row.id,{name:'Updated demo hospital',expected_revision:0},'2026-11-08T08:01:00Z');
  assert.deepEqual([updated.map_x,updated.map_y,updated.history[0].facility.map_scope],[0,100,'sampaguita']);
  assert.equal(facilitySnapshot(updated).map_scope,'sampaguita');
});
test('demo ID1 without coverage rejects a new pin and preserves an existing historical unknown pin', () => {
  const db=createSeed(), user=db.users[0]; db.barangays[0].map_scope=null;
  assert.throws(()=>createFacility(db,user,{name:'Unknown pin',type:'Hospital',address:'Fictional road',map_x:0,map_y:100},'2026-11-08T08:00:00Z'),{code:'VALIDATION'});
  db.facilities[0].map_scope='legacy-artwork';
  const updated=updateFacility(db,user,1,{name:'Legacy renamed',expected_revision:0},'2026-11-08T08:01:00Z');
  assert.equal(updated.map_scope,'legacy-artwork');
});
test('real source-reference availability preserves inactive status without affecting legacy demo defaults', () => {
  assert.equal(facilityActive({is_active:false}),false);
  assert.equal(facilityActive({is_active:true}),true);
  assert.equal(facilityActive({}),true);
});
test('legacy fictional demo reads explicit artwork metadata without resetting or writing browser data', () => {
  const db=createSeed(), storage=memoryStorage();
  for (const area of db.barangays) delete area.map_scope;
  for (const facility of db.facilities) { delete facility.map_scope; delete facility.managed_by_barangay_id; }
  db.facilities[1].name='Previously renamed fictional shared referral';
  db.emergency_alerts[0].description='Preserve this existing fictional draft';
  const raw=JSON.stringify(db); storage.setItem('legacy-demo',raw);
  const store=createStore({storage,key:'legacy-demo',eventTarget:null});
  const projected=store.read();
  assert.equal(projected.barangays[0].map_scope,'sampaguita');
  assert.equal(projected.barangays[1].map_scope,null);
  assert.equal(projected.facilities[1].managed_by_barangay_id,1);
  assert.equal(projected.facilities[1].map_scope,'sampaguita');
  assert.equal(projected.facilities[1].name,db.facilities[1].name);
  assert.equal(projected.emergency_alerts[0].description,db.emergency_alerts[0].description);
  assert.equal(storage.getItem('legacy-demo'),raw);
  assert.equal(typeof store.subscribe('barangays',()=>{}),'function');
  store.destroy();
});
test('explicit missing or unknown demo coverage is never overridden by an old artwork path', () => {
  for (const scope of [null,'unknown-artwork']) {
    const db=createSeed(),storage=memoryStorage(); db.barangays[0].map_scope=scope;
    storage.setItem('explicit-demo',JSON.stringify(db));
    const store=createStore({storage,key:'explicit-demo',eventTarget:null});
    assert.equal(store.read().barangays[0].map_scope,scope);
    assert.equal(mapScopeFor(store.read().barangays[0],1).supported,false);
    store.destroy();
  }
});
