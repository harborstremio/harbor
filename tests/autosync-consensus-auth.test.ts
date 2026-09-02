// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { runConsensus } from "../src/lib/subtitles/autosync/consensus.ts";

test("autosync consensus discovers cloud addons with the signed-in auth key", async () => {
  let discoveredWith: string | null | undefined;
  const cues = Array.from(
    { length: 24 },
    (_, index) => [index * 4, index * 4 + 2] as [number, number],
  );
  const result = await runConsensus(
    {
      mediaUrl: "https://example.test/video.mkv",
      sourceKind: "http",
      durationSec: 120,
      cues,
      cueText: cues.map((_, index) => `dialogue line number ${index}`),
      audioLanguage: "en",
      subtitleLanguage: "en",
      preferredSubtitleLanguages: ["en"],
      languages: ["en"],
    },
    {
      providers: { addons: true, opensubtitles: false, wyzie: false },
      authKey: "signed-in-auth-key",
      gatherAddons: async (authKey) => {
        discoveredWith = authKey;
        return [];
      },
    },
  );

  assert.equal(discoveredWith, "signed-in-auth-key");
  assert.equal(result?.verdict, "unknown");
});
