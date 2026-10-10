// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";
import { isNaturalEnd } from "../src/lib/player/playback-end.ts";
import type { Meta } from "../src/lib/cinemeta.ts";
import type { PlayEpisode } from "../src/lib/view.tsx";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function load(path: string, mocks: Record<string, unknown>, expose = ""): any {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled + expose)((id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}

function pureFunction(path: string, name: string): any {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = source.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name);
  assert.ok(fn, `${name} must exist`);
  const compiled = ts.transpileModule(fn!.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: Record<string, any> = {};
  new Function("exports", compiled)(exports);
  return exports[name];
}

const isNextAired = pureFunction("src/lib/cw-resurface.ts", "isNextAired");
const isAddonNativeMeta = pureFunction("src/lib/cinemeta.ts", "isAddonNativeMeta");

// Use the player's actual derived value so this also covers its connection to autoplay.
const playerSource = ts.createSourceFile("player.tsx", read("src/views/player.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let gate = "";
function findGate(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(playerSource) === "airedNext") {
    gate = node.initializer!.getText(playerSource);
  }
  ts.forEachChild(node, findGate);
}
findGate(playerSource);
assert.ok(gate);
const airedNext = new Function("adjacent", "isNextAired", `return ${gate};`);

function autoAdvances(next: PlayEpisode | null): PlayEpisode[] {
  const played: PlayEpisode[] = [];
  const { useAutoNextEpisode } = load("src/views/player/hooks/use-auto-next-episode.ts", {
    react: { useRef: (current: unknown) => ({ current }), useEffect: (fn: () => void) => fn() },
    "@/lib/player/playback-clock": { getPlaybackPosition: () => 1800 },
    "@/lib/player/playback-end": { isNaturalEnd },
  });
  useAutoNextEpisode({
    src: { url: "fixture://episode-one" },
    snap: { status: "ended", durationSec: 1800, errorCode: null },
    nextEp: airedNext({ next }, isNextAired),
    canChangeEpisode: true, cancelled: false, startedNearEndRef: { current: false },
    goToEpisode: (ep: PlayEpisode) => played.push(ep),
  });
  return played;
}

function series(videos: Meta["videos"]) {
  let requests = 0;
  const deps: Record<string, unknown> = {
    "@/lib/cache": { lruSet: (map: Map<unknown, unknown>, key: unknown, value: unknown) => map.set(key, value) },
    "@/lib/memory-profiler": { registerCache() {} },
    "@/lib/safe-fetch": { safeFetch: async () => { requests++; return { ok: true, json: async () => ({ meta: { videos } }) }; } },
    "./meta-resource": { resolveMeta: async () => { requests++; return { videos }; }, preferCustomMeta: () => false },
    "./providers/tmdb": {}, "./providers/tmdb/tmdb-client": {}, "./providers/tmdb/tmdb-image-rungs": {},
    "./localized-text": {}, "./providers/anime-kitsu-addon": {}, "./providers/anime-mapping": {},
    "./providers/kitsu": {}, "./providers/anizip": {}, "./providers/tvdb-proxy": {},
    "./providers/anime-franchise-root": {}, "./streams/anime-identity": {},
  };
  return { module: load("src/lib/series-episodes.ts", deps), requests: () => requests };
}

function nativeAdjacent(meta: Meta): { prev: PlayEpisode | null; next: PlayEpisode | null } {
  const { addonVideoAdjacent } = load("src/views/player/hooks/use-episode-navigation.ts", {
    react: {}, "@/lib/cinemeta": { isAddonNativeMeta }, "@/lib/series-episodes": {},
    "@/lib/hidden-episodes": {}, "@/lib/local-library": {}, "@/lib/player/local-url": {},
    "@/views/library/local-tab/show-group": {}, "@/lib/download/downloads-store": {},
    "@/lib/download/player-src": {},
  }, "\nexports.addonVideoAdjacent = addonVideoAdjacent;");
  return addonVideoAdjacent(meta, { season: 1, episode: 1, videoId: "addon:one" });
}

const old = "2020-01-01T00:00:00Z";
const future = "2099-01-01T00:00:00Z";
const current = { id: "addon:one", season: 1, episode: 1, released: old };

for (const field of ["released", "firstAired"] as const) {
  test(`add-on series preserve ${field} so future episodes cannot auto-play`, async () => {
    const videos = [current, { id: "addon:two", season: 1, episode: 2, [field]: future }];
    const h = series(videos);
    const meta = { id: "addon:show", name: "Fixture", type: "series" };
    const result = await h.module.fetchAdjacentEpisodes(meta, { season: 1, episode: 1 }, { tmdbKey: "" });
    assert.equal(result.next.airDate, future);
    assert.deepEqual(autoAdvances(result.next), []);
    const list = await h.module.fetchEpisodeList(meta, { tmdbKey: "" });
    assert.equal(list[1].airDate, future);
    assert.equal(h.requests(), 1, "reading cached episodes must not refetch metadata");
  });

  test(`native add-on videos preserve ${field} through player navigation`, () => {
    const result = nativeAdjacent({
      id: "addon:videos", name: "Fixture", type: "tv",
      videos: [current, { id: "addon:two", season: 1, episode: 2, [field]: future }],
    });
    assert.equal(result.next?.airDate, future);
    assert.equal(result.next?.videoId, "addon:two");
    assert.deepEqual(autoAdvances(result.next), []);
  });
}

test("already-aired and undated add-on episodes retain existing autoplay behavior", async () => {
  for (const dates of [{ released: old }, {}]) {
    const videos = [current, { id: "addon:two", season: 1, episode: 2, ...dates }];
    const result = await series(videos).module.fetchAdjacentEpisodes(
      { id: "addon:show", name: "Fixture", type: "series" }, { season: 1, episode: 1 }, { tmdbKey: "" },
    );
    assert.equal(autoAdvances(result.next)[0]?.episode, 2);
    assert.equal(autoAdvances(nativeAdjacent({ id: "addon:videos", name: "Fixture", type: "tv", videos }).next)[0]?.episode, 2);
  }
});

test("released remains the primary date, with firstAired as its fallback", async () => {
  const videos = [current, { id: "addon:two", season: 1, episode: 2, released: future, firstAired: old }];
  const result = await series(videos).module.fetchAdjacentEpisodes(
    { id: "addon:show", name: "Fixture", type: "series" }, { season: 1, episode: 1 }, { tmdbKey: "" },
  );
  assert.equal(result.next.airDate, future);
  assert.deepEqual(autoAdvances(result.next), []);
});

test("standard Cinemeta release dates still reach the same autoplay gate", async () => {
  const videos = [current, { season: 1, episode: 2, released: future }];
  const result = await series(videos).module.fetchAdjacentEpisodes(
    { id: "tt1234567", name: "Fixture", type: "series" }, { season: 1, episode: 1 }, { tmdbKey: "" },
  );
  assert.equal(result.next.airDate, future);
  assert.deepEqual(autoAdvances(result.next), []);
});
