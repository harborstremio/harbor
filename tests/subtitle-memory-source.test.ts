// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  rememberedSubAppliesToStream,
  subtitleStreamKey,
} from "../src/lib/subtitles/subtitle-memory.ts";

test("the same torrent release shares a subtitle key across providers", () => {
  const a = subtitleStreamKey({ infoHash: "ABC123", fileIdx: 4, addonId: "provider-a" });
  const b = subtitleStreamKey({ infoHash: "abc123", fileIdx: 4, addonId: "provider-b" });

  assert.equal(a, b);
});

test("different releases receive different subtitle keys", () => {
  const a = subtitleStreamKey({ parsedTitle: "Movie.2024.BluRay.REMUX-GROUP" });
  const b = subtitleStreamKey({ parsedTitle: "Movie.2024.WEB-DL-GROUP" });

  assert.notEqual(a, b);
});

test("subtitle keys never contain a playable URL", () => {
  const key = subtitleStreamKey({
    addonId: "addon",
    parsedTitle: "Movie.2024.1080p.WEB-DL-GROUP",
    source: "webdl",
  });

  assert.ok(key);
  assert.doesNotMatch(key, /https?:|token|signature/i);
});

test("a remembered external subtitle is not restored onto another release", () => {
  const first = { infoHash: "first", fileIdx: 0 };
  const second = { infoHash: "second", fileIdx: 0 };
  const remembered = {
    source: "downloaded-subtitle.srt",
    streamKey: subtitleStreamKey(first),
    updatedAt: 1,
  };

  assert.equal(rememberedSubAppliesToStream(remembered, first), true);
  assert.equal(rememberedSubAppliesToStream(remembered, second), false);
});

test("legacy external choices do not override an identifiable current release", () => {
  const remembered = { source: "downloaded-subtitle.srt", updatedAt: 1 };

  assert.equal(
    rememberedSubAppliesToStream(remembered, { infoHash: "current", fileIdx: 0 }),
    false,
  );
});

test("remembered external subtitles remain authoritative until selection is observed", () => {
  const autoload = readFileSync(
    new URL("../src/views/player/hooks/use-track-autoload.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    autoload,
    /if \(existing\.selected\) \{[\s\S]*subRestoreSelectRef\.current = null/,
    "restoration must complete only after the remembered track is visibly selected",
  );
  assert.match(
    autoload,
    /attempts < 4 && elapsed >= 750[\s\S]*bridge\.setSubtitleTrack\(existing\.id\)/,
    "a track-list race must retry the remembered selection with a bound",
  );
  assert.match(
    autoload,
    /scheduleRestoreCheck\(12_000 - waited \+ 1\)/,
    "the direct-source fallback must run even when no later track event rerenders the player",
  );
});
