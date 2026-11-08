import { createP2DomainFactories } from './p2-registration.js';
import { createSubmissionIntent } from './submission-intent.js';
import { createSourceFactories, sourceReaders } from './source-references.js';

export async function operationalComposition(enabled = false, { privatePhotos = false, generalFeedbackTest = false } = {}) {
  if (!enabled) return { factories: Object.freeze({}), sources: Object.freeze({}) };
  const loadOwner = name => import(new URL(name, import.meta.url).href);
  const [{ createOperations }, { createCommunications }, { createReports }, { createRefreshReaders }, { configureOperationalSubmissions }] = await Promise.all([
    './operations.js', './communications.js', './reports.js', './p2-domains.js', './p2-form-intent.js',
  ].map(loadOwner));
  configureOperationalSubmissions({ createSubmissionIntent });
  const all = createP2DomainFactories({ createOperations, createCommunications, createReports, privatePhotos, generalFeedbackTest });
  const entities = ['alerts', 'dashboard', 'map', 'announcements', 'feedback', 'notifications', 'reports'];
  return {
    factories: Object.freeze({
      ...createSourceFactories(),
      ...Object.fromEntries(entities.map(entity => [entity, all[entity]])),
    }),
    sources: Object.freeze({ ...sourceReaders, ...Object.fromEntries(['alerts', 'dashboard', 'map', 'notifications', 'announcements', 'feedback', 'reports'].map(entity => [entity, context => createRefreshReaders(context)[entity]])) }),
  };
}
