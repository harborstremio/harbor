import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, dependencies, globals = {}) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", ...Object.keys(globals), compiled)(
    (id) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const drain = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const stream = (hash) => ({ infoHash: hash, addonId: "fixture", addonName: "Fixture" });

function harness({ anime = false, deferredParse = false } = {}) {
  const addons = deferred(),
    listings = deferred(),
    checks = [],
    parses = [],
    partials = [];
  let onBatch,
    now = 10000,
    timerId = 0,
    listingCalls = 0;
  const timers = new Map();
  const provider = {
    slug: "rd",
    name: "Fixture debrid",
    listLibrary: () => {
      listingCalls++;
      return listings.promise;
    },
    cacheCheck: (hashes) => {
      const d = deferred();
      checks.push({ hashes, ...d });
      return d.promise;
    },
  };
  const library = load("src/lib/streams/library.ts", {
    "parse-torrent-title": { parse: (name) => ({ title: name }) },
  });
  const api = load(
    "src/lib/streams/pipeline.ts",
    {
      "@/lib/debug": { dlog() {} },
      "./addons": {
        fetchAddonStreams: (_a, _r, _s, batch) => {
          onBatch = batch;
          return addons.promise;
        },
      },
      "./priority-partition": { applyStreamPriority: (picker) => picker },
      "./anitomy": {
        enhanceAnimeStreams: async () => {
          if (deferredParse) {
            const d = deferred();
            parses.push(d);
            await d.promise;
          }
        },
      },
      "./anime-identity-core": {
        partitionByExactAnimeEpisode: (streams) => ({ keep: streams, drop: [] }),
      },
      "./library": library,
      "./parser": { parseStream: (s) => ({ ...s, cached: {}, inLibrary: {}, cacheVerified: {} }) },
      "./trust": { applyTrust: (streams) => ({ keep: streams, rejected: [] }) },
      "./scoring": {
        computeCorpusStats() {},
        scoreStream: (s) => s,
        rankAndPick: (all) => ({ all }),
      },
    },
    {
      performance: { now: () => now },
      window: {
        setTimeout: (fn, delay) => {
          timers.set(++timerId, { fn, at: now + delay });
          return timerId;
        },
        clearTimeout: (id) => timers.delete(id),
      },
    },
  );
  const controller = new AbortController();
  const result = api.runPipeline(
    {
      request: { type: "movie", ids: ["tt1"] },
      query: { type: "movie", title: "Fixture", imdbId: "tt1" },
      addons: [],
      debrids: [provider],
      score: { activeDebrids: ["rd"] },
      isAnime: anime,
      animeAbsoluteEpisode: anime ? 1 : undefined,
    },
    controller.signal,
    (p) => partials.push(p),
  );
  return {
    addons,
    listings,
    checks,
    parses,
    partials,
    timers,
    result,
    controller,
    get listingCalls() {
      return listingCalls;
    },
    batch: (hashes) => onBatch(hashes.map(stream)),
    finish: (hashes) => addons.resolve(hashes.map(stream)),
    tick: async (ms = 0) => {
      now += ms;
      for (const [id, timer] of timers)
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      await drain();
    },
  };
}

test("incremental verification is serialized and the final flush checks only new hashes", async () => {
  const h = harness();
  h.listings.resolve({ ok: true, data: [] });
  h.batch(["A"]);
  await h.tick();
  assert.deepEqual(
    h.checks.map((c) => c.hashes),
    [["a"]],
  );
  h.batch(["A", "B"]);
  await h.tick(2000);
  assert.equal(h.checks.length, 1, "new batches cannot overlap an active check");
  h.finish(["A", "B"]);
  await drain();
  let finalized = false;
  h.result.then(() => {
    finalized = true;
  });
  assert.equal(finalized, false);
  h.checks[0].resolve({ ok: true, data: { a: true } });
  await drain();
  assert.deepEqual(
    h.checks.map((c) => c.hashes),
    [["a"], ["b"]],
  );
  h.checks[1].resolve({ ok: true, data: { b: true } });
  const final = await h.result;
  assert.ok(final.picker.all.every((s) => s.cached.rd && s.cacheVerified.rd));
  assert.equal(h.listingCalls, 1);
  assert.equal(h.timers.size, 0);
  const count = h.partials.length;
  await h.tick(3000);
  assert.equal(h.partials.length, count);
});

test("library badges reach partials before slow add-ons and reuse the listing sweep", async () => {
  const h = harness();
  h.batch(["A"]);
  h.listings.resolve({ ok: true, data: [{ hash: "a", name: "Fixture", id: "one" }] });
  await drain();
  assert.ok(
    h.partials.at(-1).picker.all.find((s) => s.infoHash.toLowerCase() === "a").inLibrary.rd,
  );
  assert.equal(h.listingCalls, 1);
  h.finish(["A"]);
  await drain();
  h.checks[0].resolve({ ok: true, data: {} });
  assert.equal((await h.result).picker.all[0].inLibrary.rd, true);
});

test("an older asynchronous anime partial cannot overwrite a newer one or the final result", async () => {
  const h = harness({ anime: true, deferredParse: true });
  h.listings.resolve({ ok: true, data: [] });
  await drain();
  h.batch(["A"]);
  await drain();
  h.batch(["A", "B"]);
  await h.tick(300);
  h.checks[0].resolve({ ok: true, data: {} });
  await drain();
  const newest = h.parses.at(-1);
  newest.resolve();
  await drain();
  assert.equal(h.partials.at(-1).picker.all.length, 2);
  const count = h.partials.length;
  for (const p of h.parses.slice(0, -1)) p.resolve();
  await drain();
  assert.equal(h.partials.length, count);
  // Leave a fresh partial pending across finalization.
  h.batch(["A", "B", "C"]);
  await h.tick(300);
  const stale = h.parses.at(-1);
  h.finish(["A", "B", "C"]);
  await drain();
  h.checks.at(-1).resolve({ ok: true, data: {} });
  await drain();
  const finalParse = h.parses.at(-1);
  assert.notEqual(finalParse, stale);
  finalParse.resolve();
  await h.result;
  stale.resolve();
  await drain();
  assert.equal(h.partials.length, count);
});

test("failed incremental checks retry at completion without losing provider errors", async () => {
  const h = harness();
  h.batch(["A"]);
  await h.tick();
  h.checks[0].resolve({ ok: false, code: "offline" });
  h.listings.resolve({ ok: false, code: "expired" });
  await drain();
  h.finish(["A"]);
  await drain();
  assert.deepEqual(h.checks[1].hashes, ["a"]);
  h.checks[1].resolve({ ok: true, data: { a: true } });
  const final = await h.result;
  assert.equal(final.debridErrors[0].code, "expired");
  assert.equal(final.picker.all[0].cached.rd, true);
});

test("abort cancels queued verification and prevents late partials", async () => {
  const h = harness({ anime: true, deferredParse: true });
  h.batch(["A"]);
  h.controller.abort();
  await h.tick(3000);
  assert.equal(h.checks.length, 0);
  assert.equal(h.timers.size, 0);
  h.listings.resolve({ ok: true, data: [] });
  h.finish(["A"]);
  await drain();
  for (const p of h.parses) p.resolve();
  await h.result;
  assert.equal(h.partials.length, 0);
});
