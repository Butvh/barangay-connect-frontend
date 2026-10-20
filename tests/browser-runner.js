import { runSuite } from './suite.js';
import { Auth } from '../assets/js/core/auth.js';
import { mountLiveChecks } from './live-harness.js';
Auth.requireRole([]);
const summary = document.querySelector('[data-summary]');
const output = document.querySelector('[data-results]');
const result = await runSuite(row => { const li = document.createElement('li'); li.textContent = `${row.passed ? 'PASS' : 'FAIL'} · ${row.name}${row.error ? ` — ${row.error}` : ''}`; output.append(li); });
summary.textContent = `${result.passed} passed, ${result.failed} failed. Tests use isolated memory stores; your demo data was not changed.`;
mountLiveChecks(document.querySelector('[data-live]'));
