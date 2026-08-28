// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const source = readFileSync(new URL("../src/lib/use-localized-overview.ts", import.meta.url), "utf8");

test("a metadata language is independent from the display language", () => {
  assert.match(source, /settings\.tmdbLanguage && settings\.translateDescriptions/);
  assert.match(source, /meta\.id\.startsWith\("tt"\)/);
  assert.match(source, /tmdbIdFromImdb\([\s\S]*settings\.tmdbKey,[\s\S]*meta\.id,/);
  assert.match(source, /tmdbMetadataOverview\(settings\.tmdbKey, tmdbId\)/);
  assert.match(source, /preferredMeta\?\.description \|\| meta\.description/);
});
