// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { downloadPlayerSrc } from "../src/lib/download/player-src.ts";
import { localPlayerSrc } from "../src/lib/local-library/player-src.ts";
import { subtitleStreamDescriptor } from "../src/lib/subtitles/provider-label.ts";

test("local and downloaded playback carry the exact filename into subtitle search", () => {
  const local = localPlayerSrc({
    id: "local-1",
    path: "D:\\Shows\\Show.S01E03.BluRay.mkv",
    filename: "Show.S01E03.BluRay.mkv",
    title: "Show",
    year: 2025,
    type: "show",
    season: 1,
    episode: 3,
    subtitlePaths: ["D:\\Shows\\Show.S01E03.BluRay.ar.srt"],
    addedAt: 1,
  });
  assert.equal(subtitleStreamDescriptor(local.streamRef), "Show.S01E03.BluRay.mkv");
  assert.deepEqual(local.subtitles, [
    {
      url: "D:\\Shows\\Show.S01E03.BluRay.ar.srt",
      lang: "ar",
      trustedSource: true,
    },
  ]);

  const downloaded = downloadPlayerSrc(
    { id: "tt1234567", type: "series", name: "Show" },
    { season: 1, episode: 3 },
    {
      id: "download-1",
      path: "D:\\Downloads\\Show.S01E03.WEB-DL.mkv",
      title: "Show",
      status: "done",
      startedAt: 1,
    },
  );
  assert.equal(subtitleStreamDescriptor(downloaded.streamRef), "Show.S01E03.WEB-DL.mkv");
});

test("debrid playback retains the resolver-selected episode filename", () => {
  const picker = readFileSync(
    new URL("../src/views/play-picker/use-pick-handler.ts", import.meta.url),
    "utf8",
  );
  const episodePanel = readFileSync(
    new URL("../src/components/player/episode-panel/index.tsx", import.meta.url),
    "utf8",
  );
  const streamSwitcher = readFileSync(
    new URL("../src/views/player/hooks/use-stream-switcher.ts", import.meta.url),
    "utf8",
  );

  assert.match(picker, /resolvedFilename:\s*[\s\S]{0,100}r\.data\.filename/);
  assert.match(episodePanel, /resolvedFilename:\s*[\s\S]{0,100}r\.data\.filename/);
  assert.match(streamSwitcher, /resolvedFilename:\s*[\s\S]{0,100}r\.data\.filename/);
  assert.match(streamSwitcher, /fileIdx:\s*r\.data\.fileIdx\s*\?\?\s*stream\.fileIdx/);
});
