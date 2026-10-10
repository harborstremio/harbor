// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { subtitleSearchMatchDetails } from "../src/lib/subtitles/match-explanation.ts";

test("manual search details keep provider and local release evidence separate", () => {
  const details = subtitleSearchMatchDetails(
    {
      id: "subdl:42",
      url: "https://example.test/subtitle.srt",
      lang: "en",
      source: "subdl",
      release: "Show.S02E05.1080p.WEB-DL-GROUP",
      providerMatch: {
        confidence: "high",
        score: 0.91,
        reasons: ["SubDL matched its release filename"],
      },
    },
    {
      release: "Show.S02E05.1080p.WEB-DL-GROUP.mkv",
      season: 2,
      episode: 5,
    },
  );

  assert.deepEqual(details.providerReasons, ["SubDL matched its release filename"]);
  assert.ok(details.localReasons.length > 0);
  assert.ok(details.reasons.some((reason) => reason.startsWith("Provider:")));
  assert.ok(details.reasons.some((reason) => reason.startsWith("Local:")));
  assert.ok(details.compatibilityPercent > 0);
  assert.equal(details.reasons.at(-1), "Timing: not tested");
});
