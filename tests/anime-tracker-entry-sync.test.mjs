import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { playbackParams, playbackPersistenceHarness } from "./helpers/playback-persistence-harness.ts";

const settle = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function autosave(episode, metaId = "kitsu:45619", resolveIdentity) {
  const h = playbackPersistenceHarness();
  h.enableAnimeSync();
  if (resolveIdentity) h.setIdentityResolver(resolveIdentity);
  else h.skipIdentityResolution();
  const p = playbackParams(episode.season, episode.episode);
  p.src.meta.id = metaId;
  p.src.episode = episode;
  h.render(p);
  h.render({ ...p, snap: { ...p.snap, status: "playing", positionSec: 1000, durationSec: 1200 } });
  h.clock(1000);
  h.tick();
  return h;
}

function tracker(service, { total = 13, current = 0, status, rewatching = false, switchDuring } = {}) {
  let profile = "a", session = {};
  const store = new Map(), writes = [], events = [];
  const request = async (query, options) => {
    const write = service === "anilist" ? query.startsWith("mutation") : options?.method === "PATCH";
    if (write) {
      const fields = service === "anilist" ? options : Object.fromEntries(options.body);
      writes.push(fields);
      return service === "anilist"
        ? { SaveMediaListEntry: { id: 1, progress: fields.progress, status: fields.status } }
        : { num_episodes_watched: Number(fields.num_watched_episodes), status: fields.status };
    }
    if (switchDuring === "profile") profile = "b";
    if (switchDuring === "account") session = {};
    return service === "anilist"
      ? { Media: { id: 1, episodes: total, mediaListEntry: { progress: current, status: status ?? "CURRENT" } } }
      : { num_episodes: total, my_list_status: { num_episodes_watched: current, status: status ?? "watching", is_rewatching: rewatching } };
  };
  const dependencies = {
    "@/lib/active-profile-id": { activeProfileId: () => profile },
    "@/lib/providers/anime-mapping": { kitsuToAnilist: async () => 1 },
    "./mutations": { resolveMalMediaId: async () => 1 },
    "./session": { isAuthenticated: () => true, getSession: () => session },
    "./client": service === "anilist"
      ? { anilistRequest: request, AnilistApiError: class extends Error {} }
      : { malRequest: request, MalApiError: class extends Error {} },
  };
  const source = readFileSync(new URL(`../src/lib/${service}/sync.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", "localStorage", code)((id) => {
    assert.ok(id in dependencies, `Unexpected import ${id}`);
    return dependencies[id];
  }, exports, { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) });
  exports.subscribeSync((event) => events.push(event));
  return { writes, events,
    sync: exports[service === "anilist" ? "syncAnimeProgress" : "syncMalProgress"],
    mark: exports[service === "anilist" ? "markAnimeWatching" : "markMalWatching"],
  };
}

for (const service of ["anilist", "mal"]) {
  for (const total of [13, 25, 0]) {
    test(`${service}: cour E1 stays E1 with total ${total}, even when franchise absolute is 13`, async () => {
      const h = autosave({ season: 1, episode: 1, imdbSeason: 2, imdbEpisode: 13, absoluteNumber: 13 });
      const args = h.trackerProgress.find((call) => call[0] === service).slice(1);
      assert.equal(h.trackerStatus.length, 0, "do not race a redundant watching write against progress");
      assert.deepEqual(args, ["kitsu:45619", 1, "Test series", 2]);
      const api = tracker(service, { total });
      await api.sync(...args);
      assert.equal(api.writes.length, 1);
      assert.equal(Number(api.writes[0].progress ?? api.writes[0].num_watched_episodes), 1);
      assert.equal(api.writes[0].status, service === "anilist" ? "CURRENT" : "watching");
      // Subsequent ticks/replayed E1 must not turn into absolute E13.
      await api.sync(...args);
      assert.equal(api.writes.length, 1);
    });
  }

  test(`${service}: an identity-resolved full-entry finale completes exactly at total`, async () => {
    const h = autosave(
      { season: 2, episode: 1, imdbSeason: 2, imdbEpisode: 1, absoluteNumber: 999 },
      "tmdb:tv:100", async () => ({ kitsuId: 99, number: 25 }),
    );
    await settle();
    const args = h.trackerProgress.find((call) => call[0] === service).slice(1);
    assert.deepEqual(args, ["kitsu:99", 25, "Test series", 2]);
    const api = tracker(service, { total: 25, current: 24 });
    await api.sync(...args);
    assert.equal(Number(api.writes[0].progress ?? api.writes[0].num_watched_episodes), 25);
    assert.equal(api.writes[0].status, service === "anilist" ? "COMPLETED" : "completed");
  });

  test(`${service}: a scoped long-running stream writes its own absolute episode with unknown total`, async () => {
    const h = autosave({ season: 21, episode: 45, kitsuStreamId: "kitsu:12:1089", absoluteNumber: 9999 }, "tt0388629");
    const args = h.trackerProgress.find((call) => call[0] === service).slice(1);
    assert.equal(args[0], "kitsu:12");
    assert.equal(args[1], 1089);
    const api = tracker(service, { total: 0 });
    await api.sync(...args);
    assert.equal(Number(api.writes[0].progress ?? api.writes[0].num_watched_episodes), 1089);
  });

  test(`${service}: already watched and out-of-range episodes never manufacture a completion`, async () => {
    for (const episode of [1, 14, 500, 1.5, NaN]) {
      const api = tracker(service, { total: 13, current: 1 });
      await api.sync("kitsu:1", episode, "Fixture");
      assert.equal(api.writes.length, 0);
    }
  });

  test(`${service}: completed and rewatching entries keep their deliberate status`, async () => {
    const cases = service === "anilist"
      ? [{ status: "COMPLETED" }, { status: "REPEATING" }]
      : [{ status: "completed" }, { rewatching: true }];
    for (const options of cases) {
      const api = tracker(service, options);
      await api.sync("kitsu:1", 2, "Fixture");
      assert.equal(api.writes.length, 0);
    }
  });

  for (const switchDuring of ["profile", "account"]) {
    test(`${service}: pending progress and watching status cannot cross a ${switchDuring} switch`, async () => {
      const progress = tracker(service, { switchDuring });
      await progress.sync("kitsu:1", 2, "Fixture");
      assert.equal(progress.writes.length, 0);
      const watching = tracker(service, { switchDuring, status: service === "anilist" ? "PLANNING" : "plan_to_watch" });
      await watching.mark("kitsu:1", "Fixture");
      assert.equal(watching.writes.length, 0);
      assert.equal(watching.events.length, 0);
    });
  }
}

for (const switchDuring of ["profile", "account"]) {
  test(`async anime identity resolution cannot send progress to a changed ${switchDuring}`, async () => {
    const gate = deferred();
    const h = autosave({ season: 2, episode: 1, imdbSeason: 2, imdbEpisode: 1 }, "tmdb:tv:100", () => gate.promise);
    if (switchDuring === "profile") h.setProfile("another");
    else h.switchTrackerSession();
    gate.resolve({ kitsuId: 99, number: 1 });
    await settle();
    assert.equal(h.trackerProgress.length, 0);
    assert.equal(h.trackerStatus.length, 0);
  });
}

test("failed identity resolution retains a known cour target without franchise absolute promotion", async () => {
  const h = autosave(
    { season: 1, episode: 1, sourceMetaId: "kitsu:45619", imdbSeason: 3, imdbEpisode: 13, absoluteNumber: 50 },
    "kitsu:45398", async () => { throw new Error("No mapping"); },
  );
  await settle();
  assert.deepEqual(h.trackerProgress.map((call) => call.slice(1, 3)), [["kitsu:45619", 1], ["kitsu:45619", 1]]);
});
