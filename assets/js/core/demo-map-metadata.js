import { mapScopeFor, mapCoordinates } from './map-scope.js';

// Read-only compatibility for the explicit fictional browser demo's old schema.
// Backend mode never invokes this projection or imports its seed template.
export function demoMapMetadata(db, template) {
  const barangays = db.barangays.map(row => Object.hasOwn(row, 'map_scope') ? row : {
    ...row, map_scope: row.map_image === 'assets/img/maps/sampaguita.png' ? 'sampaguita' : null,
  });
  const facilities = db.facilities.map(row => {
    if (Object.hasOwn(row, 'map_scope')) return row;
    // Preserve the old explicitly documented shared demo referral's owner only
    // when its fixture identity still matches. Never infer another shared owner.
    const fixture = template.facilities.find(item => ['id', 'barangay_id', 'name', 'address', 'type'].every(key => item[key] === row[key]));
    const owner = row.managed_by_barangay_id ?? row.barangay_id ?? fixture?.managed_by_barangay_id ?? null;
    const context = mapScopeFor(barangays.find(area => area.id === owner), owner);
    return { ...row, ...(row.barangay_id === null && owner !== null ? { managed_by_barangay_id: owner } : {}),
      map_scope: mapCoordinates({ x: row.map_x, y: row.map_y }) ? context.map_scope : null };
  });
  return { ...db, barangays, facilities };
}
