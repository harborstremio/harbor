import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNativeRuntime } from './spooktober-native/build.mjs';

// Runtime-only bundle: follow the page's modules, data and artwork, never source captures.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'public', 'spooktober');
const sourceArgument = process.argv[2];
const checkOnly = process.argv[3] === '--check';
if (!sourceArgument || process.argv.length > 4 || (process.argv[3] && !checkOnly)) {
  throw new Error('Usage: node scripts/stage-spooktober.mjs <absolute-preview-directory> [--check]');
}
if (!path.isAbsolute(sourceArgument)) throw new Error('The preview source must be an absolute path.');

const source = await realpath(sourceArgument);
const sourceFiles = new Set();
const queue = [];
const inspected = new Set();
const textual = new Set(['.html', '.css', '.js', '.json', '.svg']);
const mediaExtension = /\.(?:svg|png|jpe?g|webp|gif|avif|woff2?|otf|ttf|mp3|m4a|ogg|wav|webm|mp4)$/i;
const runtimeExtension = /\.(?:html|css|js|json)$/i;
const excluded = /(?:^|\/)(?:[^/]*-sources\.json|SOURCES\.md|[^/]*-source\.html)$/i;

function contained(base, target) {
  const relative = path.relative(base, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
if (source === destination || contained(source, destination) || contained(destination, source)) {
  throw new Error('Source and packaged output must be separate directories.');
}

async function ensureSafePath(base, relative) {
  const absolute = path.resolve(base, relative);
  if (!contained(base, absolute)) throw new Error(`Path leaves its allowed directory: ${relative}`);
  let current = base;
  for (const part of path.relative(base, absolute).split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return absolute;
}

function cleanReference(value) {
  if (!value || /^[a-z][a-z\d+.-]*:|^\/\//i.test(value)) return null;
  const clean = value.split(/[?#]/, 1)[0].replaceAll('\\', '/').replace(/^\.\//, '');
  if (!clean || clean.includes('${') || clean.startsWith('#') || excluded.test(clean)) return null;
  return clean;
}

async function include(reference) {
  const relative = cleanReference(reference);
  if (!relative || sourceFiles.has(relative)) return;
  const absolute = await ensureSafePath(source, relative);
  const info = await lstat(absolute);
  if (!info.isFile()) throw new Error(`Runtime reference is not a file: ${relative}`);
  sourceFiles.add(relative);
  if (textual.has(path.extname(relative))) queue.push(relative);
}

async function includeDirectory(relative, filter = () => true) {
  const directory = await ensureSafePath(source, relative);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${candidate}`);
    if (entry.isDirectory()) await includeDirectory(candidate, filter);
    else if (entry.isFile() && filter(candidate)) await include(candidate);
  }
}

await include('index.html');
await include('credits.html');
// These lightweight sets are selected by runtime string interpolation, not literal URLs.
for (const directory of ['art', 'icons', 'fonts', 'services', 'portraits']) {
  await includeDirectory(`assets/${directory}`, (file) => mediaExtension.test(file));
}
await includeDirectory('assets/screening', (file) => /\/director-[^/]+\.(?:jpe?g|png|webp)$/i.test(file));

while (queue.length) {
  const relative = queue.shift();
  if (inspected.has(relative)) continue;
  inspected.add(relative);
  const text = await readFile(path.join(source, relative), 'utf8');
  // All catalog covers and CSS assets are literal paths. This deliberately ignores remote URLs.
  for (const match of text.matchAll(/(?:^|[\s'"`(=:>])((?:\.\/)?assets\/[a-z\d_./%+@-]+\.(?:svg|png|jpe?g|webp|gif|avif|woff2?|otf|ttf|mp3|m4a|ogg|wav|webm|mp4))(?:[?#][^\s'"`<>)]*)?/gim)) {
    await include(match[1]);
  }
  // Follow module imports, data fetches, linked styles, and linked local runtime pages.
  for (const match of text.matchAll(/["']((?:\.\/)?[a-z\d][a-z\d_.-]*\.(?:html|css|js|json))(?:[?#][^"']*)?["']/gi)) {
    if (runtimeExtension.test(match[1])) await include(match[1]);
  }
}

// Do not recursively clean public: unrelated files and previous manual additions are preserved.
await ensureSafePath(root, 'public/spooktober');
if (!checkOnly) await mkdir(destination, { recursive: true });
const files = [];
const nativeFiles = await buildNativeRuntime(source, sourceFiles);
for (const relative of [...sourceFiles].sort()) {
  const from = await ensureSafePath(source, relative);
  const to = await ensureSafePath(destination, relative);
  const data = await readFile(from);
  if (!checkOnly) {
    await mkdir(path.dirname(to), { recursive: true });
    let unchanged = false;
    try { unchanged = data.equals(await readFile(to)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!unchanged) await copyFile(from, to);
  }
  files.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
for (const [relative, content] of nativeFiles) {
  const to = await ensureSafePath(destination, relative);
  const data = Buffer.from(content);
  if (!checkOnly) await writeFile(to, data);
  files.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
files.sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  schemaVersion: 1,
  entrypoint: 'native-entry.js',
  fileCount: files.length,
  totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  files,
};
const manifestPath = await ensureSafePath(destination, 'runtime-manifest.json');
if (!checkOnly) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ checkOnly, destination, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, manifest: manifestPath }, null, 2));
