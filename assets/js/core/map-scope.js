// Artwork identity and percentage coordinates are distinct from tenant IDs.
export const recognizedMapScope = value => value === 'sampaguita';
export const mapCoordinates = row => row != null && ['x', 'y'].every(key => {
  const value = row[key];
  return value !== null && value !== undefined && !(typeof value === 'string' && !value.trim()) && typeof value !== 'boolean' &&
    typeof value !== 'object' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
});
export function mapScopeFor(barangay, barangayId) {
  const id = Number(barangayId);
  const supported = Number.isSafeInteger(id) && id > 0 && Number(barangay?.id) === id && recognizedMapScope(barangay?.map_scope);
  return Object.freeze({ barangay_id: id, map_scope: supported ? barangay.map_scope : null, supported, name: barangay?.name || 'Your barangay' });
}
export function scopedMarkers(markers, context, { demo = false } = {}) {
  if (!context.supported) return [];
  return markers.filter(marker => {
    if (!mapCoordinates(marker)) return false;
    if (marker.kind === 'hall') return demo; // No server-declared hall coordinate exists.
    const record = marker.record;
    const tenant = record?.managed_by_barangay_id ?? record?.barangay_id ?? marker.barangay_id;
    if (tenant != null && Number(tenant) !== context.barangay_id) return false;
    if (['hospital', 'evacuation'].includes(marker.kind) && record) {
      return Number(tenant) === context.barangay_id && record.map_scope === context.map_scope;
    }
    return (record?.map_scope ?? marker.map_scope ?? context.map_scope) === context.map_scope;
  });
}
