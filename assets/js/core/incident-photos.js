import { Runtime } from './runtime-config.js';

export const privatePhotosEnabled = Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.photoTest === true;

export function incidentPhotoGallery(photos) {
  if (!privatePhotosEnabled || !Array.isArray(photos)) return '';
  return '<div class="incident-photo-grid">' + photos.filter(photo => Number.isSafeInteger(photo.id) && photo.id > 0 &&
    ['image/jpeg', 'image/png'].includes(photo.mime) && Number.isSafeInteger(photo.bytes) && photo.bytes > 0).map((photo, index) => {
    const url = '/api/v1/incident-photos/' + photo.id + '/download';
    return `<figure><img src="${url}" alt="Incident photo ${index + 1}" loading="lazy"><figcaption><a class="private-document-link" href="${url}" download>Download photo ${index + 1}</a></figcaption></figure>`;
  }).join('') + '</div>';
}
