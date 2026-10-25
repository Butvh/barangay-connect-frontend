import { secretaryDashboard } from './official-dashboard-model.js';
import { captainReportData } from './captain-reports-model.js';
export function captainDashboard(snapshot = {}) {
  const model = secretaryDashboard(snapshot, {barangayId:snapshot.barangay_id,at:snapshot.at});
  const personnel=snapshot.personnel||{}, capacities=Object.fromEntries([['secretary',3],['responder',6],['rescuer',6]].map(([role,limit])=>[role,{used:personnel.capacities?.[role]?.used||0,limit}]));
  return {...model,capacities,personnelUsed:Object.values(capacities).reduce((n,r)=>n+r.used,0),personnelLimit:15,tanodCount:personnel.tanods?.length||0,activity:captainReportData(snapshot).activity};
}
