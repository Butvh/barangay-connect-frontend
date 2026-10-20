import { runSuite } from './suite.js';
const result = await runSuite(row => { if (!row.passed) console.error(`FAIL ${row.name}\n${row.error}`); });
console.log(`${result.passed} passed, ${result.failed} failed.`);
if (result.failed) process.exitCode = 1;
