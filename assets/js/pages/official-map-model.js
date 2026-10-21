// Pure map projection. Never invent coordinates for unlocated records.
export const locationKey = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const located = row => row.map_x != null && row.map_y != null && [row.map_x, row.map_y].every(n => Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 100);
export function monitoringMarkers(data, filters, role) {
  const alerts = data.alerts.filter(a => (!filters.status || a.status === filters.status) && (!filters.type || a.alert_type === filters.type));
  const facilities = data.facilities.filter(f => filters.facility !== 'none' && (!filters.facility || f.type === filters.facility));
  const households = [...new Map(data.households.filter(located).map(h => [h.id, h])).values()];
  const complaints = role === 'secretary' && filters.complaints ? data.complaints : [];
  const positioned = complaints.map(record => ({ record, household: households.find(h => locationKey(h.address) === locationKey(record.location)) }));
  return {
    alertCount: alerts.length,
    unplacedComplaints: positioned.filter(c => !c.household).length,
    markers: [
      { id: 'hall', kind: 'hall', x: 54.4, y: 22, label: 'Barangay hall' },
      ...alerts.filter(located).map(record => ({ id: `alert-${record.id}`, kind: 'alert', status: record.status, x: record.map_x, y: record.map_y, label: `A-${record.id} · ${record.alert_type} · ${record.status}`, record })),
      ...facilities.filter(located).map(record => ({ id: `facility-${record.id}`, kind: record.type === 'Hospital' ? 'hospital' : 'evacuation', x: record.map_x, y: record.map_y, label: record.name, record })),
      ...(filters.households ? households.map(record => ({ id: `household-${record.id}`, kind: 'household', x: record.map_x, y: record.map_y, label: record.address, record })) : []),
      ...positioned.filter(c => c.household).map(({ record, household }) => ({ id: `complaint-${record.id}`, kind: 'complaint', x: household.map_x, y: household.map_y, label: `Complaint · ${record.category} · ${record.status}`, record })),
    ],
  };
}
