// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { normalizeLang } from "../src/lib/subtitles/language";

const menu = readFileSync(
  new URL("../src/components/player/audio-menu.tsx", import.meta.url),
  "utf8",
);

test("a language typed in its own script resolves to its code", () => {
  // The request came from someone looking for an Arabic dub; Gulf and Russian are the
  // two largest audiences, and neither types "Arabic" or "Russian" first.
  assert.equal(normalizeLang("العربية"), "ar");
  assert.equal(normalizeLang("عربي"), "ar");
  assert.equal(normalizeLang("русский"), "ru");
  assert.equal(normalizeLang("日本語"), "ja");
  assert.equal(normalizeLang("한국어"), "ko");
  assert.equal(normalizeLang("中文"), "zh");
  assert.equal(normalizeLang("türkçe"), "tr");
  assert.equal(normalizeLang("tiếng việt"), "vi");
});

test("native names fold through the same path as codes and English names", () => {
  for (const written of ["ar", "ara", "Arabic", "العربية"]) {
    assert.equal(normalizeLang(written), "ar", `"${written}" should reach ar`);
  }
  for (const written of ["ru", "rus", "Russian", "Русский"]) {
    assert.equal(normalizeLang(written), "ru", `"${written}" should reach ru`);
  }
});

test("adding native names did not disturb the existing region rules", () => {
  assert.equal(normalizeLang("pt-br"), "pt-br");
  assert.equal(normalizeLang("es-MX"), "es-419");
  assert.equal(normalizeLang("in"), "id");
  assert.equal(normalizeLang(""), "");
});

test("the menu only offers search once a list is worth searching", () => {
  assert.match(menu, /const SEARCH_FROM = \d+;/);
  assert.match(menu, /tracks\.length >= SEARCH_FROM/);
});

test("the match is diacritic-insensitive and language-aware", () => {
  assert.match(menu, /normalize\("NFD"\)\.replace\(\/\\p\{M\}\/gu, ""\)/);
  assert.match(menu, /normalizeLang\(track\.lang\) === wanted/);
});

test("the header count reflects the filtered list, not the whole file", () => {
  // The subtitle menu shipped the opposite of this and it read as a bug.
  assert.match(menu, /tabular-nums text-ink-subtle">\{shown\.length\}/);
});
