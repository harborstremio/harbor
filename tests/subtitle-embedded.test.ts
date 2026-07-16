// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isAssTrack, isImageSubTrack } from "../src/lib/player/sub-format.ts";
import {
  subtitleTrackLanguageLabel,
  subtitleTrackTitle,
} from "../src/lib/subtitles/track-label.ts";
import { pickDesiredSubtitleTrack } from "../src/lib/subtitles/track-selection.ts";

test("does not automatically select an embedded track with unknown language", () => {
  const selected = pickDesiredSubtitleTrack(
    [{ id: "3", external: false, default: true, codec: "PGS" }],
    ["Arabic"],
    true,
  );
  assert.equal(selected, null);
});

test("known preferred embedded language still wins", () => {
  const arabic = { id: "4", external: false, lang: "ara", codec: "ASS" };
  const selected = pickDesiredSubtitleTrack(
    [{ id: "3", external: false, default: true, codec: "PGS" }, arabic],
    ["Arabic"],
    true,
  );
  assert.equal(selected, arabic);
});

test("unknown embedded tracks get distinct useful labels", () => {
  const track = { id: "3", external: false, codec: "HDMV_PGS_SUBTITLE" };
  assert.equal(subtitleTrackLanguageLabel(track), "Embedded");
  assert.equal(subtitleTrackTitle(track), "Embedded 3 · HDMV_PGS_SUBTITLE");
});

test("image subtitle detection accepts compact codecs and descriptive titles", () => {
  assert.equal(isImageSubTrack({ codec: "dvdsub" }), true);
  assert.equal(isImageSubTrack({ title: "English PGS" }), true);
});

test("ASS detection accepts descriptive labels", () => {
  assert.equal(isAssTrack({ label: "Embedded 2 · ASS" }), true);
});
