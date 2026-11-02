import { lstat, realpath, mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFrontendArtifact } from './stage-frontend.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function stageBackendFrontend({ root = projectRoot } = {}) {
  root = await realpath(root);
  const publicPath = resolve(root, 'backend/public'), target = resolve(publicPath, 'frontend');
  // Verify every destination ancestor before any recursive replacement.
  for (const path of [resolve(root, 'backend'), publicPath]) {
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Backend public path must be a real directory');
  }
  if (target !== resolve(root, 'backend/public/frontend') || !target.startsWith(root + sep)) throw new Error('Invalid backend artifact target');
  try { if ((await lstat(target)).isSymbolicLink()) throw new Error('Backend artifact cannot be a symbolic link'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const artifact = await buildFrontendArtifact({ root });
  const files = artifact.files.filter(name => name !== 'assets/js/data/seed.js');
  await rm(target, { recursive: true, force: true });
  for (const name of files) {
    const destination = resolve(target, name);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(artifact.directory, name), destination);
  }
  await writeFile(resolve(target, 'assets/js/core/runtime-config.js'), "export const Runtime = Object.freeze({ mode: 'backend' });\n");
  return { directory: target, files };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await stageBackendFrontend();
  console.log(`Staged ${result.files.length} frontend files in backend/public/frontend (backend mode, no seed).`);
}
