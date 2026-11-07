import { readdir, lstat, mkdir, copyFile, rm, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = /^(?:index|login|register|resident-[a-z-]+|official-[a-z-]+|captain-[a-z-]+)\.html$/;
const forbidden = /(?:^|\/)(?:\.[^/]+|node_modules|vendor|uploads?|private|secrets?|credentials?|dumps?|logs?)(?:\/|\.|$)/i;
function allowed(name) {
  if (forbidden.test(name)) return false;
  if (!name.includes('/')) return page.test(name);
  if (/^assets\/css\/[^/]+\.css$/.test(name)) return true;
  if (/^assets\/js\/(?:core|pages|adapters)\/[^/]+\.js$/.test(name)) return true;
  if (name === 'assets/js/data/seed.js') return true; // Fictional public demo only.
  if (/^assets\/fonts\/[^/]+\.(?:woff2?|ttf|otf)$/.test(name)) return true;
  return name.startsWith('assets/img/') && ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'].includes(extname(name).toLowerCase());
}

export async function buildFrontendArtifact({ root = projectRoot, destination = resolve(root, '.frontend-dist') } = {}) {
  root = await realpath(root);
  destination = resolve(destination);
  // This is the only recursively replaced directory; never accept arbitrary paths.
  if (destination !== resolve(root, '.frontend-dist') || !destination.startsWith(root + sep)) throw new Error('Invalid artifact destination');
  try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('Artifact destination cannot be a symbolic link'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = [];
  async function collect(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name), name = relative(root, path).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) throw new Error(`Static source is a symbolic link: ${name}`);
      if (entry.isDirectory()) { if (!forbidden.test(name)) await collect(path); }
      else if (entry.isFile() && allowed(name)) files.push(name);
    }
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.name.includes('/') && page.test(entry.name)) {
      if (entry.isSymbolicLink()) throw new Error('Static page cannot be a symbolic link');
      if (entry.isFile()) files.push(entry.name);
    }
  }
  try { const assets = await lstat(resolve(root, 'assets')); if (assets.isSymbolicLink()) throw new Error('Assets cannot be a symbolic link'); if (assets.isDirectory()) await collect(resolve(root, 'assets')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!files.includes('index.html')) throw new Error('Static artifact requires index.html');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const name of files.sort()) { const target = resolve(destination, name); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(root, name), target); }
  return { directory: destination, files: files.sort() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildFrontendArtifact();
  console.log(`Staged ${result.files.length} allowlisted static files in .frontend-dist.`);
}
