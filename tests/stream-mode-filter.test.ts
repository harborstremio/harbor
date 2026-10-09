import assert from "node:assert/strict";
import test from "node:test";
import {
  filterStreamsByMode,
  hasDirectMediaEvidence,
  hasVideoFileExtension,
} from "../src/lib/streams/mode.ts";

const hash = "0123456789abcdef0123456789abcdef01234567";

test("both mode preserves every result in its original order", () => {
  const streams = [{ url: "https://example.test/movie.mp4" }, { infoHash: hash }];

  assert.deepEqual(filterStreamsByMode(streams, "both"), streams);
});

test("unknown imported mode values fall back to showing every result", () => {
  const streams = [{ url: "https://example.test/movie.mp4" }, { infoHash: hash }];

  assert.deepEqual(filterStreamsByMode(streams, "future-mode"), streams);
  assert.deepEqual(filterStreamsByMode(streams, null), streams);
});

test("P2P mode prefers torrents and falls back to all results when none exist", () => {
  const direct = { url: "https://example.test/movie.mp4" };
  const torrent = { infoHash: hash };

  assert.deepEqual(filterStreamsByMode([direct, torrent], "p2p"), [torrent]);
  assert.deepEqual(filterStreamsByMode([direct], "p2p"), [direct]);
});

test("addons mode does not let web and external rows suppress torrents", () => {
  const webPage = { url: "https://example.test/watch/123" };
  const external = { externalUrl: "https://service.example/title/123" };
  const youtube = { ytId: "video-id" };
  const nzb = { nzbUrl: "https://usenet.example/file.nzb" };
  const torrent = { infoHash: hash };
  const streams = [webPage, external, youtube, nzb, torrent];

  assert.deepEqual(filterStreamsByMode(streams, "addons"), streams);
});

test("addons mode filters P2P only after finding a playable non-P2P candidate", () => {
  const external = { externalUrl: "https://service.example/title/123" };
  const webPage = { url: "https://example.test/watch/123" };
  const direct = { url: "https://cdn.example.test/movie.MKV?token=abc" };
  const torrent = { infoHash: hash };

  assert.deepEqual(filterStreamsByMode([external, torrent, direct, webPage], "addons"), [
    external,
    direct,
    webPage,
  ]);
});

test("direct media evidence recognizes supported playback signals", () => {
  const candidates = [
    { url: "https://cdn.example.test/movie.mp4" },
    { url: "https://cdn.example.test/play", behaviorHints: { filename: "Movie.webm" } },
    { url: "https://cdn.example.test/play", behaviorHints: { fileName: "Movie.m3u8" } },
    { url: "https://cdn.example.test/play", behaviorHints: { videoSize: 1 } },
    { url: "https://cdn.example.test/play", behaviorHints: { notWebReady: true } },
    {
      url: "https://cdn.example.test/play",
      behaviorHints: { proxyHeaders: { request: { Authorization: "token" } } },
    },
    {
      url: "https://cdn.example.test/play",
      behaviorHints: { headers: { Referer: "https://provider.example" } },
    },
    { url: "C:\\Videos\\Movie.mkv" },
    { url: "/mnt/media/Movie" },
    { infoHash: hash, cached: { rd: true } },
    { infoHash: hash, name: "[RD+] Movie" },
  ];

  for (const candidate of candidates) {
    assert.equal(hasDirectMediaEvidence(candidate), true, JSON.stringify(candidate));
  }
});

test("external-only and unverified webpage-like results are not direct media evidence", () => {
  const candidates = [
    { url: "https://example.test/watch/123" },
    { url: "http://example.test/play" },
    { url: "//example.test/watch/123" },
    { url: "#" },
    { externalUrl: "https://service.example/title/123" },
    { ytId: "video-id" },
    { nzbUrl: "https://usenet.example/file.nzb" },
    { infoHash: hash },
    { url: "https://example.test/play", behaviorHints: { videoSize: 0 } },
    { url: "https://example.test/play", behaviorHints: { proxyHeaders: {} } },
  ];

  for (const candidate of candidates) {
    assert.equal(hasDirectMediaEvidence(candidate), false, JSON.stringify(candidate));
  }
});

test("video extension detection accepts query/hash suffixes but rejects webpage paths", () => {
  assert.equal(hasVideoFileExtension("Movie.MP4?token=abc"), true);
  assert.equal(hasVideoFileExtension("https://cdn.example/movie.m3u8#quality"), true);
  assert.equal(hasVideoFileExtension("https://example.test/movie.mp4/details"), false);
  assert.equal(hasVideoFileExtension("https://example.test/watch/123"), false);
  assert.equal(hasVideoFileExtension(undefined), false);
});
