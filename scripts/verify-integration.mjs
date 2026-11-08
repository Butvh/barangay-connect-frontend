import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySources } from './integration-sources.mjs';
import { verifyIntegratedCandidate } from './integrated-candidate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'integration-manifest.json'), 'utf8'));
if (manifest.kind === 'integrated-audit-candidate-v1') {
  const count = await verifyIntegratedCandidate(root, manifest);
  console.log(`PASS ${count} candidate fingerprints; ${manifest.upstreamOwnerFiles} upstream owner files retained; ${manifest.explicitPatches} explicit audit patches; candidate ${manifest.candidate}; dirty=${manifest.dirty}`);
} else {
const count = await verifySources(root, manifest);
const ownerCount = Object.values(manifest.ownerHashes).reduce((n, files) => n + Object.keys(files).length, 0);
console.log(`PASS ${count} total source fingerprints; ${ownerCount} exact DBA/P2 blobs; ${Object.keys(manifest.sharedOverlays || {}).length} reviewed common-base overlays; P1 ${manifest.p1}; dirty=${manifest.dirty}`);
}
