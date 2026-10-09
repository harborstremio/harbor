import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const now = Date.now();
const iso = (offset = 0) => new Date(now + offset).toISOString();
const episodeKey = (id: string, s: number, e: number) => `${id}:${s}:${e}`;
const item = (episode = 1, lastWatched = iso(-3600000), id = "tt100") => ({
  _id: id,
  type: "series",
  name: "Fixture series",
  removed: false,
  temp: false,
  _ctime: lastWatched,
  _mtime: lastWatched,
  state: {
    season: 1,
    episode,
    video_id: `${id}:1:${episode}`,
    timeOffset: 300000,
    duration: 1800000,
    lastWatched,
    flaggedWatched: 0,
  },
});
const anchor = (episode = 1, id = "tt100") => ({
  ...item(episode, iso(), id),
  external: "simkl",
  state: { ...item(episode, iso(), id).state, timeOffset: 0, duration: 0, flaggedWatched: 1 },
});
const progress = (episodes = [1], id = "tt100", completedSeries: any[] = []) => ({
  statuses: new Map([[id, "watching"]]),
  watched: new Map([[id, new Set(episodes.map((e) => `1:${e}`))]]),
  watchedAt: new Map([[id, new Map(episodes.map((e) => [`1:${e}`, now]))]]),
  completedSeries,
});

function compile(
  path: string,
  require: (name: string) => any,
  source = readFileSync(path, "utf8"),
  events: Record<string, () => void> = {},
) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", "window", "document", code)(
    require,
    module,
    module.exports,
    {
      setInterval: (fn: () => void) => {
        events.poll = fn;
        return 1;
      },
      clearInterval: () => {
        delete events.poll;
      },
      addEventListener: (name: string, fn: () => void) => {
        events[name] = fn;
      },
      removeEventListener: (name: string) => {
        delete events[name];
      },
    },
    { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} },
  );
  return module.exports;
}

function harness() {
  const events: Record<string, () => void> = {};
  const resumes = new Map<string, any>(),
    manual = new Map<string, boolean>();
  const lastPlayed = new Map<string, any>();
  const dismissed = new Set<string>();
  let settings = { cwSources: { simkl: true }, cwHideCaughtUp: false, cwPerProfile: false };
  let profile = { id: "a" },
    session: object | null = { username: "fixture" };
  let remote: any = progress(),
    remoteReads = 0,
    episodeReads = 0,
    metadataFails = false;
  let episodes = [1, 2, 3, 4].map((episode) => ({ season: 1, episode, airDate: "2020-01-01" }));
  const states: any[] = [],
    refs: any[] = [],
    effects: any[] = [];
  let stateSlot = 0,
    refSlot = 0,
    effectSlot = 0,
    dirty = false;
  const pending: (() => void)[] = [];
  const modules = new Map<string, any>();
  let params: any[] = [[], "", true, []];
  const mocks: Record<string, any> = {
    react: {
      useState: (initial: any) => {
        const slot = stateSlot++;
        if (!(slot in states)) states[slot] = initial;
        return [
          states[slot],
          (update: any) => {
            const next = typeof update === "function" ? update(states[slot]) : update;
            if (!Object.is(next, states[slot])) {
              states[slot] = next;
              dirty = true;
            }
          },
        ];
      },
      useRef: (current: any) => refs[refSlot++] ?? (refs[refSlot - 1] = { current }),
      useSyncExternalStore: (_subscribe: any, get: any) => get(),
      useEffect: (fn: any, deps: any[]) => {
        const slot = effectSlot++,
          old = effects[slot];
        if (old && deps.every((dep, i) => Object.is(dep, old.deps[i]))) return;
        pending.push(() => {
          old?.cleanup?.();
          effects[slot] = { deps, cleanup: fn() };
        });
      },
    },
    "@/lib/resume": {
      readResumeEntry: (id: string, s: number, e: number) => resumes.get(episodeKey(id, s, e)),
      lastPlayedEpisode: (id: string) => lastPlayed.get(id),
      readResumeSource: () => undefined,
    },
    "@/lib/manual-watched": {
      manualWatchedState: (id: string, s: number, e: number) => manual.get(episodeKey(id, s, e)),
    },
    "@/lib/settings": { useSettings: () => ({ settings }) },
    "@/lib/profiles": {
      useProfiles: () => ({ activeProfile: profile, profiles: [] }),
      anyProfileSharesStremioWith: () => true,
    },
    "@/lib/simkl/session": { getSession: () => session, subscribeSession: () => () => {} },
    "@/lib/simkl/list-status": {
      loadSimklProgress: async () => {
        remoteReads++;
        if (remote instanceof Error) throw remote;
        return remote;
      },
      simklWatchedForId: (map: Map<string, Set<string>>, id: string) => map.get(id) ?? new Set(),
      statusForId: (map: Map<string, string>, id: string) => map.get(id),
    },
    "@/lib/cw-dismiss": {
      useCwDismissVersion: () => 0,
      isCwDismissed: (i: any) =>
        dismissed.has(episodeKey(i._id, i.state?.season, i.state?.episode)),
    },
    "@/lib/cw-profile": { privateCwProfileId: () => (settings.cwPerProfile ? profile.id : null) },
    "@/lib/providers/anime-mapping": { relatedLibraryIds: async () => [] },
    "@/lib/anime-detect": { isDetectedAnime: () => false },
    "@/lib/safe-fetch": {
      safeFetch: () => {
        throw new Error("unexpected live request");
      },
    },
    "@/lib/hidden-episodes": { isEpisodeHidden: () => false },
    "@/lib/season-view-pref": { getViewedSeason: () => undefined },
    "@/lib/anime-cw-ids": { getAnimeCwId: () => null },
    "@/lib/providers/anime-franchise-root": { isSplitFranchiseKitsu: () => false },
    "@/lib/providers/kitsu": { parseKitsuId: () => null },
    "@/lib/providers/jikan": { franchiseDedupKey: (name: string) => name.toLowerCase() },
    "@/lib/local-cw": { listLocalCw: () => [] },
    "@/lib/continue-watching": { localToLibraryItem: (i: any) => i },
    "@/lib/cw-anime-episode": {},
  };
  const seriesSource = readFileSync("src/lib/series-episodes.ts", "utf8");
  const parsed = ts.createSourceFile("series.ts", seriesSource, ts.ScriptTarget.Latest, true);
  const nextFn = parsed.statements.find(
    (node: any) => ts.isFunctionDeclaration(node) && node.name?.text === "nextUnwatchedAfter",
  )!;
  mocks["@/lib/series-episodes"] = {
    ...compile(
      "",
      () => {
        throw new Error("unexpected dependency");
      },
      nextFn.getText(parsed),
    ),
    fetchEpisodeList: async () => {
      episodeReads++;
      if (metadataFails) throw new Error("metadata offline");
      return episodes;
    },
    fetchAdjacentEpisodes: async (_meta: any, cur: any) => {
      episodeReads++;
      if (metadataFails) throw new Error("metadata offline");
      const idx = episodes.findIndex((e) => e.season === cur.season && e.episode === cur.episode);
      return { next: idx < 0 ? null : (episodes[idx + 1] ?? null) };
    },
  };
  const load = (name: string): any => {
    if (name in mocks) return mocks[name];
    if (name === "./anime-detect") return mocks["@/lib/anime-detect"];
    assert.ok(name.startsWith("@/"), `unexpected import ${name}`);
    if (!modules.has(name))
      modules.set(name, compile(`src/${name.slice(2)}.ts`, load, undefined, events));
    return modules.get(name);
  };
  const { useCwAdvance } = load("@/views/home/hooks/use-cw-advance");
  const render = () => {
    stateSlot = refSlot = effectSlot = 0;
    dirty = false;
    const out = useCwAdvance(...params);
    pending.splice(0).forEach((fn) => fn());
    return out;
  };
  return {
    events,
    resumes,
    manual,
    dismissed,
    lastPlayed,
    setRemote: (value: any) => {
      remote = value;
    },
    setPrivate: (value: boolean) => {
      settings = { ...settings, cwPerProfile: value };
    },
    setSource: (value: boolean) => {
      settings = { ...settings, cwSources: { simkl: value } };
    },
    setSession: (value: object | null) => {
      session = value;
    },
    setProfile: (id: string) => {
      profile = { id };
    },
    setEpisodes: (value: any[]) => {
      episodes = value;
    },
    failMetadata: (value = true) => {
      metadataFails = value;
    },
    render: (...args: any[]) => {
      if (args.length) params = args;
      return render();
    },
    async flush() {
      let out: any[] = [];
      for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setImmediate(resolve));
        if (dirty || i === 0) out = render();
      }
      return out;
    },
    get remoteReads() {
      return remoteReads;
    },
    get episodeReads() {
      return episodeReads;
    },
  };
}

test("remote completion advances an old pause and skips following remotely watched episodes", async () => {
  const h = harness();
  h.setRemote(progress([1, 2, 3]));
  h.render([item()], "", true);
  const [out] = await h.flush();
  assert.equal(out.state.episode, 4);
  assert.equal(out.upNext, true);
  assert.equal(out.state.timeOffset, 0);
});

test("incoming completed history creates a new card while Home stays open without paused sessions", async () => {
  const h = harness();
  h.setRemote(progress([], "tt100"));
  h.render([], "", true, []);
  assert.deepEqual(await h.flush(), []);
  h.setRemote(progress([1], "tt100", [anchor()]));
  h.events.poll();
  const out = await h.flush();
  assert.equal(out[0]._id, "tt100");
  assert.equal(out[0].state.episode, 2);
  assert.equal(out[0].upNext, true);
  assert.equal(h.remoteReads, 2);
});

test("returning focus refreshes watched progress before the next poll", async () => {
  const h = harness();
  h.setRemote(progress([]));
  h.render([item()], "", true);
  assert.equal((await h.flush())[0].state.episode, 1);
  h.setRemote(progress([1]));
  h.events.focus();
  assert.equal((await h.flush())[0].state.episode, 2);
});

test("newer local and remote rewatches remain on the current episode", async () => {
  for (const local of [false, true]) {
    const h = harness();
    const current = local ? item() : item(1, iso(1000));
    if (local) h.resumes.set("tt100:1:1", { ms: 60000, t: now + 1000 });
    h.render([current], "", true);
    assert.equal((await h.flush())[0], current);
    assert.equal(h.episodeReads, 0);
  }
});

test("an imported resume's fetch timestamp does not defeat remote completion", async () => {
  const h = harness();
  h.resumes.set("tt100:1:1", { ms: 300000, t: now + 1000, source: "simkl" });
  h.render([item()], "", true);
  assert.equal((await h.flush())[0].state.episode, 2);
});

test("manual unwatched overrides remote completion and synthetic finished anchors", async () => {
  for (const hasPause of [false, true]) {
    const h = harness();
    h.manual.set("tt100:1:1", false);
    h.setRemote(progress([1], "tt100", [anchor()]));
    h.render(hasPause ? [item()] : [], "", true, []);
    const out = await h.flush();
    assert.equal(out.length, hasPause ? 1 : 0);
    if (hasPause) assert.equal(out[0].state.episode, 1);
    assert.equal(h.episodeReads, 0);
  }
});

test("private profiles, disabled CW sources, disconnected sessions and disabled advancement do not read remote history", async () => {
  for (const mode of ["private", "source", "session", "disabled"]) {
    const h = harness();
    if (mode === "private") h.setPrivate(true);
    if (mode === "source") h.setSource(false);
    if (mode === "session") h.setSession(null);
    const current = item();
    h.render([current], "", mode !== "disabled");
    assert.equal((await h.flush())[0], current);
    assert.equal(h.remoteReads, 0);
  }
});

test("caught-up remote completion removes the stale pause but metadata failure preserves it", async () => {
  const h = harness();
  h.setRemote(progress([1, 2, 3, 4]));
  h.render([item()], "", true);
  assert.deepEqual(await h.flush(), []);
  const failed = harness(),
    current = item();
  failed.failMetadata();
  failed.render([current], "", true);
  assert.equal((await failed.flush())[0], current);
  failed.failMetadata(false);
  failed.render([current], "", true);
  assert.equal((await failed.flush())[0].state.episode, 2);
});

test("future and unknown anime episodes are not presented as playable up next", async () => {
  for (const airDate of ["2099-01-01", undefined]) {
    const h = harness();
    h.setRemote(progress([1], "mal:1"));
    h.setEpisodes([
      { season: 1, episode: 1, airDate: "2020-01-01" },
      { season: 1, episode: 2, airDate },
    ]);
    h.render([item(1, iso(-3600000), "mal:1")], "", true);
    assert.equal((await h.flush())[0]?.upNext, undefined);
  }
});

test("local completion does not wait for a slow history request", async () => {
  const h = harness();
  h.setRemote(new Promise(() => {}));
  h.render([anchor()], "", true);
  assert.equal((await h.flush())[0].state.episode, 2);
});

test("unowned parent maps cannot skip episodes while the current account is loading", async () => {
  const h = harness();
  h.setRemote(new Promise(() => {}));
  h.render(
    [anchor()],
    "",
    true,
    [],
    "all",
    0,
    new Set(),
    new Map([["tt100", new Set(["1:1", "1:2", "1:3"])]]),
  );
  assert.equal((await h.flush())[0].state.episode, 2);
});
