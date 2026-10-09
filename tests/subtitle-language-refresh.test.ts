// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { mpvBridgeHarness } from "./helpers/mpv-bridge-harness.ts";
import { filterTracksByPreferredLanguage } from "../src/lib/subtitles/language.ts";
import { subtitleTrackLanguageLabel } from "../src/lib/subtitles/track-label.ts";

for (const nativeLang of [undefined, "und", "en"]) {
  test(`Arabic download keeps its language when native metadata is ${nativeLang}`, async () => {
    const h = mpvBridgeHarness();
    await h.bridge.load({ url: "fixture.mkv" });
    await h.bridge.addSubtitle("C:/subs/arabic.srt", "ar", "Arabic release", false);
    for (let refresh = 0; refresh < 3; refresh++) {
      h.emit("track-list", [
        {
          type: "sub",
          id: 2,
          external: true,
          "external-filename": "C:\\subs\\arabic.srt",
          lang: nativeLang,
          selected: false,
        },
      ]);
      const tracks = h.snapshot().subtitleTracks;
      assert.equal(tracks[0].lang, "ar");
      assert.equal(subtitleTrackLanguageLabel(tracks[0]), "Arabic");
      assert.equal(filterTracksByPreferredLanguage(tracks, ["ar"]).length, 1);
    }
  });
}

test("unknown local subtitle language is not invented as English", async () => {
  const h = mpvBridgeHarness();
  await h.bridge.load({ url: "fixture.mkv" });
  await h.bridge.addSubtitle("C:/subs/unknown.srt", undefined, undefined, false);
  h.emit("track-list", [
    { type: "sub", id: 3, external: true, "external-filename": "C:/subs/unknown.srt" },
  ]);
  assert.equal(subtitleTrackLanguageLabel(h.snapshot().subtitleTracks[0]), "Unknown");
});
