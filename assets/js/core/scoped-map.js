import { Api } from './api.js';
import { Auth } from './auth.js';
import { Config, ApiError } from './config.js';
import { UI } from './ui.js';
import { BCMap as Renderer } from './map.js';
import { mapScopeFor, scopedMarkers } from './map-scope.js';

// Both explicit demo and backend use their selected API reader. No seed/storage fallback.
export async function currentMapScope() {
  const actor = Auth.current();
  if (!actor) throw new ApiError('AUTH', 'Sign in to view your barangay map.');
  const rows = await Api.barangays.list();
  const current = Auth.current();
  if (!current || current.id !== actor.id || current.barangay_id !== actor.barangay_id || current.auth_version !== actor.auth_version) {
    throw new ApiError('CONFLICT', 'Your account changed. Refresh this page.');
  }
  return mapScopeFor(rows.find(row => Number(row.id) === Number(actor.barangay_id)), actor.barangay_id);
}

// Preserve the existing synchronous map handle while references load asynchronously.
// The pure renderer receives only an explicit, resolved scope, never a guessed ID.
export const BCMap = { mount(container, options = {}) {
  let renderer, destroyed = false, version = 0, markers = options.markers || [], selected, centered, off = () => {};
  container.innerHTML = '<p class="startup-status" role="status">Loading map coverage…</p>';
  const handle = {
    setMarkers(rows) { markers = rows; if (renderer) renderer.setMarkers(scopedMarkers(rows, handle.context, { demo: Config.DEMO_MODE })); },
    select(id) { selected = id; renderer?.select(id); },
    centerOn(point, zoom) { centered = [point, zoom]; renderer?.centerOn(point, zoom); },
    zoomIn() { renderer?.zoomIn(); }, zoomOut() { renderer?.zoomOut(); },
    destroy() { destroyed = true; version++; off(); renderer?.destroy(); container.replaceChildren(); },
    context: null,
  };
  const refresh = () => { const request = ++version; return currentMapScope().then(context => {
    if (destroyed || request !== version) return null;
    // A caller's resource cannot select another tenant's artwork.
    if (options.barangay_id != null && Number(options.barangay_id) !== context.barangay_id) context = mapScopeFor(null, context.barangay_id);
    handle.context = context;
    renderer?.destroy();
    renderer = Renderer.mount(container, { ...options, ...context, markers: scopedMarkers(markers, context, { demo: Config.DEMO_MODE }) });
    options.onCoverage?.(context);
    if (selected !== undefined) renderer.select(selected);
    if (centered) renderer.centerOn(...centered);
    return context;
  }).catch(error => {
    if (!destroyed && request === version) {
      renderer?.destroy(); renderer = null; handle.context = null; options.onCoverage?.(null);
      container.innerHTML = UI.empty({ icon: 'map', title: 'Map unavailable', text: error.message || 'Map coverage could not load. Refresh this page to try again.' });
    }
    return null;
  }); };
  handle.ready = refresh(); off = Api.subscribe('barangays', refresh);
  return handle;
} };
