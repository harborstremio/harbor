// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { classifyProviderSubtitleMetadata } from "../src/lib/subtitles/provider-classification.ts";

const addonSource = readFileSync(
  new URL("../src/lib/subtitles/providers/addons.ts", import.meta.url),
  "utf8",
);
const opensubtitlesSource = readFileSync(
  new URL("../src/lib/subtitles/providers/opensubtitles-v3.ts", import.meta.url),
  "utf8",
);

test("provider subtitle flags are preserved and explicit false beats filename hints", () => {
  assert.deepEqual(
    classifyProviderSubtitleMetadata(
      {
        hearing_impaired: 1,
        forced: "yes",
        foreign_only: true,
        machine_translated: true,
      },
      [],
    ),
    {
      hearingImpaired: true,
      forced: true,
      foreignOnly: true,
      machineTranslated: true,
    },
  );
  assert.deepEqual(
    classifyProviderSubtitleMetadata(
      { hearingImpaired: false, forced: false, machineTranslated: false },
      ["Movie.SDH.forced.AI-translated.srt"],
    ),
    {
      hearingImpaired: false,
      forced: false,
      foreignOnly: undefined,
      machineTranslated: false,
    },
  );
});

test("strong filename tags provide weak fallback metadata without inspecting subtitle prose", () => {
  assert.deepEqual(
    classifyProviderSubtitleMetadata({}, ["Show.S02E05.foreign-parts.SDH.machine-translated.srt"]),
    {
      hearingImpaired: true,
      forced: true,
      foreignOnly: true,
      machineTranslated: true,
    },
  );
  assert.equal(
    classifyProviderSubtitleMetadata({}, ["A naturally written fan translation.srt"])
      .machineTranslated,
    undefined,
  );
});

test("generic addon and OpenSubtitles mappers attach the shared classification", () => {
  assert.match(addonSource, /\.\.\.classification,/u);
  assert.match(opensubtitlesSource, /\.\.\.classification,/u);
});
