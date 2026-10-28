import { facilityActive, facilityLocated } from '../core/facilities.js';
import { Auth, Api, UI, Icons, Fmt, e, roleLabel, typeIcon, alertName, victims, facts, facilityType, facilityDetail, dialog, live, destination } from './official-shared.js';
import { Shell } from '../core/shell-official.js';
import { BCMap } from '../core/map.js';
import { ALERT_STATUSES, ALERT_TYPES, canTransition } from '../core/alertMachine.js';
import { resolveAlert } from './official-alert-actions.js';
import { monitoringMarkers } from './official-map-model.js';

let user;
try { Auth.requireRole(['captain', 'secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open map monitoring', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Map monitoring' }), role = Auth.roleOf(user), params = new URLSearchParams(location.search);
  const filters = { status: ALERT_STATUSES.includes(params.get('status')) ? params.get('status') : '', type: ALERT_TYPES.includes(params.get('type')) ? params.get('type') : '', facility: ['Hospital', 'EvacuationCenter', 'none'].includes(params.get('facilities')) ? params.get('facilities') : '', households: params.get('households') !== '0', complaints: ['secretary', 'captain'].includes(role) && params.get('complaints') === '1' };
  let data = { alerts: [], facilities: [], households: [], complaints: [] }, mapView, selected = params.has('facility') ? `facility-${Number(params.get('facility'))}` : params.has('alert') ? `alert-${Number(params.get('alert'))}` : 'alert-1042', projection, loaded = false, busy = false, version = 0;
  main.classList.add('official-map-page');
  const options = (values, current) => values.map(([value, label]) => `<option value="${e(value)}"${current === value ? ' selected' : ''}>${e(label)}</option>`).join('');
  function filterBody(prefix) {
    return `<div class="official-section"><div class="field"><label for="${prefix}-status">Status</label><select class="select" id="${prefix}-status" data-filter="status">${options([['', 'All statuses'], ...ALERT_STATUSES.map(v => [v, v])], filters.status)}</select></div><div class="field"><label for="${prefix}-type">Disaster type</label><select class="select" id="${prefix}-type" data-filter="type">${options([['', 'All disaster types'], ...ALERT_TYPES.map(v => [v, v])], filters.type)}</select></div><div class="field"><label for="${prefix}-facility">Facilities</label><select class="select" id="${prefix}-facility" data-filter="facility">${options([['', 'All facilities'], ['EvacuationCenter', 'Evacuation centers'], ['Hospital', 'Hospitals'], ['none', 'Hide facilities']], filters.facility)}</select></div><small>Marker layers</small><button type="button" class="chip" data-layer="households" aria-pressed="${filters.households}">${Icons.svg('house', { size: 20 })}<span>Households · ${filters.households ? 'Shown' : 'Hidden'}</span></button><small>Households linked to the available alerts and complaints.</small><button type="button" class="chip" data-layer="complaints" aria-pressed="${filters.complaints}"${role !== 'secretary' ? ' disabled title="Only the Secretary can view complaints."' : ''}>${Icons.svg('message-square', { size: 20 })}<span>Complaints · ${filters.complaints ? 'Shown' : 'Hidden'}</span></button>${role !== 'secretary' ? '<small>Complaints are available to the Secretary.</small>' : ''}<button type="button" class="btn btn-ghost" data-reset-filters>Reset filters</button></div>`;
  }
  function legend() {
    return `<div class="official-section"><small>Map markers: Pending red pulse; Acknowledged amber; Responding and Rescue in progress teal; Resolved gray. Each marker also has an icon and a status label.</small><div class="actions">${ALERT_STATUSES.map(s => UI.badge(s)).join('')}</div><div class="official-map-key">${[['hospital', 'Hospital'], ['school', 'Evacuation Center'], ['house', 'Household'], ['building-2', 'Barangay hall'], ['message-square', 'Complaint']].map(([icon, label]) => `<span>${Icons.svg(icon, { size: 20 })}${label}</span>`).join('')}</div><small>Illustrated map · Approximate locations · No routing</small></div>`;
  }
  main.innerHTML = `<header class="official-heading"><h1>Map monitoring</h1></header><div class="official-map-tools"><button type="button" class="btn" data-open-filters>${Icons.svg('map', { size: 20 })}Filters</button><button type="button" class="btn" data-open-facilities>Facilities</button><button type="button" class="btn" data-open-legend>Legend</button></div><div class="banner banner-error" role="alert" data-map-error hidden><span class="grow"></span><button type="button" class="btn" data-retry>Try again</button></div><div class="official-monitor-layout"><aside class="card official-section official-map-filters"><h2>Filters</h2>${filterBody('map')}</aside><div class="official-map-center"><div class="official-map-canvas" id="monitor-map" aria-busy="true"><p class="startup-status" role="status">Loading map…</p>${UI.skeleton(3)}</div><p class="caption" role="status" data-map-count></p><div class="banner" data-map-empty hidden><span class="grow">No alerts match these filters. Adjust the status or disaster type.</span></div><small data-unplaced hidden></small><div class="card official-map-desktop-legend">${legend()}</div><div class="actions official-map-secondary-tools"><button type="button" class="btn" data-open-facilities>Facilities</button><button type="button" class="btn" data-open-legend>Legend</button></div></div><aside class="card official-section official-map-summary" aria-label="Map selection" tabindex="-1"><h2>Alert summary</h2><p>Loading selected alert…</p></aside></div>`;
  const canvas = main.querySelector('#monitor-map'), summary = main.querySelector('.official-map-summary'), error = main.querySelector('[data-map-error]');
  main.querySelectorAll('[data-open-facilities]').forEach(button => { button.disabled = true; button.title = 'Facilities are loading.'; });
  const markerList = document.createElement('details'); markerList.className = 'official-map-marker-list'; markerList.innerHTML = '<summary>Map records</summary><div></div>'; main.querySelector('.official-map-center').append(markerList);
  markerList.addEventListener('click', event => { const button = event.target.closest('[data-select-marker]'); if (!button) return; const marker = projection.markers.find(m => m.id === button.dataset.selectMarker); if (['hospital', 'evacuation'].includes(marker.kind)) location.assign(`official-facilities.html?id=${marker.record.id}`); else select(marker, true); });
  function saveFilters() {
    const next = new URLSearchParams(); if (filters.status) next.set('status', filters.status); if (filters.type) next.set('type', filters.type); if (filters.facility) next.set('facilities', filters.facility); if (!filters.households) next.set('households', '0'); if (filters.complaints) next.set('complaints', '1'); if (selected?.startsWith('alert-')) next.set('alert', selected.slice(6)); if (selected?.startsWith('facility-')) next.set('facility', selected.slice(9));
    history.replaceState(null, '', `official-map.html${next.size ? `?${next}` : ''}`);
  }
  function decorateMarkers() {
    canvas.querySelectorAll('[data-marker]').forEach(button => {
      const marker = projection.markers.find(m => String(m.id) === button.dataset.marker); if (!marker) return;
      button.dataset.labelSide = Number(marker.x) < 50 ? 'right' : 'left';
      if (marker.kind === 'alert') { button.dataset.status = marker.status; button.querySelector('.marker-dot').innerHTML = Icons.svg(typeIcon(marker.record.alert_type), { size: 20 }); }
    });
  }
  function summaryBody(marker) {
    if (!marker) return UI.empty({ icon: 'map', title: 'Choose a marker', text: 'Select an alert, household or landmark to see details.' });
    if (marker.kind === 'alert') {
      const a = marker.record, acknowledge = canTransition(a, 'acknowledge', user), resolve = canTransition(a, 'resolve', user);
      return `<h2>${e(alertName(a))}</h2>${UI.badge(a.status)}<p>${e(a.location_label)}</p><small>${e(a.resident?.full_name || 'Reporter not provided')} · ${e(victims(a.victim_count))}<br>${e(Fmt.dateTime(a.created_at))}</small><a class="btn" href="official-alert.html?id=${a.id}">View alert</a><div class="official-map-person"><small>${e(roleLabel(role))} ${e(user.full_name)}</small><button type="button" class="btn btn-primary" data-acknowledge${!acknowledge || busy ? ' disabled' : ''} title="${acknowledge ? 'Acknowledge this alert' : 'Only the Secretary can acknowledge a Pending alert.'}">Acknowledge</button><button type="button" class="btn" disabled title="Staff assignments are automatic in this prototype.">Assign</button><button type="button" class="btn${resolve ? ' btn-danger' : ''}" data-resolve${!resolve || busy ? ' disabled' : ''} title="${resolve ? 'Resolve this alert' : 'Only the Secretary can resolve an alert during Rescue in progress.'}">Resolve</button></div>${a.status === 'Resolved' ? '<small>This alert is resolved.</small>' : ''}`;
    }
    if (marker.kind === 'household') return `<h2>Household</h2>${facts([['Address', marker.record.address]])}<small>Approximate household location from the available records.</small>`;
    if (marker.kind === 'complaint') return `<h2>Complaint · ${e(marker.record.category)}</h2>${UI.badge(marker.record.status)}<p>${e(marker.record.location)}</p><p class="official-long-copy">${e(marker.record.description)}</p><small>Pin shown at the matching household location.</small>${destination(`official-feedback.html?type=complaint&id=${marker.record.id}`, 'View complaint')}`;
    if (marker.record) return `<h2>${e(marker.record.name)}</h2><p>${e(facilityType(marker.record))} · ${facilityActive(marker.record) ? 'Active' : 'Inactive — unavailable'}</p><p>${e(facilityDetail(marker.record))}</p><a class="btn" href="official-facilities.html?id=${marker.record.id}">View facility</a>`;
    return '<h2>Barangay hall</h2><p>Barangay Sampaguita</p><small>Community landmark on the illustrated map.</small>';
  }
  function bindSummary(root, marker) {
    root.querySelector('[data-acknowledge]')?.addEventListener('click', async event => {
      if (busy) return; busy = true; const button = event.currentTarget; button.disabled = true; button.textContent = 'Acknowledging…';
      try { await Api.alerts.acknowledge(marker.record.id); UI.toast(`${Fmt.alertId(marker.record.id)} acknowledged.`); }
      catch (err) { UI.toast(err.message, 'error'); }
      finally { busy = false; if (root.tagName === 'DIALOG') UI.closeDialog(root); await load(); summary.focus({ preventScroll: true }); }
    });
    root.querySelector('[data-resolve]')?.addEventListener('click', () => resolveAlert(marker.record, async () => { if (root.tagName === 'DIALOG') UI.closeDialog(root); await load(); summary.focus({ preventScroll: true }); }));
  }
  function select(marker, openSheet = false) {
    selected = marker?.id || null; mapView?.select(selected); decorateMarkers(); summary.innerHTML = summaryBody(marker); bindSummary(summary, marker); saveFilters();
    if (openSheet && matchMedia('(max-width:767px)').matches && marker?.kind !== 'hall') { const el = dialog(marker.kind === 'alert' ? 'Alert summary' : 'Map selection', `<div class="official-section">${summaryBody(marker)}</div>`); bindSummary(el, marker); }
  }
  function update() {
    if (!loaded) return;
    const focused = document.activeElement, markerFocus = focused.closest?.('[data-marker]')?.dataset.marker, listFocus = focused.closest?.('[data-select-marker]')?.dataset.selectMarker;
    projection = monitoringMarkers(data, filters, role);
    if (!projection.markers.some(m => m.id === selected)) selected = null;
    projection.markers.forEach(m => m.selected = m.id === selected);
    if (!mapView) mapView = BCMap.mount(canvas, { barangay_id: user.barangay_id, markers: projection.markers, onSelect: marker => { if (['hospital', 'evacuation'].includes(marker.kind)) { location.assign(`official-facilities.html?id=${marker.record.id}`); return; } select(marker, true); } });
    else mapView.setMarkers(projection.markers);
    select(projection.markers.find(m => m.id === selected));
    markerList.querySelector('div').innerHTML = projection.markers.map(m => `<button type="button" class="btn" data-select-marker="${e(m.id)}">${e(m.label)}</button>`).join('');
    if (markerFocus) [...canvas.querySelectorAll('[data-marker]')].find(b => b.dataset.marker === markerFocus)?.focus({ preventScroll: true });
    if (listFocus) [...markerList.querySelectorAll('[data-select-marker]')].find(b => b.dataset.selectMarker === listFocus)?.focus({ preventScroll: true });
    main.querySelector('[data-map-count]').textContent = `${projection.alertCount} ${projection.alertCount === 1 ? 'alert' : 'alerts'} shown`;
    main.querySelector('[data-map-empty]').hidden = projection.alertCount !== 0;
    const unplaced = main.querySelector('[data-unplaced]'); unplaced.hidden = !projection.unplacedComplaints; unplaced.textContent = `${projection.unplacedComplaints} complaints have no matching household location and are not pinned.`;
    document.querySelectorAll('[data-filter]').forEach(field => { field.value = filters[field.dataset.filter]; });
    document.querySelectorAll('[data-layer]').forEach(button => { const key = button.dataset.layer; button.setAttribute('aria-pressed', String(filters[key])); button.querySelector('span').textContent = `${key === 'households' ? 'Households' : 'Complaints'} · ${filters[key] ? 'Shown' : 'Hidden'}`; });
  }
  function bindFilters(root) {
    root.querySelectorAll('[data-filter]').forEach(field => field.addEventListener('change', () => { filters[field.dataset.filter] = field.value; update(); }));
    root.querySelectorAll('[data-layer]').forEach(button => button.addEventListener('click', () => { filters[button.dataset.layer] = !filters[button.dataset.layer]; update(); }));
    root.querySelector('[data-reset-filters]').addEventListener('click', () => { Object.assign(filters, { status: '', type: '', facility: '', households: true, complaints: false }); update(); });
  }
  bindFilters(main);
  main.querySelector('[data-open-filters]').addEventListener('click', () => { const el = dialog('Map filters', filterBody('sheet')); bindFilters(el); });
  main.querySelectorAll('[data-open-legend]').forEach(button => button.addEventListener('click', () => dialog('Map legend', legend())));
  main.querySelectorAll('[data-open-facilities]').forEach(button => button.addEventListener('click', () => {
    const el = dialog('Facilities', `<div class="stack"><div class="field"><label for="map-facility-picker">Facility type</label><select class="select" id="map-facility-picker" data-facility-type><option value="">All facilities</option><option value="EvacuationCenter">Evacuation centers</option><option value="Hospital">Hospitals</option></select></div><div class="stack-sm" data-facility-list></div></div>`);
    const list = el.querySelector('[data-facility-list]');
    const render = () => { const value = el.querySelector('select').value, rows = data.facilities.filter(f => !value || f.type === value); list.innerHTML = rows.length ? rows.map(f => `<a class="card official-facility-option" href="official-facilities.html?id=${f.id}"><strong>${e(f.name)}</strong><span>${facilityActive(f) ? 'Active' : 'Inactive · Unavailable'} · ${e(facilityType(f))} · ${e(facilityDetail(f))}</span><span>View facility ${Icons.svg('arrow-right', { size: 20 })}</span></a>`).join('') : UI.empty({ icon: 'hospital', title: 'No facilities found', text: 'Choose another facility type.' }); };
    el.querySelector('select').addEventListener('change', render); const off = Api.subscribe('facilities', async () => { try { const rows = await Api.facilities.list(); if(el.open) { data.facilities = rows; render(); } } catch(error) { UI.toast(error.message, 'error'); } }); el.addEventListener('close', off, {once:true}); render();
  }));
  async function load() {
    const request = ++version;
    try {
      const [alerts, facilities, complaints] = await Promise.all([Api.alerts.list(), Api.facilities.list(), ['secretary', 'captain'].includes(role) ? Api.feedback.list({ type: 'complaint' }) : Promise.resolve([])]);
      const people = await Promise.all([...new Set(complaints.map(c => c.resident_id))].map(id => Api.users.get(id)));
      if (request !== version) return;
      data = { alerts, facilities, complaints, households: [...alerts.map(a => a.household), ...people.map(p => p.household)].filter(Boolean) }; loaded = true; error.hidden = true; update();
      main.querySelectorAll('[data-open-facilities]').forEach(button => { button.disabled = false; button.removeAttribute('title'); });
    } catch (err) { if (request !== version) return; error.querySelector('.grow').textContent = loaded ? `The map could not refresh. Displayed records may be out of date. ${err.message}` : `Unable to load map monitoring. ${err.message}`; error.hidden = false; if (!loaded) { canvas.innerHTML = UI.empty({ icon: 'map', title: 'Map unavailable', text: 'Use Try again to reload the map.' }); summary.innerHTML = '<h2>Alert summary</h2><p>Map data is unavailable.</p>'; } }
    finally { if (request === version) canvas.removeAttribute('aria-busy'); }
  }
  main.querySelector('[data-retry]').addEventListener('click', load);
  live(['facilities','alerts', 'feedback', 'users'], load)();
  window.addEventListener('pagehide', event => { if (!event.persisted) { version++; mapView?.destroy(); } }, { once: true });
}
