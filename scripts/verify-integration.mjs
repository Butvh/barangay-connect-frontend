import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'integration-manifest.json'), 'utf8'));
let count = 0;
for (const files of Object.values(manifest.ownerHashes)) for (const [name, expected] of Object.entries(files)) {
  if (name.startsWith('/') || name.includes('..') || name.includes('\\')) throw new Error('Invalid owner manifest path');
  const actual = createHash('sha256').update(await readFile(resolve(root, name))).digest('hex');
  if (actual !== expected) throw new Error(`Owner source changed: ${name}`);
  count++;
}
console.log(`PASS ${count} DBA/P2 source files retain their pinned bytes; P1 ${manifest.p1}; dirty=${manifest.dirty}`);
