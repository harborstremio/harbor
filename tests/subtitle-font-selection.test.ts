// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { sfntFamilyName } from "../src/lib/font-family-name.ts";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(at(p), "utf8");
const overlay = read("src/components/player/subtitle-overlay.tsx");
const preview = read("src/views/settings/player-panel/internals.tsx");
const picker = read("src/views/settings/player-panel/subtitle-section.tsx");
const mpv = read("src/lib/player/sub-style.ts");
const settings = read("src/lib/settings.tsx");
const store = read("src/lib/settings/profile-store.ts");
const indexHtml = read("index.html");
const fetchFonts = read("scripts/fetch-fonts.mjs");

const PRESETS = ["inter", "system", "rounded", "serif", "arabic"];

function bundledFamilies(): Set<string> | null {
  const dir = at("src-tauri/fonts/");
  const out = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /\.(ttf|otf|ttc)$/i.test(f));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  for (const f of files) {
    const b = readFileSync(new URL(f, dir));
    const name = sfntFamilyName(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    if (name) out.add(name);
  }
  return out;
}

test("the picker offers exactly the presets both renderers can resolve", () => {
  for (const id of PRESETS) {
    assert.match(picker, new RegExp(`id: "${id}"`), `PRESET_FONTS is missing "${id}"`);
  }
  for (const id of PRESETS.filter((p) => p !== "inter")) {
    assert.match(overlay, new RegExp(`case "${id}":`), `fontFamilyFor has no "${id}" case`);
    assert.match(preview, new RegExp(`case "${id}":`), `previewFamily has no "${id}" case`);
  }
});

test("every family mpv is told to use is provisioned into the bundle", () => {
  for (const family of ["Inter", "Fredoka", "Vazirmatn"]) {
    assert.match(mpv, new RegExp(`"${family}"`), `mpvFontFor never returns "${family}"`);
    assert.match(
      fetchFonts,
      new RegExp(`${family}-Variable\\.ttf`),
      `fetch-fonts.mjs never fetches ${family}`,
    );
    assert.match(
      fetchFonts,
      new RegExp(`file: "${family}-Variable\\.ttf",[\\s\\S]{0,200}?sha256: "[0-9a-f]{64}"`),
    );
  }
  assert.doesNotMatch(mpv, /Noto Sans Arabic/, "arabic must resolve to the bundled Vazirmatn");
});

test("the fetched font files really carry the family names libass is asked for", () => {
  const bundled = bundledFamilies();
  if (!bundled) return;
  for (const family of ["Inter", "Fredoka", "Vazirmatn", "Noto Sans JP"]) {
    assert.ok(bundled.has(family), `no bundled font is named "${family}" (found: ${[...bundled]})`);
  }
});

test("web font stacks only name families the app actually loads", () => {
  assert.doesNotMatch(overlay, /Nunito|Quicksand/);
  assert.doesNotMatch(preview, /Nunito|Quicksand/);
  for (const family of ["Fredoka", "Vazirmatn", "Inter", "Fraunces"]) {
    assert.match(indexHtml, new RegExp(family), `${family} must be loaded to be usable`);
  }
});

test("arabic uses the bundled arabic face, not Inter", () => {
  assert.match(overlay, /case "arabic":\s*\n\s*return '"Vazirmatn"/);
  assert.match(preview, /case "arabic":\s*\n\s*return '"Vazirmatn"/);
});

test("a custom font reaches mpv under its real family name", () => {
  assert.match(mpv, /if \(id\.startsWith\("custom:"\)\) return customName \|\| "Inter";/);
  assert.match(mpv, /mpvFontFor\(s\.subFontFamily, customFontName\(s\)\)/);
  assert.match(
    mpv,
    /f\?\.family \|\| f\?\.name/,
    "the internal family name must win over the filename",
  );
});

test("uploading a font never puts its bytes in the settings blob", () => {
  assert.match(picker, /await saveFontData\(id, dataUrl\);/);
  assert.doesNotMatch(
    picker,
    /name: baseName \|\| `Custom \$\{customFonts\.length \+ 1\}`, dataUrl,/,
  );
  assert.match(picker, /family,\s+format: formatMap\[ext\],/);
});

test("a settings write that does not persist is not swallowed", () => {
  assert.match(store, /const ok = setItemWithRecovery\(sourceKeyFor\(profileId, linked\), json\);/);
  assert.match(store, /if \(!ok\) \{[\s\S]*console\.error/);
});

test("a deleted custom font never strands the font picker", () => {
  assert.match(settings, /if \(!fam\?\.startsWith\("custom:"\)\) return;/);
  assert.match(settings, /setSettings\(\(s\) => \(\{ \.\.\.s, subFontFamily: "inter" \}\)\);/);
});

test("a failed font migration never discards the only copy of the font", () => {
  assert.match(settings, /const moved = new Set<string>\(\);/);
  assert.match(settings, /moved\.add\(f\.id\);/);
  assert.match(
    settings,
    /moved\.has\(f\.id\) \? \{ id: f\.id, name: f\.name, format: f\.format \} : f/,
  );
});

test("family-name parsing survives junk instead of guessing", () => {
  assert.equal(sfntFamilyName(new ArrayBuffer(0)), null);
  assert.equal(
    sfntFamilyName(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).buffer),
    null,
  );
});

test("an uploaded font is registered from bytes, not a megabyte-long css url", () => {
  assert.match(picker, /const bytes = await file\.arrayBuffer\(\);/);
  assert.match(picker, /new FontFace\(`harbor-font-\$\{id\}`, bytes, \{ display: "swap" \}\)/);
  assert.doesNotMatch(picker, /new FontFace\(`harbor-font-\$\{id\}`, `url\(/);
});

test("a font that failed to load is shown as broken instead of silently falling back", () => {
  assert.match(picker, /face\.family === `harbor-font-\$\{f\.id\}` && face\.status === "loaded"/);
  assert.match(picker, /const broken = f\.custom && unloaded\.has/);
  assert.match(picker, /border-danger\/40 bg-danger\/10 text-danger/);
});
