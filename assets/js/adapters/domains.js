// Shared integration seam. Domain owners add reviewed factories here, using the
// provided { http, auth } only. A missing domain always fails closed.
import { Runtime } from '../core/runtime-config.js';
import { operationalComposition } from './operational-registration.js';

const selected = await operationalComposition(Runtime.mode === 'backend' && Runtime.operationalTest === true);
export const domainFactories = selected.factories;
export const refreshSources = selected.sources;
