import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkJlBundle } from "../scripts/check-jl-bundle.mjs";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../src-tauri");

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "jl-bundle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, content = "test resource") => {
    const path = resolve(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  for (const name of ["tauri.conf.json", "tauri.windows.conf.json", "tauri.jl-dev.conf.json"]) {
    put(name, readFileSync(resolve(sourceRoot, name)));
  }
  for (const name of [
    "THIRD-PARTY-NOTICES.txt", "installer-hooks.nsh", "installer-jl/eula.txt",
    "installer-jl/header.bmp", "installer-jl/sidebar.bmp", "libmpv/libmpv-2.dll",
    "resources/capstan/runtime.json", "resources/harbor-stream-blocker/manifest.json",
    ...["32x32.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico"].map((name) => `icons-jl/${name}`),
    ...["mpv", "yt-dlp", "ffmpeg", "ffprobe"].map((name) => `binaries/${name}-x86_64-pc-windows-msvc.exe`),
    ...["LICENSE-OFL-Inter.txt", "NotoSansJP-Regular.otf", "NotoSansJP-Bold.otf", "Inter-Variable.ttf", "Fredoka-Variable.ttf", "Vazirmatn-Variable.ttf"].map((name) => `fonts/${name}`),
    ...["Harbor.PokemonEngine.exe", "Harbor.PokemonEngine.dll", "Harbor.PokemonEngine.runtimeconfig.json", "sources/README.md", "sources/LICENSE", "sources/pkforge.zip", "sources/pkhex.zip", "sources/automod.zip"].map((name) => `resources/pokemon-engine/${name}`),
  ]) put(name);
  put("resources/pokemon-engine/sources/upstream.json", JSON.stringify({ pkforge: { commit: "pinned" } }));
  put("resources/pokemon-engine/engine.json", JSON.stringify({
    protocol: 1, rid: "win-x64", revision: "pinned",
    sha256: createHash("sha256").update("test resource").digest("hex"),
  }));
  return { root, put };
}

test("a complete Windows bundle passes without launching its executables", (t) => {
  const { root } = fixture(t);
  assert.ok(checkJlBundle(root) > 0);
});

test("missing and empty sidecars are reported before the native build", (t) => {
  const { root, put } = fixture(t);
  rmSync(resolve(root, "binaries/ffmpeg-x86_64-pc-windows-msvc.exe"));
  put("binaries/yt-dlp-x86_64-pc-windows-msvc.exe", "");
  assert.throws(() => checkJlBundle(root), (error) =>
    error.message.includes("ffmpeg-x86_64") && error.message.includes("yt-dlp-x86_64"));
});

test("font licenses cannot satisfy missing subtitle font prerequisites", (t) => {
  const { root } = fixture(t);
  rmSync(resolve(root, "fonts/NotoSansJP-Regular.otf"));
  assert.throws(() => checkJlBundle(root), /NotoSansJP-Regular\.otf/);
});

test("a stale engine manifest cannot pass with a different executable", (t) => {
  const { root, put } = fixture(t);
  put("resources/pokemon-engine/Harbor.PokemonEngine.exe", "changed executable");
  assert.throws(() => checkJlBundle(root), /manifest does not match/);
});

test("corresponding source archives are required for distribution", (t) => {
  const { root } = fixture(t);
  rmSync(resolve(root, "resources/pokemon-engine/sources/automod.zip"));
  assert.throws(() => checkJlBundle(root), /sources\/automod\.zip/);
});
