// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { searchWyzie } from "../src/lib/subtitles/providers/wyzie.ts";

test("Wyzie uses a known display language instead of inventing English", async () => {
  const results = await searchWyzie(
    { imdbId: "tt1234567" },
    async () =>
      new Response(
        JSON.stringify([
          { id: 1, url: "https://example.test/ar.srt", display: "Arabic" },
          { id: 2, url: "https://example.test/ar2.srt", language: "ara", display: "Arabic" },
          { id: 3, url: "https://example.test/unknown.srt" },
          { id: 4, url: "https://example.test/en.srt", language: "en", display: "Arabic" },
        ]),
      ),
  );
  assert.deepEqual(
    results.map((r) => r.lang),
    ["ar", "ar", "", "en"],
  );
});
