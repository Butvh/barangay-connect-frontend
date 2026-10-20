import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (file, message) => errors.push(`${relative(root, file)}: ${message}`);
async function walk(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.name === '.git') continue;
    if (entry.name === 'node_modules') { fail(path, 'Runtime packages are forbidden.'); continue; }
    files.push(...entry.isDirectory() ? await walk(path) : [path]);
  }
  return files;
}
const files = await walk(root);
const sourceExtensions = ['.html', '.css', '.js', '.mjs'];
for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/'), ext = extname(file);
  if ((await stat(file)).size > 2 * 1024 * 1024) fail(file, 'File exceeds the 2 MB commit limit.');
  if (['.ts', '.tsx'].includes(ext)) fail(file, 'TypeScript is forbidden.');
  if (name === 'package.json') {
    try { if (Object.keys(JSON.parse(await readFile(file, 'utf8')).dependencies || {}).length) fail(file, 'Runtime dependencies are forbidden.'); }
    catch { fail(file, 'Invalid package metadata.'); }
  }
  if (!sourceExtensions.includes(ext)) continue;
  const source = await readFile(file, 'utf8');
  // The checker itself contains detection strings and is not application code.
  if (name.startsWith('scripts/') || name.startsWith('tests/')) continue;
  if (/\bon\w+\s*=/i.test(source) && ext === '.html') fail(file, 'Inline event attributes are forbidden.');
  if (/\b(?:jquery|tailwindcss|bootstrap|react-dom|vue\.global|leaflet)\b/i.test(source)) fail(file, 'Forbidden runtime library reference.');
  if (/(?:https?:)?\/\/(?:cdn\.|unpkg\.|cdnjs\.|fonts\.google|esm\.sh)/i.test(source)) fail(file, 'CDN or hosted font reference.');
  if (ext === '.js' && /["'`]\s*(?:https?:)?\/\//i.test(source)) fail(file, 'Application URLs must be relative and work offline.');
  const references = [];
  if (ext === '.html') for (const match of source.matchAll(/\b(?:src|href|action)\s*=\s*["']([^"']*)["']/gi)) references.push(match[1]);
  if (ext === '.css') for (const match of source.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/gi)) references.push(match[1]);
  if (ext === '.js') for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g)) references.push(match[1]);
  for (const ref of references) {
    if (!ref || ref.startsWith('#')) continue;
    if (/^(?:\/|[a-z]+:)/i.test(ref)) { fail(file, `URL must be relative: ${ref}`); continue; }
    const local = resolve(dirname(file), decodeURIComponent(ref.split(/[?#]/)[0]));
    if (!local.startsWith(`${root}\\`) && !local.startsWith(`${root}/`)) { fail(file, `Asset escapes repo: ${ref}`); continue; }
    try { if (!(await stat(local)).isFile()) fail(file, `Missing local file: ${ref}`); } catch { fail(file, `Missing local file: ${ref}`); }
  }
  if (/\b(?:require\s*\(|import\s+.*?from\s*['"](?:react|vue|jquery))/.test(source)) fail(file, 'Use browser ES modules without runtime packages.');
}
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
else console.log(`PASS: ${files.length} files; offline references, ownership-neutral asset checks and 2 MB limit.`);
