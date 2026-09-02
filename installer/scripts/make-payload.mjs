import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const INSTALLER = resolve(HERE, '..');
const APP = resolve(INSTALLER, '..', 'src-tauri');
const SETUP = join(INSTALLER, 'src-tauri');
const UI = join(INSTALLER, 'ui');
const STAGE = join(INSTALLER, 'payload-stage');
const OUT_DIR = join(SETUP, 'payload');
const OUT = join(OUT_DIR, 'harbor-payload.zip');

const UNINSTALLER = join(SETUP, 'target', 'release', 'harbor-uninstall.exe');
const UNINSTALLER_CEILING = 60 * 1048576;
const BUILD_UNINSTALLER =
  'cd installer/src-tauri && cargo build --release --no-default-features --bin harbor-uninstall';

const FILES = [
  [join(APP, 'target', 'release', 'harbor.exe'), 'harbor.exe'],
  [join(APP, 'THIRD-PARTY-NOTICES.txt'), 'notices'],
  [join(APP, 'binaries', 'mpv-x86_64-pc-windows-msvc.exe'), 'mpv.exe'],
  [join(APP, 'binaries', 'ffmpeg-x86_64-pc-windows-msvc.exe'), 'ffmpeg.exe'],
  [join(APP, 'binaries', 'ffprobe-x86_64-pc-windows-msvc.exe'), 'ffprobe.exe'],
  [join(APP, 'binaries', 'yt-dlp-x86_64-pc-windows-msvc.exe'), 'yt-dlp.exe'],
  [join(APP, 'libmpv', 'libmpv-2.dll'), 'libmpv-2.dll'],
  [UNINSTALLER, 'uninstall.exe'],
];

const missing = FILES.filter(([src]) => !existsSync(src)).map(([src]) => src);
if (missing.length) {
  console.error('Missing inputs.\n');
  missing.forEach((m) => console.error('  ' + m));
  if (missing.includes(UNINSTALLER)) {
    console.error('\nThe uninstaller is built before the payload. Build it with:');
    console.error('  ' + BUILD_UNINSTALLER);
  }
  if (missing.some((m) => m !== UNINSTALLER)) {
    console.error('\nFor the rest, run "pnpm tauri build" in the repo root first.');
  }
  process.exit(1);
}

function newestMtime(path, newest) {
  const info = statSync(path);
  if (!info.isDirectory()) return Math.max(newest, info.mtimeMs);
  let out = newest;
  for (const name of readdirSync(path)) {
    out = newestMtime(join(path, name), out);
  }
  return out;
}

const uninstallerStat = statSync(UNINSTALLER);

if (uninstallerStat.size > UNINSTALLER_CEILING) {
  console.error(`The uninstaller is ${(uninstallerStat.size / 1048576).toFixed(0)} MB, which means it`);
  console.error('was built with the payload feature on. Rebuild it with:');
  console.error('  ' + BUILD_UNINSTALLER);
  process.exit(1);
}

const UNINSTALLER_INPUTS = [
  join(SETUP, 'src'),
  join(SETUP, 'Cargo.toml'),
  join(SETUP, 'tauri.conf.json'),
  join(SETUP, 'capabilities'),
  UI,
];

let newestSource = 0;
for (const input of UNINSTALLER_INPUTS) {
  newestSource = newestMtime(input, newestSource);
}

if (newestSource > uninstallerStat.mtimeMs) {
  console.error('The built uninstaller is older than the sources it embeds, so bundling it now would');
  console.error('ship a stale binary. Rebuild it with:');
  console.error('  ' + BUILD_UNINSTALLER);
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, 'fonts'), { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (const [src, name] of FILES) {
  cpSync(src, join(STAGE, name));
  total += statSync(src).size;
}

const fontsDir = join(APP, 'fonts');
for (const f of readdirSync(fontsDir)) {
  cpSync(join(fontsDir, f), join(STAGE, 'fonts', f));
  total += statSync(join(fontsDir, f)).size;
}

const appVersion = JSON.parse(readFileSync(join(APP, 'tauri.conf.json'), 'utf8')).version;
if (!appVersion) {
  console.error('Cannot read version from src-tauri/tauri.conf.json');
  process.exit(1);
}
writeFileSync(join(OUT_DIR, 'version.txt'), appVersion, 'utf8');
console.log(`payload version: ${appVersion}`);

rmSync(OUT, { force: true });
execFileSync('powershell', [
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${OUT}' -CompressionLevel Optimal -Force`,
], { stdio: 'inherit' });

rmSync(STAGE, { recursive: true, force: true });

const zipped = statSync(OUT).size;
const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
console.log(`\npayload ready: ${OUT}`);
console.log(`  ${mb(total)} of files compressed to ${mb(zipped)}`);
console.log(`  uninstall.exe ${mb(uninstallerStat.size)}, built ${new Date(uninstallerStat.mtimeMs).toISOString()}`);
