import { UI } from '../core/ui.js';
import { Fmt } from '../core/format.js';
const e = UI.escape;

export function assignmentCards(options, query = '', selected = null, allowOverride = false) {
  const role = options.role === 'rescuer' ? 'rescuer' : 'responder', label = role === 'rescuer' ? 'Rescuer' : 'Responder';
  const q = String(query).trim().toLowerCase(), rows = options.personnel.filter(row => row.full_name.toLowerCase().includes(q));
  if (!rows.length) return `<p class="assignment-empty">${q ? `No ${role}s match your search.` : `No active ${role}s are registered in this barangay.`}</p>`;
  return rows.map(row => {
    const disabled = row.assigned || !row.available && !(allowOverride && row.at_capacity), reason = row.assigned ? 'Already assigned to this incident.' : row.at_capacity ? 'Maximum simultaneous assignments reached.' : '';
    return `<label class="assignment-person${selected === row.id ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}"${reason ? ` title="${e(reason)}"` : ''}><input type="radio" name="personnel_id" id="assign-person-${row.id}" value="${row.id}"${selected === row.id ? ' checked' : ''}${disabled ? ' disabled' : ''}${reason ? ` aria-describedby="assign-person-${row.id}-hint"` : ''}><span class="assignment-avatar">${e(Fmt.initials(row.full_name))}</span><span class="assignment-person-copy"><strong>${e(row.full_name)}</strong><span>${label}</span></span><span class="assignment-person-work"><span class="assignment-availability${row.at_capacity ? ' at-capacity' : ''}"><i aria-hidden="true"></i>${row.at_capacity ? 'At capacity' : row.assigned ? 'Assigned here' : 'Available'}</span><small>${row.workload} of ${options.limit} assignments</small></span>${reason ? `<span class="sr-only" id="assign-person-${row.id}-hint">${e(reason)}</span>` : ''}</label>`;
  }).join('');
}
