// Shared integration seam. Domain owners add reviewed factories here, using the
// provided { http, auth } only. A missing domain always fails closed.
import { Runtime } from '../core/runtime-config.js';
import { operationalComposition } from './operational-registration.js';
import { createAdministrativeFactories, administrativeReaders, createConsentFactories } from './administrative-registration.js';

const selected = await operationalComposition(Runtime.mode === 'backend' && Runtime.operationalTest === true,
  { privatePhotos: Runtime.photoTest === true, generalFeedbackTest: Runtime.administrationTest === true && Runtime.generalFeedbackTest === true });
const administration = Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.administrationTest === true;
const consent = Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.consentTest === true;
export const domainFactories = Object.freeze({ ...selected.factories, ...(administration ? createAdministrativeFactories() : {}), ...(consent ? createConsentFactories() : {}) });
export const refreshSources = Object.freeze({ ...selected.sources, ...(administration ? administrativeReaders : {}) });
