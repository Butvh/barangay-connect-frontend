export const roleLabel = role => ({ secretary: 'Secretary', responder: 'Responder', rescuer: 'Rescuer' })[role] || 'Unassigned';
export const sourceLabel = row => row.source === 'tanod' ? 'Tanod' : row.legacy ? 'Existing personnel' : 'External';
export function personnelPage(records, { q = '', role = '', status = '', source = '', page = 1, size = 8 } = {}) {
  const query = String(q).trim().toLowerCase();
  const filtered = records.filter(row => (!role || row.role === role) && (!status || row.status === status) && (!source || row.source === source) && (!query || [row.full_name, row.email, row.contact_number].some(value => String(value || '').toLowerCase().includes(query))));
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.max(1, Math.min(pages, Math.trunc(Number(page)) || 1));
  return { rows: filtered.slice((current - 1) * size, current * size), total: filtered.length, page: current, pages, size, q: query, role, status, source };
}
