import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSizeBytes,
  syntheticFilename,
  toStreams,
} from "../src/lib/streams/plugins/adapter.ts";
import type { StreamPluginRequest } from "../src/lib/streams/plugins/types.ts";
import { parseStream } from "../src/lib/streams/parser/parser-stream.ts";
import { applyTrust } from "../src/lib/streams/trust.ts";

const movie: StreamPluginRequest = {
  type: "movie",
  id: "tt0133093",
  ids: ["tt0133093"],
  imdbId: "tt0133093",
  tmdb: { id: 603, kind: "movie" },
  title: "The Matrix",
  year: 1999,
  season: null,
  episode: null,
  absoluteEpisode: null,
  settings: {},
};

const series: StreamPluginRequest = {
  ...movie,
  type: "series",
  id: "tt0903747:1:2",
  ids: ["tt0903747:1:2"],
  imdbId: "tt0903747",
  tmdb: { id: 1396, kind: "tv" },
  title: "Breaking Bad",
  year: 2008,
  season: 1,
  episode: 2,
};

const ctx = (req: StreamPluginRequest) => ({
  req,
  addonId: "plugin:abc.example",
  addonName: "Example",
  addonUrl: "harbor-plugin://plugin:abc.example",
  pluginName: "Example",
});

test("provider labels get a parser line that survives the strict trust filter", () => {
  const streams = toStreams(
    [
      {
        name: "Provider",
        title: "Auto Quality Stream",
        url: "https://cdn.example.com/v.m3u8",
        quality: "1080p",
        size: "1.4 GB",
      },
    ],
    ctx(movie),
  );
  assert.equal(streams.length, 1);
  const s = streams[0];
  assert.equal(s.behaviorHints?.filename, "The Matrix (1999) 1080p");
  assert.equal(s.behaviorHints?.videoSize, Math.round(1.4 * 1024 ** 3));
  const parsed = parseStream(s);
  assert.equal(parsed.resolution, "1080p");
  const { keep, rejected } = applyTrust([parsed], {
    kind: "movie",
    expectedTitle: "The Matrix",
    expectedYear: 1999,
    strict: true,
  });
  assert.equal(rejected.length, 0, JSON.stringify(rejected.map((r) => r.reason)));
  assert.equal(keep.length, 1);
});

test("series requests carry the episode into the synthesized line", () => {
  assert.equal(syntheticFilename(series, "720p"), "Breaking Bad S01E02 720p");
  const [s] = toStreams([{ url: "https://cdn.example.com/e.mp4", quality: "HD" }], ctx(series));
  const parsed = parseStream(s);
  assert.equal(parsed.season, 1);
  assert.equal(parsed.episode, 2);
});

test("a plugin filename that already names the title is kept as is", () => {
  const [s] = toStreams(
    [{ url: "https://cdn.example.com/x.mkv", filename: "The.Matrix.1999.2160p.WEB-DL.x265.mkv" }],
    ctx(movie),
  );
  assert.equal(s.behaviorHints?.filename, "The.Matrix.1999.2160p.WEB-DL.x265.mkv");
});

test("provider headers are retained for the original server, unsafe headers are removed, and playback uses the proxy", () => {
  const [s] = toStreams(
    [
      {
        url: "https://cdn.example.com/v.m3u8",
        headers: {
          Referer: "https://cdn.example.com/",
          Origin: "https://evil.example.org",
          Cookie: "a=b",
          Range: "bytes=0-",
          "X-Secret": "nope",
          "X-Harbor-Auth": "must-not-pass",
          Host: "wrong.example",
          Connection: "keep-alive",
          "user-agent": "UA",
        },
      },
    ],
    ctx(movie),
  );
  assert.deepEqual(s.behaviorHints?.proxyHeaders?.request, {
    Referer: "https://cdn.example.com/",
    Cookie: "a=b",
    Range: "bytes=0-",
    "X-Secret": "nope",
    "User-Agent": "UA",
  });
  assert.equal(s.behaviorHints?.notWebReady, true);
});

test("unrelated public-suffix and hosted-tenant domains cannot supply stream origin headers", () => {
  for (const [host, other] of [
    ["cdn.alpha.co.uk", "beta.co.uk"],
    ["alpha.github.io", "beta.github.io"],
    ["alpha.pages.dev", "beta.pages.dev"],
  ]) {
    const [stream] = toStreams(
      [
        {
          url: `https://${host}/v.mp4`,
          headers: { Referer: `https://${other}/`, Origin: `https://${other}` },
        },
      ],
      ctx(movie),
    );
    assert.equal(stream.behaviorHints?.proxyHeaders, undefined);
  }
});

test("magnets become torrent streams and junk is dropped", () => {
  const hash = "0123456789abcdef0123456789abcdef01234567";
  const streams = toStreams(
    [
      { url: `magnet:?xt=urn:btih:${hash}&dn=x`, title: "Torrent" },
      { infoHash: hash.toUpperCase(), title: "Same" },
      { title: "no source at all" },
      { url: "http://127.0.0.1/private.m3u8" },
      { url: "ftp://example.com/x" },
      "not an object",
      { url: "https://ok.example.com/a.mp4", name: "[object Object]" },
    ],
    ctx(movie),
  );
  assert.equal(streams.length, 3);
  assert.equal(streams[0].infoHash, hash);
  assert.equal(streams[1].infoHash, hash);
  assert.equal(streams[2].name, "Example");
});

test("streams wrapped in an object and long lists are handled", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ url: `https://ok.example.com/${i}.mp4` }));
  assert.equal(toStreams({ streams: many }, ctx(movie)).length, 150);
  assert.equal(parseSizeBytes("700MB"), 700 * 1024 ** 2);
  assert.equal(parseSizeBytes("1,5 GB"), Math.round(1.5 * 1024 ** 3));
  assert.equal(parseSizeBytes(12345), 12345);
  assert.equal(parseSizeBytes("big"), undefined);
});
