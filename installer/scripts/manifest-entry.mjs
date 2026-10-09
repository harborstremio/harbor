import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SETUP = resolve(HERE, '..', 'src-tauri');
const argv = process.argv.slice(2);

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const exe = resolve(flag('exe', join(SETUP, 'target', 'release', 'harbor-setup.exe')));
const base = flag('base', 'https://harbor.site/updates').replace(/\/+$/, '');
const platform = flag('platform', 'windows-x86_64');
const versionFile = join(SETUP, 'payload', 'version.txt');

const problems = [];
if (!existsSync(exe)) problems.push(`no installer at ${exe}`);
if (!existsSync(`${exe}.sig`)) {
  problems.push(`no signature at ${exe}.sig - run:\n    pnpm tauri signer sign "${exe}"`);
}
if (!existsSync(versionFile)) {
  problems.push(`no ${versionFile} - run: node installer/scripts/make-payload.mjs`);
}
if (problems.length) {
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

const version = readFileSync(versionFile, 'utf8').trim();
const [major = 0, minor = 0, patch = 0] = version.split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
const payloadVersion = major * 1_000_000 + minor * 1_000 + patch;

const setupStat = statSync(exe);
const zip = join(SETUP, 'payload', 'harbor-payload.zip');
if (existsSync(zip) && statSync(zip).mtimeMs > setupStat.mtimeMs) {
  console.error('The payload is newer than the installer, so this exe does not carry it.');
  console.error('Rebuild with: cd installer/src-tauri && cargo build --release --bin harbor-setup');
  process.exit(1);
}

const name = `Harbor_${version}_x64-installer.exe`;
const block = {
  installer: {
    [platform]: {
      url: `${base}/${name}`,
      signature: readFileSync(`${exe}.sig`, 'utf8').trim(),
      size: setupStat.size,
      payloadVersion,
    },
  },
};

console.log(`upload  ${exe}`);
console.log(`     as ${name}   (the release API reads version and platform from this name)`);
console.log(`\nthe publisher rebuilds this block itself once the exe and its .sig are staged:\n`);
console.log(JSON.stringify(block, null, 2));
console.log(`\n${basename(exe)} is ${(setupStat.size / 1048576).toFixed(0)} MB, payload ${version}, payloadVersion ${payloadVersion}`);
