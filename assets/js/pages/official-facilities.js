import { Auth, Api, UI, Icons, e, facilityType, facilityDetail, facts, dialog, errorView } from './official-shared.js';
import { Shell } from '../core/shell-official.js';

let user;
try { Auth.requireRole(['secretary', 'responder', 'rescuer']); user = Auth.current(); }
catch (error) { if (!['AUTH', 'FORBIDDEN'].includes(error.code)) document.querySelector('#app').innerHTML = UI.empty({ title: 'Unable to open facilities', text: error.message }); }
if (user) {
  const main = Shell.official({ active: 'Facilities' }), params = new URLSearchParams(location.search);
  const types = ['', 'EvacuationCenter', 'Hospital'];
  let type = types.includes(params.get('type')) ? params.get('type') || '' : '', rows = [], requested = Number(params.get('id'));
  function show(f) {
    const el = dialog('Facility details', `<div class="stack"><div class="row"><span class="icon-tile">${Icons.svg(f.type === 'Hospital' ? 'hospital' : 'school')}</span><h3>${e(f.name)}</h3></div>${facts([['Type', facilityType(f)], ['Address', f.address], [f.type === 'Hospital' ? 'Contact' : 'Capacity', f.type === 'Hospital' ? f.contact : `${f.capacity ?? 'Not provided'} people`]])}<a class="btn" href="official-map.html?facility=${f.id}">View on map</a><button type="button" class="btn btn-primary" data-done>Done</button></div>`);
    el.querySelector('[data-done]').addEventListener('click', () => UI.closeDialog(el));
  }
  function render() {
    const filtered = rows.filter(f => !type || f.type === type);
    main.innerHTML = `<header class="official-heading"><h1>Facilities</h1><p>Facility directory for response and referral</p></header><div class="actions official-facility-filters" aria-label="Facility type">${types.map((value, i) => `<button type="button" class="chip" data-type="${value}" aria-pressed="${type === value}">${['All', 'Evacuation centers', 'Hospitals'][i]}</button>`).join('')}</div><div class="official-facility-grid">${filtered.length ? filtered.map(f => `<article class="card official-facility-card"><h2>${e(f.name)}</h2><div><small>${e(facilityType(f))}</small><p>${e(f.address || 'Address not provided')}</p><p>${e(facilityDetail(f))}</p></div><button type="button" class="btn" data-view="${f.id}" aria-label="View ${e(f.name)}">View facility</button></article>`).join('') : UI.empty({ icon: 'hospital', title: 'No facilities found', text: 'Choose another facility type.' })}</div>`;
    main.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => { type = button.dataset.type; const next = new URLSearchParams(); if (type) next.set('type', type); history.replaceState(null, '', `official-facilities.html${next.size ? `?${next}` : ''}`); render(); main.querySelector(`[data-type="${type}"]`).focus(); }));
    main.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => show(filtered.find(f => f.id === Number(button.dataset.view)))));
  }
  async function load() {
    main.setAttribute('aria-busy', 'true'); main.innerHTML = '<p class="sr-only" role="status">Loading facilities…</p>' + UI.skeleton(2);
    try { rows = await Api.facilities.list(); render(); if (requested) { const f = rows.find(f => f.id === requested); requested = 0; if (f) show(f); else UI.toast('Facility not found in your barangay directory.', 'error'); } }
    catch (error) { errorView(main, error, load); }
    finally { main.removeAttribute('aria-busy'); }
  }
  load();
}
