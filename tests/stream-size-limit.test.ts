// @ts-nocheck Node-only regression harness is outside the browser tsconfig.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  filterStreamsBySize,
  normalizeStreamSizeLimit,
  streamSizeAllowed,
} from "../src/lib/streams/size-limit.ts";

const GB = 1024 ** 3;

function load(file, modules, globals = {}) {
  const source = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), "utf8");
  const exports = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in modules, `Unexpected dependency: ${name}`);
        return modules[name];
      },
      performance,
      AbortController,
      setTimeout,
      clearTimeout,
      ...globals,
    },
  );
  return exports;
}

test("10 GB cap excludes 75 GB, keeps its boundary, and explicitly allows unknown sizes", () => {
  assert.equal(streamSizeAllowed(75 * GB, 10), false);
  assert.equal(streamSizeAllowed(10 * GB, 10), true);
  assert.equal(streamSizeAllowed(10 * GB + 1, 10), false);
  assert.equal(streamSizeAllowed(null, 10), true);
  assert.equal(streamSizeAllowed(75 * GB, 0), true);
  assert.equal(normalizeStreamSizeLimit(-10), 0);
  assert.equal(normalizeStreamSizeLimit(Infinity), 0);
});

test("changing the global cap invalidates picker cache keys", () => {
  const { buildPickerConfigHash } = load(
    "picker-cache.ts",
    {
      "./cache": { lruSet() {} },
      "./maintenance": { registerEvictable() {} },
    },
    { localStorage: { length: 0 } },
  );
  const config = { addonTransportUrls: [], debridSlugs: [], scraperKeys: [], filterMode: "off" };
  assert.notEqual(
    buildPickerConfigHash({ ...config, maxStreamSizeGb: 10 }),
    buildPickerConfigHash({ ...config, maxStreamSizeGb: 75 }),
  );
  assert.notEqual(
    buildPickerConfigHash({ ...config, maxStreamSizeGb: 10 }),
    buildPickerConfigHash(config),
  );
});

test("actual pipeline excludes large addon and library streams from partial and final results with safety off", async () => {
  const modules = {
    "@/lib/debug": { dlog() {} },
    "./size-limit": { filterStreamsBySize },
    "./addons": {
      async fetchAddonStreams(_addons, _request, _signal, progress) {
        const streams = [
          { infoHash: "large", size: 75 * GB },
          { infoHash: "small", size: 8 * GB },
        ];
        progress(streams);
        return streams;
      },
    },
    "./library": {
      async fetchLibraryStreams() {
        return [{ url: "https://example.org/large", size: 75 * GB }];
      },
    },
    "./parser": { parseStream: (stream) => ({ ...stream, cached: {}, inLibrary: {} }) },
    "./anitomy": { async enhanceAnimeStreams() {} },
    "./trust": { applyTrust: (streams) => ({ keep: streams, rejected: [] }) },
    "./scoring": {
      computeCorpusStats() {},
      scoreStream: (stream) => stream,
      rankAndPick: (streams) => ({ primary: streams[0] ?? null, all: streams, byTier: {} }),
    },
  };
  const { runPipeline } = load("streams/pipeline.ts", modules, {
    performance: { now: () => 1000 },
  });
  const partials = [];
  const result = await runPipeline(
    {
      addons: [],
      debrids: [],
      request: {},
      query: {},
      trust: { disabled: true },
      score: { activeDebrids: [] },
      maxStreamSizeGb: 10,
    },
    new AbortController().signal,
    (partial) => partials.push(partial),
  );
  assert.equal(partials.length, 1);
  for (const state of [...partials, result]) {
    assert.equal(state.picker.all.length, 1);
    assert.equal(state.picker.primary.infoHash, "small");
  }
});

function resolverHarness(actualSize = 75 * GB) {
  const effects = { add: 0, select: 0, remove: 0, download: 0, provider: 0 };
  const modules = {
    "./size-limit": { streamSizeAllowed, readStreamSizeLimit: () => 10 },
    "@/lib/safe-fetch": {
      safeFetch: async () => ({
        ok: true,
        headers: new Headers({ "content-length": String(actualSize) }),
      }),
    },
    "@/lib/debug": { dwarn() {} },
    "./cached": { hasUncachedMarker: () => false },
    "@/lib/debrid/types": { magnetFromHash: (hash) => hash },
    "@/lib/torrent/local-engine": {
      lastEngineAddError: () => null,
      async torrentEngineAdd() {
        effects.add++;
        return {
          info_hash: "test",
          stream_base: "http://localhost",
          files: [{ idx: 0, name: "movie.mkv", length: actualSize }],
        };
      },
      async torrentEngineSelect() {
        effects.select++;
      },
      async torrentEngineRemove() {
        effects.remove++;
      },
    },
    "@/lib/torrent/full-download": {
      fullDownloadEnabled: () => true,
      startFullDownload() {
        effects.download++;
      },
    },
    "@/lib/torrent/stremio-stream": {
      directTorrentEnabled: () => true,
      engineP2pEligible: () => true,
      isVideoFile: () => true,
      localTorrentAllowed: () => true,
      trackersFromSources: () => [],
    },
    "./episode-file": { matchEpisodeFileIndex: () => -1 },
  };
  const api = load("streams/resolve.ts", modules);
  const provider = {
    slug: "rd",
    async playableUrl() {
      effects.provider++;
      return { ok: true, data: { url: "https://example.org/movie", filesize: actualSize } };
    },
  };
  const stream = {
    infoHash: "test",
    size: null,
    cached: { rd: true },
    inLibrary: {},
    behaviorHints: {},
  };
  return { ...api, provider, stream, effects, signal: new AbortController().signal };
}

test("remembered oversized streams fail before provider or torrent resolution", async () => {
  const h = resolverHarness();
  const result = await h.resolveStream(
    { ...h.stream, size: 75 * GB },
    [h.provider],
    h.signal,
    true,
  );
  assert.equal(result.code, "stream-size-limit");
  assert.equal(h.effects.provider, 0);
  assert.equal(h.effects.add, 0);
  assert.equal(h.effects.download, 0);
});

test("debrid actual size and failover cannot start an oversized full download", async () => {
  const h = resolverHarness();
  assert.equal((await h.resolveStream(h.stream, [h.provider], h.signal)).code, "stream-size-limit");
  assert.equal(
    (await h.resolveViaDebrids("test", undefined, { rd: true }, [h.provider], h.signal)).code,
    "stream-size-limit",
  );
  assert.equal(h.effects.download, 0);
});

test("unknown torrent sizes are checked before file selection or full downloading", async () => {
  const h = resolverHarness();
  assert.equal((await h.resolveStream(h.stream, [], h.signal)).code, "stream-size-limit");
  assert.equal(h.effects.select, 0);
  assert.equal(h.effects.remove, 1);
  assert.equal(h.effects.download, 0);
});

test("eligible P2P and debrid files still resolve and start configured full downloads", async () => {
  const h = resolverHarness(8 * GB);
  assert.equal((await h.resolveStream(h.stream, [], h.signal)).ok, true);
  assert.equal((await h.resolveStream(h.stream, [h.provider], h.signal)).ok, true);
  assert.equal(h.effects.select, 1);
  assert.equal(h.effects.download, 2);
});

test("HTTP size discovered during debrid validation also enforces the cap", async () => {
  const h = resolverHarness();
  h.provider.playableUrl = async () => ({ ok: true, data: { url: "https://example.org/movie" } });
  assert.equal((await h.resolveStream(h.stream, [h.provider], h.signal)).code, "stream-size-limit");
  assert.equal(h.effects.download, 0);
});

test("full-download response size stops reading even when metadata omitted size", async () => {
  let read = 0;
  let cancel = 0;
  const { startFullDownload } = load(
    "torrent/full-download.ts",
    {
      "../streams/size-limit": { streamSizeAllowed, readStreamSizeLimit: () => 10 },
    },
    {
      fetch: async () => ({
        headers: new Headers({
          "content-range": `bytes 0-1023/${75 * GB}`,
          "content-length": "1024",
        }),
        body: {
          async cancel() {
            cancel++;
          },
          getReader() {
            read++;
          },
        },
      }),
    },
  );
  startFullDownload("test", "https://example.org/movie");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancel, 1);
  assert.equal(read, 0);
});
