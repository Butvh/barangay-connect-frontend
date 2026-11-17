// Shared integration seam. Domain owners add reviewed factories here, using the
// provided { http, auth } only. A missing domain always fails closed.
import { Runtime } from '../core/runtime-config.js';
import { operationalComposition } from './operational-registration.js';
import { createAdministrativeFactories, administrativeReaders, createConsentFactories } from './administrative-registration.js';

// Release metadata is generated only by the admitted stager. Server authorization
// still decides every request; editable browser metadata never grants authority.
const release = Runtime.mode === 'backend' && Runtime.releaseProfile === 'p0-v1' &&
  ['operationalTest', 'administrationTest', 'photoTest', 'consentTest', 'generalFeedbackTest'].every(key => Runtime[key] === false);
const selected = await operationalComposition((release || (Runtime.mode === 'backend' && Runtime.operationalTest === true)),
  { privatePhotos: Runtime.photoTest === true, generalFeedbackTest: Runtime.administrationTest === true && Runtime.generalFeedbackTest === true });
const administration = Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.administrationTest === true;
const consent = release || Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.consentTest === true;
export const domainFactories = Object.freeze({ ...selected.factories, ...(release ? createAdministrativeFactories({ profileOnly: true }) : administration ? createAdministrativeFactories() : {}), ...(consent ? createConsentFactories() : {}) });
export const refreshSources = Object.freeze({ ...selected.sources, ...(administration ? administrativeReaders : {}) });
