import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("[mpv] not Windows, skipping bundled mpv.exe");
  process.exit(0);
}

// shinchiro prunes old GitHub releases; the same builds are mirrored on SourceForge. The
// checksum pins the exact archive, so either source is safe.
const SPECS = {
  x64: {
    release: "20261004",
    mirrorDir: "64bit",
    asset: "mpv-x86_64-20261004-git-413ff0b1cd.7z",
    sha256: "0703a0d62c60b2c68511c6a101db82a31c32c69bcdd86941632a1e76bb1699b7",
  },
  arm64: {
    release: "20260610",
    mirrorDir: "aarch64",
    asset: "mpv-aarch64-20260610-git-304426c.7z",
    sha256: "0781fdffeef27a40a7f266631d1ca9e5c1d0f82868a1678c58d23e0b1bd1eb98",
  },
};

const spec = SPECS[process.arch];
if (!spec) {
  throw new Error(`[mpv] unsupported Windows architecture: ${process.arch}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "src-tauri", "binaries", "mpv-x86_64-pc-windows-msvc.exe");

if (existsSync(destination) && statSync(destination).size > 0) {
  console.log(`[mpv] ${destination} already present`);
  process.exit(0);
}

function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(path, name);
      if (found) return found;
    } else if (entry.name === name) {
      return path;
    }
  }
  return null;
}

const urls = [
  `https://downloads.sourceforge.net/project/mpv-player-windows/${spec.mirrorDir}/${spec.asset}`,
  `https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/${spec.release}/${spec.asset}`,
];
const temp = mkdtempSync(join(tmpdir(), "harbor-mpv-"));

async function download() {
  const failures = [];
  for (const url of urls) {
    console.log(`[mpv] fetching ${url}`);
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      failures.push(`${url}: ${response.status} ${response.statusText}`);
    } catch (e) {
      failures.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`[mpv] download failed\n  ${failures.join("\n  ")}`);
}

try {
  const bytes = await download();
  const archive = join(temp, spec.asset);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== spec.sha256) throw new Error(`[mpv] checksum mismatch (expected ${spec.sha256}, got ${digest})`);
  writeFileSync(archive, bytes);

  const extracted = join(temp, "extracted");
  mkdirSync(extracted);
  try {
    execFileSync("7z", ["x", "-y", archive, `-o${extracted}`], { stdio: "inherit" });
  } catch {
    throw new Error("[mpv] extraction failed; install 7-Zip and ensure `7z` is on PATH");
  }

  const mpv = findFile(extracted, "mpv.exe");
  if (!mpv) throw new Error("[mpv] mpv.exe was not found in the archive");
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(mpv, destination);
  console.log(`[mpv] wrote ${destination}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
