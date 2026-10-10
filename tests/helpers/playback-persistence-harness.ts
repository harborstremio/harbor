import { readFileSync } from "node:fs";
import ts from "typescript";
import { emptySnapshot } from "../../src/lib/player/bridge.ts";
import { isNaturalEnd } from "../../src/lib/player/playback-end.ts";
import { playerLoadIdentity } from "../../src/lib/player/load-identity.ts";
import { animeTrackerTarget } from "../../src/lib/tracker-progress.ts";

export function playbackPersistenceHarness(kind: "local" | "cloud" = "local") {
  const effects: Array<{ deps: unknown[] | undefined; cleanup?: () => void }> = [];
  const refs: Array<{ current: any }> = [];
  const memos: Array<{ deps: unknown[]; value: any }> = [];
  let refIndex = 0, effectIndex = 0, memoIndex = 0;
  let pending: Array<{ index: number; deps: unknown[] | undefined; run: () => any }> = [];
  let position = 0, timerId = 0;
  const listeners = new Set<() => void>();
  const intervals = new Map<number, () => void>();
  const events = new Map<string, Set<() => void>>();
  const writes: any[][] = [], watched: any[][] = [], history: any[][] = [], synced: any[][] = [];
  const localCw: any[] = [], cleared: any[][] = [], watchEvents: any[] = [];
  const localOwners: any[] = [];
  let profileId = "fixture";
  let stremioPushOk = () => true;
  let trackerSession = {};
  const cloudWrites: any[][] = [];
  const identityRequests: any[][] = [], trackerProgress: any[][] = [], trackerStatus: any[][] = [];
  const libraryItem = { _id: "tt100", name: "Test series", state: {} };
  let cloudRead: () => Promise<any> = async () => libraryItem;
  const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) =>
    !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useRef: (initial: any) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useMemo: (create: () => any, deps: unknown[]) => {
      const i = memoIndex++;
      if (!memos[i] || !sameDeps(memos[i].deps, deps)) memos[i] = { deps, value: create() };
      return memos[i].value;
    },
    useEffect: (run: () => any, deps?: unknown[]) => {
      const i = effectIndex++;
      if (!effects[i] || !sameDeps(effects[i].deps, deps)) pending.push({ index: i, deps, run });
    },
  };
  const noop = () => {};
  const dependencies: Record<string, unknown> = {
    markAnimeWatching: noop, syncAnimeProgress: noop, markMalWatching: noop, syncMalProgress: noop,
    animeTrackerTarget, activeProfileId: () => profileId, getSession: () => trackerSession,
    animeIdentityEligible: () => false, resolveAnimeIdentity: async () => null,
    isForeignSplitSeason: () => false, splitFranchiseDisplaySeason: () => undefined,
    isSplitFranchiseKitsu: () => false, parseKitsuId: () => null,
    profileFromMeta: () => ({}), trackEvent: noop, isExternalPlaylistId: () => false,
    clearLocalCw: noop, localCwEntry: () => null, saveLocalCw: (v: any, owner: any) => { localCw.push(v); localOwners.push(owner); },
    recordWatchEvent: (v: any) => watchEvents.push(v), isLocalUrl: () => false,
    isManuallyWatched: (id: string, s: number, e: number) => watched.some(v => v[0] === id && v[1] === s && v[2] === e),
    recordManualWatchedMeta: noop, setManualWatched: (...args: any[]) => watched.push(args),
    savePlayback: (...args: any[]) => history.push(args),
    clearResume: (...args: any[]) => cleared.push(args), saveResumeMs: (...args: any[]) => writes.push(args),
    isMovieWatchedLocal: () => false, setMovieWatchedLocal: noop, setViewedSeason: noop,
    getPlaybackPosition: () => position,
    subscribePlaybackClock: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
    useSettings: () => ({ settings: { anilistAutoSync: false, malAutoSync: false } }),
    ANIME_CLOUD_ID: /^(kitsu|mal|anilist|anidb):/, CLOUD_OK: /^(tt|tmdb:)/,
    syncSeriesWatchedToStremio: (...args: any[]) => { synced.push(args); return Promise.resolve(stremioPushOk()); },
    isDetectedAnime: () => false,
    absoluteEntryNumber: async () => null,
    isNaturalEnd, playerLoadIdentity,
    cloudWriteId: (id: string, resolved: string, verified: boolean) => id.startsWith("tt") ? id : verified ? resolved : null,
    useProfiles: () => ({ activeProfile: { id: profileId } }),
    recordWatchedBy: noop, recordAnimeCwId: noop,
    resumeLibraryGetOne: async () => libraryItem, libraryGetOne: () => cloudRead(),
    libraryGetOneStrict: async () => libraryItem,
  };
  const mockWindow = {
    setInterval: (fn: () => void) => { intervals.set(++timerId, fn); return timerId; },
    clearInterval: (id: number) => intervals.delete(id),
    addEventListener: (event: string, fn: () => void) => { if (!events.has(event)) events.set(event, new Set()); events.get(event)!.add(fn); },
    removeEventListener: (event: string, fn: () => void) => events.get(event)?.delete(fn),
  };
  let source = readFileSync(new URL(`../../src/views/player/hooks/${kind === "local" ? "use-resume-autosave" : "use-stremio-sync"}.ts`, import.meta.url), "utf8");
  if (kind === "cloud") {
    // Isolate the hook at its cloud writer; retain the real effects and ID selection.
    const ast = ts.createSourceFile("sync.ts", source, ts.ScriptTarget.Latest, true);
    const writer = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "writeLibraryItem");
    if (!writer) throw new Error("Cloud writer not found");
    source = source.slice(0, writer.pos) + "\nconst writeLibraryItem = testWrite;\n" + source.slice(writer.end);
    source = source.replaceAll("import.meta.env.DEV", "false");
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module: any = {};
  new Function("require", "exports", "window", "testWrite", compiled)(
    (name: string) => name === "react" ? react : dependencies, module, mockWindow,
    async (...args: any[]) => { cloudWrites.push(args); return null; },
  );
  return {
    writes, watched, history, synced, cleared, localCw, watchEvents, cloudWrites,
    localOwners, setProfile: (id: string) => { profileId = id; },
    setStremioPush: (ok: () => boolean) => { stremioPushOk = ok; },
    setCloudRead: (read: () => Promise<any>) => { cloudRead = read; },
    identityRequests, trackerProgress, trackerStatus,
    setIdentityResolver(resolve: (...args: any[]) => Promise<any>) {
      dependencies.resolveAnimeIdentity = (...args: any[]) => { identityRequests.push(args); return resolve(...args); };
    },
    skipIdentityResolution() { dependencies.animeIdentityEligible = () => false; },
    dependencies,
    switchTrackerSession() { trackerSession = {}; },
    enableAnimeSync() {
      dependencies.useSettings = () => ({ settings: { anilistAutoSync: true, malAutoSync: true } });
      dependencies.animeIdentityEligible = () => true;
      dependencies.resolveAnimeIdentity = async (...args: any[]) => { identityRequests.push(args); return { kitsuId: 99, number: args[2].episode }; };
      dependencies.syncAnimeProgress = (...args: any[]) => trackerProgress.push(["anilist", ...args]);
      dependencies.syncMalProgress = (...args: any[]) => trackerProgress.push(["mal", ...args]);
      dependencies.markAnimeWatching = (...args: any[]) => trackerStatus.push(["anilist", ...args]);
      dependencies.markMalWatching = (...args: any[]) => trackerStatus.push(["mal", ...args]);
    },
    render(params: any) {
      refIndex = effectIndex = memoIndex = 0; pending = [];
      (kind === "local" ? module.useResumeAutosave : module.useStremioSync)(params);
      // React flushes all replaced effects' cleanups before setting up the new effects.
      for (const effect of pending) effects[effect.index]?.cleanup?.();
      for (const effect of pending) effects[effect.index] = { deps: effect.deps, cleanup: effect.run() };
    },
    clock(pos: number) { position = pos; for (const fn of listeners) fn(); },
    tick() { for (const fn of intervals.values()) fn(); },
    pagehide() { for (const fn of events.get("pagehide") ?? []) fn(); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

export function playbackParams(season = 1, episode = 1, patch: any = {}) {
  return {
    src: { meta: { id: "tt100", type: "series", name: "Test series" }, url: `https://media.test/${season}/${episode}.mkv`, episode: { season, episode, imdbSeason: season, imdbEpisode: episode } },
    snap: { ...emptySnapshot, status: "loading" }, season, episode,
    resolvedImdbId: "tt100", resolvedImdbVerified: true, ...patch,
  };
}
