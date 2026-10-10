/*
 * fetch-binaries.mjs
 *
 * Downloads the Tauri "externalBin" sidecars (yt-dlp, ffmpeg, ffprobe) for the
 * CURRENT OS + arch and writes them to src-tauri/binaries/<name>-<triple>[.exe],
 * which is exactly the path tauri.conf.json externalBin resolves to at build time.
 *
 * Why this script exists:
 *   src-tauri/binaries/* is gitignored (see .gitignore), so a fresh clone ships
 *   NONE of these binaries. Without them `tauri build` dies with
 *   "resource path binaries/yt-dlp-<triple> doesn't exist". Run this once (via
 *   `pnpm run setup`) before building.
 *
 * ----------------------------------------------------------------------------
 * SOURCES - PLEASE VERIFY THESE URLS. They are "latest/rolling" upstream builds,
 * so they are intentionally NOT checksum pinned (unlike fetch-libmpv/fetch-fonts,
 * which pin a fixed asset). They also could NOT be test-downloaded in the
 * environment that wrote this script. VERIFY EACH ONE AT RUNTIME.
 * ----------------------------------------------------------------------------
 *
 * yt-dlp  (single self-contained binary, no archive)
 *   linux  x86_64 : github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
 *   linux  aarch64: github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64
 *   macOS  (both) : github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
 *                   (universal2; needs macOS 12+. For macOS 11 use yt-dlp_macos_legacy.)
 *   windows x86_64: github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
 *
 * ffmpeg + ffprobe  (extracted from an archive)
 *   linux  x86_64 : github.com/BtbN/FFmpeg-Builds latest ffmpeg-master-latest-linux64-gpl.tar.xz
 *   linux  aarch64: github.com/BtbN/FFmpeg-Builds latest ffmpeg-master-latest-linuxarm64-gpl.tar.xz
 *                   (was johnvansickle.com, which 415-blocks CI/automated GETs. BtbN is a
 *                    static standalone build hosted on GitHub releases, same as yt-dlp above.)
 *   macOS  (both) : evermeet.cx/ffmpeg/getrelease/ffmpeg/zip  and  .../ffprobe/zip
 *                   (evermeet ships x86_64; on Apple Silicon it runs under Rosetta.
 *                   For a native arm64 static build use osxexperts.net instead.)
 *   windows x86_64: gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
 *                   (alt: github.com/BtbN/FFmpeg-Builds latest win64-gpl zip)
 *
 * Extraction tools (documented external dependency):
 *   .tar.xz -> `tar -xJf`  (linux; GNU tar + xz-utils)
 *   .zip    -> macOS: `unzip`   windows: PowerShell Expand-Archive   (both built in)
 *
 * Env overrides (mirrors / air-gapped): HARBOR_YTDLP_URL, HARBOR_FFMPEG_URL,
 * HARBOR_FFPROBE_URL replace the resolved URL for the current platform. Or just
 * drop the finished binary into src-tauri/binaries/<name>-<triple>[.exe] by hand.
 */

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(root, "src-tauri", "binaries");

function targetTriple() {
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (process.platform === "win32") return `${arch}-pc-windows-msvc`;
  if (process.platform === "darwin") return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

const EXE = process.platform === "win32" ? ".exe" : "";
const triple = targetTriple();
const mb = (p) => (statSync(p).size / 1048576).toFixed(0);

const YTDLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const BTBN = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest";
const EVERMEET = "https://evermeet.cx/ffmpeg/getrelease";
const GYAN = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SOURCES = {
  "yt-dlp": {
    "x86_64-unknown-linux-gnu": { kind: "raw", url: `${YTDLP}/yt-dlp_linux` },
    "aarch64-unknown-linux-gnu": { kind: "raw", url: `${YTDLP}/yt-dlp_linux_aarch64` },
    "x86_64-apple-darwin": { kind: "raw", url: `${YTDLP}/yt-dlp_macos` },
    "aarch64-apple-darwin": { kind: "raw", url: `${YTDLP}/yt-dlp_macos` },
    "x86_64-pc-windows-msvc": { kind: "raw", url: `${YTDLP}/yt-dlp.exe` },
  },
  ffmpeg: {
    "x86_64-unknown-linux-gnu": { kind: "tar.xz", url: `${BTBN}/ffmpeg-master-latest-linux64-gpl.tar.xz`, member: "ffmpeg" },
    "aarch64-unknown-linux-gnu": { kind: "tar.xz", url: `${BTBN}/ffmpeg-master-latest-linuxarm64-gpl.tar.xz`, member: "ffmpeg" },
    "x86_64-apple-darwin": { kind: "zip", url: `${EVERMEET}/ffmpeg/zip`, member: "ffmpeg" },
    "aarch64-apple-darwin": { kind: "zip", url: `${EVERMEET}/ffmpeg/zip`, member: "ffmpeg" },
    "x86_64-pc-windows-msvc": { kind: "zip", url: GYAN, member: "ffmpeg.exe" },
  },
  ffprobe: {
    "x86_64-unknown-linux-gnu": { kind: "tar.xz", url: `${BTBN}/ffmpeg-master-latest-linux64-gpl.tar.xz`, member: "ffprobe" },
    "aarch64-unknown-linux-gnu": { kind: "tar.xz", url: `${BTBN}/ffmpeg-master-latest-linuxarm64-gpl.tar.xz`, member: "ffprobe" },
    "x86_64-apple-darwin": { kind: "zip", url: `${EVERMEET}/ffprobe/zip`, member: "ffprobe" },
    "aarch64-apple-darwin": { kind: "zip", url: `${EVERMEET}/ffprobe/zip`, member: "ffprobe" },
    "x86_64-pc-windows-msvc": { kind: "zip", url: GYAN, member: "ffprobe.exe" },
  },
};

const OVERRIDE = {
  "yt-dlp": process.env.HARBOR_YTDLP_URL,
  ffmpeg: process.env.HARBOR_FFMPEG_URL,
  ffprobe: process.env.HARBOR_FFPROBE_URL,
};

const ENVVAR = {
  "yt-dlp": "HARBOR_YTDLP_URL",
  ffmpeg: "HARBOR_FFMPEG_URL",
  ffprobe: "HARBOR_FFPROBE_URL",
};

const dlCache = new Map();
async function download(url) {
  if (dlCache.has(url)) return dlCache.get(url);
  console.log(`[binaries] fetching ${url}`);
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA, accept: "*/*" } });
  if (!res.ok) throw new Error(`download failed (${res.status} ${res.statusText})`);
  const buf = Buffer.from(await res.arrayBuffer());
  dlCache.set(url, buf);
  return buf;
}

function walk(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function findMember(dir, name) {
  let best = null;
  let bestSize = -1;
  for (const p of walk(dir, [])) {
    if (basename(p) !== name) continue;
    const size = statSync(p).size;
    if (size > bestSize) {
      best = p;
      bestSize = size;
    }
  }
  return best;
}

function extractMember(buf, kind, member, dest) {
  const tmp = mkdtempSync(join(tmpdir(), "harbor-bin-"));
  try {
    const archive = join(tmp, kind === "tar.xz" ? "archive.tar.xz" : "archive.zip");
    writeFileSync(archive, buf);
    const outDir = join(tmp, "out");
    mkdirSync(outDir, { recursive: true });
    if (kind === "tar.xz") {
      execFileSync("tar", ["-xJf", archive, "-C", outDir], { stdio: "inherit" });
    } else if (process.platform === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath "${archive}" -DestinationPath "${outDir}" -Force`],
        { stdio: "inherit" },
      );
    } else {
      execFileSync("unzip", ["-oq", archive, "-d", outDir], { stdio: "inherit" });
    }
    const found = findMember(outDir, member);
    if (!found) throw new Error(`could not find ${member} inside archive`);
    copyFileSync(found, dest);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function hint(name) {
  const lines = [
    `[binaries] fix: set ${ENVVAR[name]} to a mirror URL, or drop a working`,
    `[binaries]      ${name}-${triple}${EXE} into src-tauri/binaries/ by hand.`,
  ];
  if (name === "yt-dlp") lines.push("[binaries]      source: github.com/yt-dlp/yt-dlp/releases/latest");
  else lines.push("[binaries]      static builds: johnvansickle.com (linux), evermeet.cx / osxexperts.net (macOS), gyan.dev or BtbN (windows)");
  return lines.join("\n");
}

if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

let ok = true;
for (const name of ["yt-dlp", "ffmpeg", "ffprobe"]) {
  const dest = join(binDir, `${name}-${triple}${EXE}`);
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`[binaries] ${name}-${triple}${EXE} already present (${mb(dest)} MB)`);
    continue;
  }
  const spec = SOURCES[name][triple];
  if (!spec) {
    console.error(`[binaries] no known source for ${name} on ${triple}`);
    console.error(hint(name));
    ok = false;
    continue;
  }
  const url = OVERRIDE[name] ?? spec.url;
  try {
    const buf = await download(url);
    if (spec.kind === "raw") writeFileSync(dest, buf);
    else extractMember(buf, spec.kind, spec.member, dest);
    if (process.platform !== "win32") chmodSync(dest, 0o755);
    console.log(`[binaries] wrote ${name}-${triple}${EXE} (${mb(dest)} MB)`);
  } catch (err) {
    console.error(`[binaries] ${name} failed: ${err.message}`);
    console.error(hint(name));
    ok = false;
  }
}

if (!ok) {
  console.error("[binaries] one or more sidecars are missing; see messages above");
  process.exit(1);
}
console.log(`[binaries] all sidecars ready for ${triple}`);
