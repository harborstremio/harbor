// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ar from "../src/lib/i18n/locales/ar.ts";
import pt from "../src/lib/i18n/locales/pt.ts";
import ru from "../src/lib/i18n/locales/ru.ts";
import { subtitleClassificationLabels } from "../src/lib/subtitles/classification-labels.ts";

const allFlags = {
  hearingImpaired: true,
  forced: true,
  foreignOnly: true,
  machineTranslated: true,
};

test("subtitle classification labels provide full and compact translated presentations", () => {
  const translate = (key: string) => `[${key}]`;

  assert.deepEqual(subtitleClassificationLabels(allFlags, translate), [
    { kind: "hearingImpaired", label: "[Hearing impaired]" },
    { kind: "forced", label: "[Forced]" },
    { kind: "foreignOnly", label: "[Foreign-only]" },
    { kind: "machineTranslated", label: "[Machine-translated]" },
  ]);
  assert.deepEqual(subtitleClassificationLabels(allFlags, translate, "compact"), [
    { kind: "hearingImpaired", label: "[HI/SDH]" },
    { kind: "forced", label: "[Forced]" },
    { kind: "foreignOnly", label: "[Foreign-only]" },
    { kind: "machineTranslated", label: "[MT]" },
  ]);
  assert.deepEqual(
    subtitleClassificationLabels(
      { hearingImpaired: false, forced: false, foreignOnly: false, machineTranslated: false },
      translate,
    ),
    [],
  );
});

test("supported catalogs localize every subtitle classification label", () => {
  const localizedKeys = [
    "Hearing impaired",
    "Forced",
    "Foreign-only",
    "Machine-translated",
    "Audio verified",
  ];
  const compactKeys = ["HI/SDH", "MT"];

  for (const [locale, catalog] of [
    ["ar", ar],
    ["pt", pt],
    ["ru", ru],
  ] as const) {
    for (const key of localizedKeys) {
      assert.equal(typeof catalog[key], "string", `${locale} is missing ${key}`);
      assert.notEqual(catalog[key], key, `${locale} does not localize ${key}`);
    }
    for (const key of compactKeys) {
      assert.equal(typeof catalog[key], "string", `${locale} is missing compact label ${key}`);
      assert.ok(catalog[key].trim().length > 0, `${locale} has an empty compact label ${key}`);
    }
  }
});

test("desktop, pre-play, and television subtitle rows share the classification label helper", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const desktopSearch = read("src/components/player/subtitle-menu/search-results.tsx");
  const desktopVariant = read("src/components/player/subtitle-menu/variant-row.tsx");
  const prePlay = read("src/views/play-picker/subtitle-select-step.tsx");
  const bpPrePlay = read("src/views/big-picture/bp-subtitle-step.tsx");
  const bpPlayer = read("src/views/big-picture/player/bp-subtitle-parts.tsx");

  assert.match(desktopSearch, /subtitleClassificationLabels\(result, t\)/u);
  assert.match(desktopVariant, /subtitleClassificationLabels\(\s*track,\s*tr,?\s*\)/u);
  assert.match(desktopVariant, /tr\("Audio verified"\)/u);
  assert.doesNotMatch(desktopSearch, />\s*(?:Foreign-only|MT)\s*</u);

  assert.match(prePlay, /subtitleClassificationLabels\(result, t, "compact"\)/u);
  assert.match(bpPrePlay, /subtitleClassificationLabels\(r, t, "compact"\)/u);
  assert.match(bpPlayer, /subtitleClassificationLabels\(x, t, "compact"\)/u);
});
