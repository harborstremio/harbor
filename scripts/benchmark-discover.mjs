import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function readSource(file, baseline = false) {
  return baseline
    ? execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" })
    : readFileSync(file, "utf8");
}

export function loadModule(source, imports = {}, globals = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (!(name in imports)) throw new Error(`Unmocked import: ${name}`);
    return imports[name];
  };
  new Function("require", "module", "exports", ...Object.keys(globals), output)(
    require,
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}

export function catalogModule() {
  return loadModule(readSource("src/lib/providers/tmdb/tmdb-catalog-cache.ts"), {
    "@/lib/cache": loadModule(readSource("src/lib/cache.ts")),
  });
}

export function clientFixture({ baseline = false, latency = 0, fetch } = {}) {
  let requests = 0;
  const client = loadModule(readSource("src/lib/providers/tmdb/tmdb-client.ts", baseline), {
    "@/lib/safe-fetch": {
      safeFetch: async (...args) => {
        requests++;
        if (latency) await new Promise((resolve) => setTimeout(resolve, latency));
        return fetch ? fetch(...args) : Response.json({ results: [{ id: 1, title: "Fixture" }] });
      },
    },
    "@/lib/request-scheduler": loadModule(readSource("src/lib/request-scheduler.ts")),
    "./tmdb-catalog-cache": catalogModule(),
  });
  return { client, requests: () => requests };
}

export function railFixture(source, active = true) {
  const requests = [];
  const states = [];
  const effects = [];
  let cursor = 0;
  let effectCursor = 0;
  let observer;
  let props = {
    active,
    railId: "fixture",
    allRails: [{ id: "fixture", shelf: { title: "Fixture" }, fetch: async () => [] }],
    deduped: {},
    ensureLoaded: (id) => requests.push(id),
    loadMore: () => requests.push("more"),
  };
  const root = {};
  const { Rail } = loadModule(
    source,
    {
      react: {
        useContext: () => root,
        useRef: () => ({ current: {} }),
        useState: (initial) => {
          const id = cursor++;
          if (!(id in states)) states[id] = initial;
          return [
            states[id],
            (value) => {
              states[id] = value;
            },
          ];
        },
        useEffect: (fn, deps) => {
          const id = effectCursor++;
          if (!effects[id] || deps.some((value, index) => value !== effects[id].deps[index])) {
            effects[id]?.cleanup?.();
            effects[id] = { deps, cleanup: fn() };
          }
        },
      },
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "@/components/feed-shelf": { FeedShelf: "FeedShelf" },
      "@/components/row": { ScrollRootContext: {} },
      "@/lib/i18n": { useT: () => (text) => text },
      "@/lib/view": { useView: () => ({ openGrid: () => {} }) },
    },
    {
      IntersectionObserver: class {
        constructor(callback, options) {
          observer = { callback, options };
        }
        observe() {}
        disconnect() {}
      },
      window: { setTimeout: () => 1 },
      clearTimeout: () => {},
    },
  );
  const render = (changes = {}) => {
    props = { ...props, ...changes };
    cursor = 0;
    effectCursor = 0;
    return Rail(props);
  };
  render();
  return {
    requests,
    render,
    intersect: (isIntersecting) => {
      observer?.callback([{ isIntersecting }]);
      render();
    },
    options: () => observer?.options,
    cleanup: () => effects.forEach((effect) => effect.cleanup?.()),
  };
}

export function featuredEffect(source) {
  const ast = ts.createSourceFile(
    "discover.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let result;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === "useEffect" &&
      node.arguments[0]?.getText(ast).includes("buildFeaturedFast(")
    )
      result = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!result) throw new Error("Featured effect not found");
  return ts.transpile(`const effect = ${result}`, { target: ts.ScriptTarget.ES2022 });
}

export async function measureFeatured(
  source,
  { fastFails = false, fullFails = false, cancelAt = Infinity, historyMs = 200 } = {},
) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const events = [];
  let feat = { featured: [], reserve: [], pool: [] };
  let ready = false;
  let firstContentMs = null;
  const timer = (fn, ms) => {
    const id = ++nextId;
    timers.set(id, { at: now + ms, fn });
    return id;
  };
  const result = (id) => ({ featured: [{ id }], reserve: [], pool: [{ id }] });
  const request = (id, ms, fails) =>
    new Promise((resolve, reject) => {
      events.push({ at: now, type: `${id}:start` });
      timer(() => (fails ? reject(new Error("fixture failure")) : resolve(result(id))), ms);
    });
  const record = () => {
    events.push({ at: now, type: "state", ready, items: feat.featured.length });
    if (ready && feat.featured.length && firstContentMs === null) firstContentMs = now;
  };
  const deps = {
    settings: { tmdbKey: "fixture-key" },
    buildFeaturedFast: () => request("fast", 600, fastFails),
    buildFeatured: () => request("full", 10000, fullFails),
    prewarmExternalWatched: () => new Promise((resolve) => timer(resolve, historyMs)),
    rescoreFeatured: (pool) => ({ featured: pool, reserve: [], pool }),
    setFeat: (value) => {
      feat = typeof value === "function" ? value(feat) : value;
      record();
    },
    setFeatReady: (value) => {
      ready = value;
      record();
    },
    window: { setTimeout: timer },
    clearTimeout: (id) => timers.delete(id),
  };
  const cleanup = new Function(...Object.keys(deps), `${featuredEffect(source)}; return effect();`)(
    ...Object.values(deps),
  );
  if (Number.isFinite(cancelAt)) timer(cleanup, cancelAt);
  for (let count = 0; count < 100; count++) {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].fn();
  }
  cleanup();
  return { firstContentMs, ready, events };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseline = process.argv.includes("--baseline");
  const source = readSource("src/views/discover.tsx", baseline);
  const samples = [];
  for (let i = 0; i < 20; i++) samples.push((await measureFeatured(source)).firstContentMs);
  const rails = Array.from({ length: 14 }, () =>
    railFixture(readSource("src/views/discover/discover-rail.tsx", baseline)),
  );
  const mountedRowRequests = rails.reduce((sum, rail) => sum + rail.requests.length, 0);
  rails.slice(0, 2).forEach((rail) => rail.intersect(true));
  const nearRowRequests = rails.reduce((sum, rail) => sum + rail.requests.length, 0);
  rails.forEach((rail) => rail.cleanup());
  const cacheRuns = [];
  for (let run = 0; run < 5; run++) {
    const fixture = clientFixture({ baseline, latency: 10 });
    const start = performance.now();
    for (let i = 0; i < 20; i++)
      await fixture.client.get("fixture-key", "discover/movie", { page: "1" });
    cacheRuns.push({
      requests: fixture.requests(),
      elapsedMs: Math.round(performance.now() - start),
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: baseline ? "HEAD baseline" : "working tree",
        methodology:
          "Actual Discover effect, virtual clock; fast result 600ms, history 200ms, full result 10000ms. Synthetic scheduling benchmark, not live network or paint timing.",
        runs: samples.length,
        firstUsableBannerMs: {
          min: Math.min(...samples),
          median: samples[10],
          max: Math.max(...samples),
        },
        fullFailure: (await measureFeatured(source, { fullFails: true })).firstContentMs,
        railInitialFetches: {
          mountedRowRequests,
          afterTwoRowsApproach: nearRowRequests,
          note: "Rail components only; excludes two Discover dedup anchors and special sections.",
        },
        repeatedCatalog: {
          methodology:
            "Actual TMDB client and scheduler; 20 sequential identical public catalog reads, stub HTTP 10ms delay, 5 fresh-client runs.",
          cacheRuns,
        },
      },
      null,
      2,
    ),
  );
}
