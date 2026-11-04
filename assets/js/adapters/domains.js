// Shared integration seam. Domain owners add reviewed factories here, using the
// provided { http, auth } only. A missing domain always fails closed.
import { Runtime } from '../core/runtime-config.js';
import { operationalComposition } from './operational-registration.js';
import { createAdministrativeFactories, administrativeReaders } from './administrative-registration.js';

const selected = await operationalComposition(Runtime.mode === 'backend' && Runtime.operationalTest === true);
const administration = Runtime.mode === 'backend' && Runtime.operationalTest === true && Runtime.administrationTest === true;
export const domainFactories = Object.freeze({ ...selected.factories, ...(administration ? createAdministrativeFactories() : {}) });
export const refreshSources = Object.freeze({ ...selected.sources, ...(administration ? administrativeReaders : {}) });
