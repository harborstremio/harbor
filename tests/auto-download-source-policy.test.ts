// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { prepareDownloadSourceCandidates } from "../src/lib/auto-download/source-policy.ts";
import type { ScoredStream } from "../src/lib/streams/types.ts";

function stream(overrides: Partial<ScoredStream> = {}): ScoredStream {
  return {
    addonId: "fixture",
    addonName: "Fixture",
    parsedTitle: "Example S01E01 1080p WEB-DL",
    episodeTitle: null,
    resolution: "1080p",
    hdrFormat: null,
    codec: "AVC",
    source: "WEB-DL",
    audio: { codec: "AAC", channels: 2 },
    audioLanguages: [],
    size: 800 * 1024 * 1024,
    seeders: null,
    cached: {},
    cacheVerified: {},
    inLibrary: {},
    container: "mkv",
    releaseGroup: null,
    releaseGroupNormalized: null,
    remux: false,
    edition: null,
    year: null,
    yearRange: null,
    season: 1,
    episode: 1,
    episodeEnd: null,
    seasonPack: false,
    discIndex: null,
    repackIteration: 0,
    proper: false,
    hardcoded: false,
    animeHash: null,
    scamScore: 0,
    score: 0,
    reasons: [],
    tier: "1080p",
    ...overrides,
  } as ScoredStream;
}

const policy = (
  overrides: Partial<Parameters<typeof prepareDownloadSourceCandidates>[1]> = {},
) => ({
  maxHeight: null,
  streamMode: "both",
  debrids: [],
  allowP2p: false,
  ...overrides,
});

test("direct addon media URLs can resolve without a debrid cache marker", () => {
  const direct = stream({ url: "https://cdn.example.test/episode.mkv?token=abc" });
  const result = prepareDownloadSourceCandidates([direct], policy());

  assert.deepEqual(result.ready, [direct]);
  assert.deepEqual(result.p2p, []);
});

test("web pages and uncached-marked URLs are not treated as ready downloads", () => {
  const page = stream({ url: "https://provider.example/watch/episode" });
  const uncached = stream({
    name: "[RD download] Episode",
    url: "https://cdn.example.test/episode.mkv",
    infoHash: "0123456789abcdef0123456789abcdef01234567",
  });
  const result = prepareDownloadSourceCandidates([page, uncached], policy({ allowP2p: true }));

  assert.deepEqual(result.ready, []);
  assert.deepEqual(result.p2p, [uncached]);
});

test("candidate order is preserved, with the saved height and P2P preferences applied", () => {
  const first = stream({ addonId: "first", url: "https://cdn.example/first.mkv", score: 1 });
  const tooTall = stream({
    addonId: "too-tall",
    url: "https://cdn.example/4k.mkv",
    resolution: "4K",
  });
  const torrent = stream({
    addonId: "torrent",
    infoHash: "0123456789abcdef0123456789abcdef01234567",
  });
  const last = stream({ addonId: "last", url: "https://cdn.example/last.mkv", score: 100 });

  const noP2p = prepareDownloadSourceCandidates(
    [first, tooTall, torrent, last],
    policy({ maxHeight: 1080 }),
  );
  assert.deepEqual(noP2p.ready, [first, last]);
  assert.deepEqual(noP2p.p2p, []);

  const withP2p = prepareDownloadSourceCandidates(
    [first, tooTall, torrent, last],
    policy({
      maxHeight: 1080,
      allowP2p: true,
    }),
  );
  assert.deepEqual(withP2p.ready, [first, last]);
  assert.deepEqual(withP2p.p2p, [torrent]);
});

test("addons mode follows playback and hides torrents when direct addon media exists", () => {
  const direct = stream({ url: "https://cdn.example/episode.mp4" });
  const torrent = stream({ infoHash: "0123456789abcdef0123456789abcdef01234567" });
  const result = prepareDownloadSourceCandidates(
    [torrent, direct],
    policy({
      streamMode: "addons",
      allowP2p: true,
    }),
  );

  assert.deepEqual(result.ready, [direct]);
  assert.deepEqual(result.p2p, []);
});
