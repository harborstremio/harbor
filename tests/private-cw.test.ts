import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import test from "node:test";
import ts from "typescript";
import { playbackParams, playbackPersistenceHarness } from "./helpers/playback-persistence-harness.ts";

function harness() {
  const data = new Map<string, string>();
  const events = new Map<string, Set<() => void>>();
  const profiles = [{ id: "a", isPrimary: true }, { id: "b", shareStremioWith: "a" }];
  data.set("harbor.settings.shared", JSON.stringify({ cwPerProfile: true }));
  const storage = { getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) };
  const window = { addEventListener: (name: string, fn: () => void) => {
    if (!events.has(name)) events.set(name, new Set()); events.get(name)!.add(fn);
  } };
  const select = (id: string) => {
    data.set("harbor.profiles.v1", JSON.stringify({ profiles, activeId: id }));
    for (const fn of events.get("harbor:active-profile-changed") ?? []) fn();
  };
  select("a");
  let remoteReads = 0, cloudWrites = 0;
  const cache = new Map<string, any>();
  const load = (path: string): any => {
    const full = resolve(path);
    if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const compiled = ts.transpileModule(readFileSync(full, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "exports", "localStorage", "window", compiled)((name: string) => {
      if (name === "react") return { useSyncExternalStore: () => 0 };
      if (name.endsWith("/stremio")) return {
        isCwMember: (i: any) => i.state?.timeOffset > 0,
        isAnimeCwItem: () => false, libraryMetaType: () => "series",
        episodeFromVideoId: (id: string) => {
          const p = id?.split(":"); return p?.length === 3 ? { season: +p[1], episode: +p[2] } : null;
        },
        libraryGetOne: async () => { remoteReads++; return { state: { timeOffset: 900000, duration: 1000000, season: 1, episode: 1 } }; },
      };
      if (name.endsWith("/storage-recovery")) return { setItemWithRecovery: storage.setItem };
      if (name.endsWith("/series-episodes")) return {
        fetchAdjacentEpisodes: async () => ({ next: { season: 1, episode: 2, airDate: "2020-01-01" } }),
        fetchEpisodeList: async () => [1, 2, 3].map(episode => ({ season: 1, episode, airDate: "2020-01-01" })),
        nextUnwatchedAfter: (list: any[], cur: any, watched: any) => list.find(e => e.episode > cur.episode && !watched(e.season, e.episode)),
      };
      if (name.endsWith("/providers/anime-mapping")) return { relatedLibraryIds: async () => [] };
      if (name.endsWith("/stremio-write-queue")) return { cloudLibraryPut: async () => { cloudWrites++; } };
      return load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : resolve(dirname(full), `${name}.ts`));
    }, exports, storage, window);
    return exports;
  };
  return { data, select, load, get remoteReads() { return remoteReads; }, get cloudWrites() { return cloudWrites; } };
}

const entry = (positionMs = 300000, episode = 1) => ({ id: "tt100", type: "series", name: "Test series",
  season: 1, episode, videoId: `tt100:1:${episode}`, positionMs, durationMs: 3600000, t: Date.now() });

test("ordinary streamed playback records an owned Continue Watching entry", () => {
  const h = playbackPersistenceHarness();
  const p = playbackParams(); h.render(p);
  h.render({ ...p, snap: { ...p.snap, status: "playing", positionSec: 300, durationSec: 3600 } });
  h.clock(300); h.tick();
  assert.equal(h.localCw.at(-1)?.id, "tt100");
  assert.equal(h.localCw.at(-1)?.positionMs, 300000);
  assert.equal(h.localOwners.at(-1), "fixture");
});

test("profile-switch cleanup retains the outgoing playback owner", () => {
  const h = playbackPersistenceHarness(), p = playbackParams(); h.render(p);
  const playing = { ...p, snap: { ...p.snap, status: "playing", positionSec: 320, durationSec: 3600 } };
  h.render(playing); h.clock(320);
  h.setProfile("second"); h.render(playing); h.tick();
  assert.equal(h.localOwners.at(-1), "fixture");
  assert.equal(h.writes.at(-1)?.[7], "fixture");
  assert.equal(h.localOwners.includes("second"), false, "stale bridge telemetry must not seed the new profile");
  h.clock(0); h.render(p);
  h.render({ ...playing, snap: { ...playing.snap, positionSec: 90 } }); h.clock(90); h.tick();
  assert.equal(h.localOwners.at(-1), "second");
  assert.equal(h.localCw.at(-1)?.positionMs, 90000);
});

test("finished movies disappear without deleting the other profile's progress", () => {
  const h = harness(), cw = h.load("src/lib/local-cw.ts");
  cw.saveLocalCw({ ...entry(), type: "movie" }, "a");
  cw.saveLocalCw({ ...entry(600000), type: "movie" }, "b");
  cw.saveLocalCw({ ...entry(3500000), type: "movie" }, "a");
  assert.deepEqual(cw.listLocalCw(true), []);
  h.select("b"); assert.equal(cw.listLocalCw(true)[0].positionMs, 600000);
  cw.clearLocalCw("tt100", "a");
  assert.equal(cw.listLocalCw(true)[0].positionMs, 600000);
});

test("owned records survive reload and retain the existing sixty-title bound", () => {
  const h = harness(), cw = h.load("src/lib/local-cw.ts");
  for (let i = 0; i < 65; i++) cw.saveLocalCw({ ...entry(), id: `tt${i}`, t: i }, "a", false);
  assert.equal(cw.listLocalCw(true).length, 60);
  assert.equal(cw.listLocalCw(true)[0].id, "tt64");
  assert.equal(cw.listLocalCw(true).at(-1).id, "tt5");
  const reloaded = harness(); for (const [k, v] of h.data) reloaded.data.set(k, v);
  assert.equal(reloaded.load("src/lib/local-cw.ts").listLocalCw(true)[0].id, "tt64");
  assert.deepEqual(cw.listLocalCw(false), []);
});

test("private setting respects unlinked profiles and independent Stremio accounts", () => {
  const h = harness(), scope = h.load("src/lib/cw-profile.ts");
  h.data.set("harbor.profiles.v1", JSON.stringify({ activeId: "b", profiles: [
    { id: "a", isPrimary: true }, { id: "b", shareStremioWith: "a", settingsLinked: false },
  ] }));
  h.data.set("harbor.settings.b", JSON.stringify({ cwPerProfile: false }));
  assert.equal(scope.privateCwProfileId(), null);
  h.data.set("harbor.settings.b", JSON.stringify({ cwPerProfile: true }));
  assert.equal(scope.privateCwProfileId(), "b");
  h.data.set("harbor.profiles.v1", JSON.stringify({ activeId: "b", profiles: [
    { id: "a", isPrimary: true }, { id: "b", settingsLinked: false },
  ] }));
  assert.equal(scope.privateCwProfileId(), null, "an independent account keeps its own cloud CW");
});

test("sharing profiles retain separate episodes and notify on switching", () => {
  const h = harness(), cw = h.load("src/lib/local-cw.ts");
  cw.saveLocalCw(entry(), "a");
  let changes = 0; cw.subscribeLocalCw(() => changes++);
  h.select("b"); assert.equal(changes, 1);
  assert.deepEqual(cw.listLocalCw(true), []);
  cw.saveLocalCw(entry(600000, 3), "b");
  h.select("a"); assert.equal(cw.listLocalCw(true)[0].episode, 1);
  h.select("b"); assert.equal(cw.listLocalCw(true)[0].episode, 3);
  // An outgoing session cleanup runs after the active profile has changed.
  cw.saveLocalCw(entry(350000), "a");
  assert.equal(cw.listLocalCw(true)[0].positionMs, 600000);
  h.select("a"); assert.equal(cw.listLocalCw(true)[0].positionMs, 350000);
});

test("legacy and absorbed cloud entries are never assigned to a private profile", () => {
  const h = harness();
  h.data.set("harbor.localcw.v1", JSON.stringify({ tt100: entry() }));
  const cw = h.load("src/lib/local-cw.ts");
  assert.equal(cw.listLocalCw(false).length, 1);
  assert.deepEqual(cw.listLocalCw(true), []);
  cw.saveLocalCw({ ...entry(), id: "kitsu:99" });
  assert.deepEqual(cw.listLocalCw(true), []);
  h.select("b"); assert.deepEqual(cw.listLocalCw(true), []);
});

test("private resume ignores shared cloud and imported offsets", async () => {
  const h = harness(), resume = h.load("src/lib/resume.ts");
  resume.saveResumeMs("tt100", 300000, 1, 1, 1, undefined, undefined, "a");
  h.select("b");
  assert.equal(resume.readResumeMs("tt100", 1, 1), 0);
  resume.saveResumeMs("tt100", 600000, 1, 1, 1, undefined, undefined, "b");
  h.select("a");
  resume.saveResumeBatch([{ id: "tt100", ms: 900000, season: 1, episode: 1 }]);
  const start = h.load("src/lib/player/resume-start.ts");
  const identity = { metaId: "tt100", authKey: "fixture", imdbId: "tt100", imdbVerified: true };
  start.prefetchResumeStart(identity);
  assert.equal(start.isResumeStartReady(identity), true);
  assert.deepEqual(await start.resolveStartMs({ ...identity, season: 1, episode: 1, openingVid: "tt100:1:1" }),
    { ms: 300000, fromRemote: false, finished: false });
  assert.equal(h.remoteReads, 0);
  assert.equal(resume.lastPlayedEpisode("tt100").ms, 300000);
  resume.clearResume("tt100", 1, 1);
  h.select("b"); assert.equal(resume.readResumeMs("tt100", 1, 1), 600000);
  h.data.set("harbor.settings.shared", JSON.stringify({ cwPerProfile: false }));
  assert.equal(resume.readResumeMs("tt100", 1, 1), 900000);
});

test("private dismissal stays with its profile and does not write shared cloud", () => {
  const h = harness(), dismiss = h.load("src/lib/cw-dismiss.ts");
  const value = { _id: "tt100", type: "series", name: "Test", _mtime: "2020-01-01T00:00:00Z",
    state: { season: 1, episode: 1, timeOffset: 300000, duration: 3600000 } };
  dismiss.dismissCw(value, "fixture");
  assert.equal(dismiss.isCwDismissed(value), true);
  assert.equal(h.cloudWrites, 0);
  h.select("b"); assert.equal(dismiss.isCwDismissed(value), false);
  h.select("a"); assert.equal(dismiss.isCwDismissed(value), true);
});

test("shared next-episode cache cannot skip ahead in private Continue Watching", async () => {
  const h = harness(), resurface = h.load("src/lib/cw-resurface.ts");
  const item = { _id: "tt100", type: "series", name: "Test", state: {
    season: 1, episode: 1, timeOffset: 0, duration: 3600000, flaggedWatched: 1, lastWatched: new Date().toISOString(),
  } };
  h.data.set("harbor.settings.shared", JSON.stringify({ cwPerProfile: false }));
  const shared = await resurface.resurfaceCandidates([item], new Set(), { tmdbKey: "", animeMode: "all" },
    () => (_s: number, e: number) => e <= 2);
  assert.equal(shared.get("tt100").episode, 3);
  h.data.set("harbor.settings.shared", JSON.stringify({ cwPerProfile: true }));
  const owned = await resurface.resurfaceCandidates([item], new Set(), { tmdbKey: "", animeMode: "all" },
    () => (_s: number, e: number) => e === 1);
  assert.equal(owned.get("tt100").episode, 2);
});
