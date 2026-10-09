import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as selection from "../src/lib/music/surprise-selection";
import * as automation from "../src/lib/music/queue-automation";
import * as daily from "../src/lib/music/daily-discovery-selection";
import * as ranking from "../src/lib/music/made-for-you-selection";
import * as quality from "../src/lib/music/mix-quality";
import { artistIdentityKey } from "../src/lib/music/artist-popularity";
import { dedupeMusicTracks, musicTrackIdentity } from "../src/lib/music/track-identity";
import { musicTrackKeys } from "../src/lib/music/playlist-membership";
import type { MusicPlayerState, MusicTrack } from "../src/lib/music/types";
import { queueTrackKey } from "../src/lib/music/queue-order";
import { insertIntoQueue, markManuallyQueued, queueInsertIndex } from "../src/lib/music/queue-insert";
import { adoptRequestedIdentity } from "../src/lib/music/queue-source";

const track = (artist: string, n: number): MusicTrack => ({ id: `deezer:track:${artist}-${n}`, title: `Song ${n}`, artist, artwork: `${artist}.jpg`, durationSeconds: 180, durationLabel: "3:00", connectorId: "catalog" });
const tracks = (start = 0) => Array.from({ length: 10 }, (_, a) => Array.from({ length: 8 }, (_, n) => track(`Artist ${a}`, start + n))).flat();
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
function load<T>(name: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL(`../src/lib/music/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => { assert.ok(id in mocks, `Unmocked ${id}`); return mocks[id]; }, module, module.exports);
  return module.exports as T;
}

test("Surprise selects unheard recordings, spaces familiar artists and de-duplicates provider copies", () => {
  const input = Array.from({ length: 14 }, (_, a) => Array.from({ length: 8 }, (_, n) => track(`Artist ${a}`, n))).flat();
  const familiar = new Set(input.filter((_, n) => n % 8 < 2).map(musicTrackIdentity));
  const picks = selection.selectSurpriseTracks([...input, ...input.map(t => ({ ...t, id: `other:${t.id}` }))], familiar, new Set(), [], 20, () => .37);
  assert.equal(picks.length, 20);
  assert.equal(picks.filter(t => familiar.has(musicTrackIdentity(t))).length, 0);
  assert.equal(new Set(picks.map(musicTrackIdentity)).size, picks.length);
  assert.ok(picks.every((t, n) => n === 0 || t.artist !== picks[n - 1].artist));
  assert.ok(picks.every(t => picks.filter(other => other.artist === t.artist).length <= 2));
});

test("Surprise never pads a shortage with familiar songs or invalid catalog entries", () => {
  const input = tracks(), familiar = new Set(input.map(musicTrackIdentity));
  assert.deepEqual(selection.selectSurpriseTracks(input, familiar, new Set()), []);
  const invalid = [{ ...track("Video", 1), mediaKind: "video" as const }, { ...track("No duration", 2), durationSeconds: 0 }, { ...track("No artwork", 3), artwork: "" }, { ...track("Metadata", 4), id: "musicbrainz:recording:4" }, { ...track("Backing", 5), title: "Song (Karaoke)" }];
  assert.deepEqual(selection.selectSurpriseTracks(invalid, new Set(), new Set()), []);
  const excluded = new Set(input.slice(0, 16).map(musicTrackIdentity));
  const picks = selection.selectSurpriseTracks(input, new Set(), excluded, [track("Artist 4", 90)]);
  assert.ok(picks.every(t => !excluded.has(musicTrackIdentity(t))));
  assert.notEqual(picks[0].artist, "Artist 4");
});

function catalogFixture(input?: ranking.MixTaste) {
  let active = 0, peak = 0, requests = 0, genreRequests = 0;
  const gate = deferred(), abort = new AbortController();
  let hold = false, blocked = "";
  const remote = async <T,>(value: T) => { requests++; active++; peak = Math.max(peak, active); if (hold) await gate.promise; else await tick(); active--; return value; };
  const catalog = load<typeof import("../src/lib/music/surprise-catalog")>("surprise-catalog", {
    "./artist-authority": { resolveArtist: async (name: string) => remote({ canonical: { name, id: `deezer:artist:${name}` } }) },
    "./artist-popularity": { artistIdentityKey },
    "./catalog": {
      artistTop: async ({ name }: { name: string }) => remote([track(name, 20), track(name, 21), track("Wrong artist", 22), { ...track(name, 23), durationSeconds: 0 }]),
      artistRows: async ({ name }: { name: string }) => remote([{ id: "artist:related", items: [{ kind: "artist", name: `${name} neighbour`, id: `deezer:artist:${name} neighbour` }] }]),
    },
    "./daily-discovery-selection": daily,
    "./genre-artist-roster": { loadGenreArtistRoster: async () => { genreRequests++; return { artists: [{ name: "Chosen genre artist", id: "deezer:artist:genre" }], next: null }; } },
    "./made-for-you": { readMadeForYouShelf: async () => [{ tracks: [track("Cached", 1)] }] },
    "./made-for-you-selection": ranking,
    "./mix-quality": quality,
    "./playlist-neighbours": { playlistNeighbours: async (name: string) => remote([{ name: `${name} shelfmate`, id: `deezer:artist:${name} shelfmate`, connectorId: "catalog" }]) },
    "./artist-blocks": { filterBlockedTracks: (input: MusicTrack[]) => input.filter(t => t.artist !== blocked) },
    "./surprise-selection": selection,
    "./track-identity": { musicTrackIdentity },
  });
  const taste: ranking.MixTaste = { recents: [], liked: Array.from({ length: 6 }, (_, n) => track(`Taste ${n}`, 1)), followed: [], library: [], affinity: {} };
  const instance = catalog.createSurpriseCatalog(input ?? taste, [116], "me", abort.signal);
  return { instance, abort, gate, hold: () => { hold = true; }, block: (value: string) => { blocked = value; }, peak: () => peak, requests: () => requests, genreRequests: () => genreRequests };
}

test("catalog starts from the cached shelf and bounds work to two artists at once", async () => {
  const h = catalogFixture(); await h.instance.warm();
  assert.equal(h.requests(), 0); assert.ok(h.instance.candidates().some(t => t.artist === "Cached"));
  await h.instance.expand(); assert.ok(h.peak() <= 2);
  assert.equal(h.genreRequests(), 0, "known taste anchors do not wait on a genre roster");
  assert.ok(h.instance.candidates().every(t => t.artist !== "Wrong artist" && quality.isMixRecording(t)));
  h.block("Cached"); assert.ok(h.instance.candidates().every(t => t.artist !== "Cached"));
  for (let i = 0; i < 4; i++) await h.instance.expand();
  assert.ok(h.instance.candidates().some(t => t.artist.includes("neighbour")));
  assert.ok(h.peak() <= 2);
});

test("cancelled catalog fetches do not enqueue neighbours or publish later candidates", async () => {
  const h = catalogFixture(); h.hold(); const work = h.instance.expand(); await tick();
  h.abort.abort(); h.gate.resolve(); await work;
  assert.equal(h.requests(), 2); assert.ok(h.instance.candidates().every(t => t.title === "Song 1"));
});

test("playlist-only taste discovers other recordings from those artists and their neighbours", async () => {
  const library = [track("Playlist artist A", 1), track("Playlist artist B", 1)];
  const h = catalogFixture({ recents: [], liked: [], followed: [], library, affinity: {} });
  await h.instance.expand();
  assert.ok(h.instance.candidates().some(t => t.artist === "Playlist artist A" && t.title === "Song 20"));
  await h.instance.expand();
  await h.instance.expand();
  assert.ok(h.instance.candidates().some(t => t.artist.endsWith("neighbour")), "related artists reach the pool");
  assert.ok(h.instance.candidates().some(t => t.artist.endsWith("shelfmate")), "shared-playlist artists reach the pool");
  assert.ok(h.instance.candidates().every(t => !library.some(saved => musicTrackIdentity(saved) === musicTrackIdentity(t))));
});

function contextFixture(disk = new Map<string, unknown>(), readGate?: Promise<void>) {
  const react = { useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot() };
  const contexts = load<typeof import("../src/lib/music/recent-context")>("recent-context", {
    react,
    "./navigation": { requestMusicExplore: () => {} },
    "./local-store": {
      hydrateJsonStore: async () => {},
      readJsonStore: (name: string, _legacy: string, fallback: unknown) => disk.get(name) ?? fallback,
      readLocalJson: async (name: string) => { await readGate; return structuredClone(disk.get(name) ?? null); },
      writeLocalJson: (name: string, value: unknown) => disk.set(name, structuredClone(value)),
    },
    "./playlist-membership": { musicTrackKeys },
    "./track-identity": { dedupeMusicTracks },
  });
  const origin = load<typeof import("../src/lib/music/playback-origin")>("playback-origin", {
    react, "./recent-context": contexts, "./queue-order": { queueTrackKey },
  });
  return { contexts, origin, disk };
}

function sessionFixture(options: { empty?: boolean; warmGate?: Promise<void>; disk?: Map<string, unknown>; library?: MusicTrack[]; primary?: boolean } = {}) {
  automation.cancelMusicQueueAutomation();
  let profile = "me", calls = 0, pages = 0, offline = false, gate: Promise<void> | undefined;
  let pool = tracks(100);
  let transport = { repeat: "off", shuffle: false };
  const original = track("Original", 0), tail = track("Original tail", 1);
  let state: MusicPlayerState = { current: original, queue: [original, tail], queueIndex: 0, phase: "playing", currentTime: 42, duration: 180, volume: .5, error: null, recents: options.empty ? [] : [track("Artist 0", 1)], likedIds: [], likedTracks: [] };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<MusicPlayerState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const history = contextFixture(options.disk);
  const module = load<typeof import("../src/lib/music/surprise-me")>("surprise-me", {
    react: { useSyncExternalStore: (_: unknown, snapshot: () => string) => snapshot() },
    "@/lib/active-profile-id": { activeProfileId: () => profile, activeProfileIsPrimary: () => options.primary ?? false },
    "./player": {
      initializeMusic: async () => {}, getMusicState: () => state,
      subscribeMusic: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
      playMusic: async (current: MusicTrack, queue: MusicTrack[], _fail: unknown, _continue: unknown, _skip: unknown, _explicit: unknown, owner: symbol) => {
        assert.ok(automation.ownsMusicQueueAutomation(owner)); automation.markMusicQueueAutomationStarted(owner); calls++;
        update({ current, queue, queueIndex: 0, phase: "playing", currentTime: 0 });
      },
      setMusicQueue: (queue: MusicTrack[], owner?: symbol) => {
        if (owner) assert.ok(automation.ownsMusicQueueAutomation(owner)); else automation.cancelMusicQueueAutomation();
        update({ queue, queueIndex: queue.findIndex(t => musicTrackIdentity(t) === musicTrackIdentity(state.current!)) });
      },
      nextMusic: () => { const index = state.queueIndex + 1; update({ current: state.queue[index], queueIndex: index, phase: "playing", currentTime: 0 }); },
    },
    "./liked-artists": { getLikedArtists: () => [] },
    "./artist-popularity": { artistIdentityKey },
    "./daily-discovery-selection": daily,
    "./surprise-preferences": { getSurpriseBlend: () => "balanced", hydrateSurpriseBlend: async () => {} },
    "./surprise-feedback": { noteSurpriseTrack: () => {}, resetSurpriseFeedback: () => {} },
    "./listening-affinity": { hydrateListeningAffinity: async () => {}, readListeningAffinity: () => ({}) },
    "./surprise-library": { loadSurpriseLibrary: async (primary: boolean) => { assert.equal(primary, options.primary ?? false); return options.library ?? []; } },
    "./playback-origin": history.origin,
    "./recent-context": history.contexts,
    "./queue-automation": automation,
    "./surprise-catalog": { createSurpriseCatalog: () => ({
      warm: async () => options.warmGate,
      candidates: () => pool,
      expand: async () => { pages++; if (gate) await gate; if (!offline) pool.push(...tracks(100 + pages * 100)); },
      consume: (picks: MusicTrack[]) => { const keys = new Set(picks.map(musicTrackIdentity)); pool = pool.filter(t => !keys.has(musicTrackIdentity(t))); },
    }) },
    "./surprise-selection": selection,
    "./track-identity": { musicTrackIdentity },
    "./transport": { getMusicTransport: () => transport, musicUpcoming: (queue: MusicTrack[], at: number, count: number) => queue.slice(at + 1, at + 1 + count) },
  });
  return { module, update, ...history, get state() { return state; }, calls: () => calls, pages: () => pages,
    profile: (value: string) => { profile = value; update({}); },
    transport: (value: typeof transport) => { transport = value; update({}); },
    exhaust: () => { offline = true; pool = []; }, gate: (value: Promise<void>) => { gate = value; },
    skip: () => { const at = Math.min(state.queueIndex + 1, state.queue.length - 1); update({ queueIndex: at, current: state.queue[at], currentTime: 0 }); } };
}

test("stopping during discovery preserves the existing user playlist and song", async () => {
  const warm = deferred(), h = sessionFixture({ warmGate: warm.promise }), before = h.state;
  const request = h.module.startMusicSurprise([], "Surprise me"); await tick();
  assert.equal(h.module.useMusicSurprise(), "loading"); h.module.stopMusicSurprise(); warm.resolve(); await request;
  assert.equal(h.calls(), 0); assert.equal(h.state, before); assert.equal(h.module.useMusicSurprise(), "idle");
});

test("playlist and connected Spotify history recordings cannot enter the discovery queue", async () => {
  const library = tracks(100).slice(0, 12), recent = tracks(100).slice(12, 24);
  const h = sessionFixture({ library, primary: true });
  await h.module.startMusicSurprise([], "Surprise me", [{ id: "spotify:home:recently-played", title: "Recent", titleLiteral: true, source: "spotify", layout: "covers", items: recent.map(t => ({ ...t, kind: "track" })) }], true);
  const known = new Set([...library, ...recent].map(musicTrackIdentity));
  assert.ok(h.state.queue.length > 0);
  assert.ok(h.state.queue.every(t => !known.has(musicTrackIdentity(t))));
  h.module.stopMusicSurprise();
});

test("continuous listening refills early, limits queue memory and keeps previous recordings excluded", async () => {
  const h = sessionFixture(); await h.module.startMusicSurprise([], "Surprise me");
  assert.equal(h.calls(), 1); assert.equal(h.module.useMusicSurprise(), "playing");
  const heard = new Set<string>();
  for (let i = 0; i < 160; i++) {
    const key = musicTrackIdentity(h.state.current!); assert.ok(!heard.has(key), `Repeated ${key}`); heard.add(key);
    assert.ok(h.state.queue.length <= 40); h.skip(); await tick();
  }
  assert.ok(h.pages() > 0); h.module.stopMusicSurprise();
  const saved = h.contexts.heldMusicContextTracks("similar", "mix:surprise:me")!;
  assert.equal(saved.length, 100, "keep the newest 100 discoveries while the playback queue stays small");
  assert.ok(!saved.some(track => musicTrackIdentity(track) === heard.values().next().value), "old tracks roll off");
  assert.ok(saved.some(track => musicTrackIdentity(track) === musicTrackIdentity(h.state.current!)));
  assert.equal(new Set(saved.map(musicTrackIdentity)).size, saved.length);
  assert.equal(h.contexts.getMusicRecentContexts().filter(c => c.id === "mix:surprise:me").length, 1);
  assert.equal(h.state.queueIndex, h.state.queue.length - 1); assert.equal(h.module.useMusicSurprise(), "idle");
});

test("later Surprise sessions append to the same persisted mix after a cold restart", async () => {
  const first = sessionFixture();
  await first.module.startMusicSurprise([], "Surprise me");
  const original = first.contexts.heldMusicContextTracks("similar", "mix:surprise:me")!;
  first.module.stopMusicSurprise();
  const later = sessionFixture({ disk: first.disk });
  await later.module.startMusicSurprise([], "Surprise me");
  const saved = later.contexts.heldMusicContextTracks("similar", "mix:surprise:me")!;
  assert.deepEqual(saved.slice(0, original.length), original);
  assert.equal(saved.length, original.length + later.state.queue.length);
  assert.ok(later.state.queue.every(t => !original.some(old => musicTrackIdentity(old) === musicTrackIdentity(t))));
  assert.equal(later.contexts.getMusicRecentContexts().filter(c => c.id === "mix:surprise:me").length, 1);
  const recent = later.contexts.getMusicRecentContexts()[0];
  let reopened: MusicTrack[] | undefined;
  await later.contexts.reopenMusicMix(recent, request => { reopened = request.queue; });
  assert.deepEqual(reopened, saved);
  later.module.stopMusicSurprise();
});

test("Surprise history survives other mixes, dedupes provider copies and stays separate per profile", async () => {
  const h = contextFixture(); await h.contexts.hydrateMusicContextTracks();
  const a = track("First artist", 1), b = track("Second artist", 2);
  h.origin.recordMusicSimilarPlayback(a, [a], { id: "mix:surprise:one", name: "Surprise me" });
  for (let n = 0; n < 30; n++) h.contexts.rememberMusicContextTracks("similar", `other:${n}`, [b]);
  h.contexts.rememberMusicContextTracks("similar", "mix:surprise:one", [{ ...a, id: "yt:copy", connectorId: "ytmusic" }, b]);
  h.origin.recordMusicSimilarPlayback(b, [b], { id: "mix:surprise:one", name: "Surprise me" });
  h.origin.recordMusicSimilarPlayback(b, [b], { id: "mix:surprise:two", name: "Surprise me" });
  const restarted = contextFixture(h.disk);
  await restarted.contexts.hydrateMusicContextTracks();
  assert.deepEqual(restarted.contexts.heldMusicContextTracks("similar", "mix:surprise:one"), [a, b]);
  assert.deepEqual(restarted.contexts.heldMusicContextTracks("similar", "mix:surprise:two"), [b]);
  assert.equal(restarted.contexts.heldMusicContextTracks("similar", "other:0"), null);
});

test("concurrent history hydration waits for saved tracks before a new session can overwrite them", async () => {
  const gate = deferred(), a = track("Saved artist", 1);
  const h = contextFixture(new Map([["context-tracks", { "similar:mix:surprise:me": [a] }]]), gate.promise);
  const first = h.contexts.hydrateMusicContextTracks();
  let ready = false;
  const second = h.contexts.hydrateMusicContextTracks().then(() => { ready = true; });
  await tick(); assert.equal(ready, false);
  gate.resolve(); await Promise.all([first, second]);
  assert.deepEqual(h.contexts.heldMusicContextTracks("similar", "mix:surprise:me"), [a]);
});

test("old oversized Surprise snapshots are trimmed and later batches replace the oldest songs at the cap", async () => {
  const original = Array.from({ length: 180 }, (_, n) => track("Saved artist", n));
  const h = contextFixture(new Map([["context-tracks", { "similar:mix:surprise:me": original }]]));
  await h.contexts.hydrateMusicContextTracks();
  assert.deepEqual(h.contexts.heldMusicContextTracks("similar", "mix:surprise:me"), original.slice(-100));
  const additions = Array.from({ length: 12 }, (_, n) => track("New artist", n));
  h.contexts.rememberMusicContextTracks("similar", "mix:surprise:me", additions);
  const expected = [...original.slice(-88), ...additions];
  assert.deepEqual(h.contexts.heldMusicContextTracks("similar", "mix:surprise:me"), expected);
  const restarted = contextFixture(h.disk);
  await restarted.contexts.hydrateMusicContextTracks();
  assert.deepEqual(restarted.contexts.heldMusicContextTracks("similar", "mix:surprise:me"), expected);
});

test("explicit queue takeover cancels an in-flight refill without overwriting the new queue", async () => {
  const h = sessionFixture(); await h.module.startMusicSurprise([], "Surprise me");
  h.exhaust(); const wait = deferred(); h.gate(wait.promise);
  for (let i = 0; i < 7; i++) h.skip(); await tick();
  automation.cancelMusicQueueAutomation(); const manual = track("My playlist", 900);
  h.update({ current: manual, queue: [manual], queueIndex: 0 }); wait.resolve(); await tick(); await tick();
  assert.deepEqual(h.state.queue, [manual]); assert.equal(h.module.useMusicSurprise(), "idle");
});

test("repeat-one and playback ticks do not repeatedly refill; switching profiles releases the session", async () => {
  const h = sessionFixture(); await h.module.startMusicSurprise([], "Surprise me");
  h.transport({ repeat: "one", shuffle: false }); h.exhaust();
  h.update({ queueIndex: h.state.queue.length - 1, current: h.state.queue.at(-1)! });
  for (let i = 0; i < 200; i++) h.update({ currentTime: i });
  assert.equal(h.pages(), 0); h.profile("other"); assert.equal(h.module.useMusicSurprise(), "idle");
});

test("an exhausted catalog retries with a delay and never spins on player events", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const h = sessionFixture(); await h.module.startMusicSurprise([], "Surprise me"); h.exhaust();
  h.update({ queueIndex: h.state.queue.length - 1, current: h.state.queue.at(-1)! }); await tick();
  assert.equal(h.module.useMusicSurprise(), "waiting"); const before = h.pages();
  for (let i = 0; i < 200; i++) h.update({ currentTime: i });
  assert.equal(h.pages(), before); context.mock.timers.tick(15_000); await tick();
  assert.ok(h.pages() > before); h.module.stopMusicSurprise();
});

test("no taste data produces an honest empty state without touching playback", async () => {
  const h = sessionFixture({ empty: true }), before = h.state;
  await h.module.startMusicSurprise([], "Surprise me");
  assert.equal(h.state, before); assert.equal(h.module.useMusicSurprise(), "empty"); assert.equal(h.calls(), 0);
});

test("queue ownership distinguishes pending discovery from a replaced queue and rejects stale tokens", () => {
  let stopped = 0;
  const pending = automation.ownMusicQueueAutomation(() => { stopped++; });
  assert.equal(automation.cancelMusicQueueAutomation(), false); assert.equal(stopped, 1);
  const current = automation.ownMusicQueueAutomation(() => { stopped++; });
  automation.markMusicQueueAutomationStarted(current); automation.releaseMusicQueueAutomation(pending);
  assert.ok(automation.ownsMusicQueueAutomation(current)); assert.ok(automation.musicQueueAutomationStarted(current));
  assert.equal(automation.cancelMusicQueueAutomation(), true); assert.equal(stopped, 2);
});

// Execute the real player entry points in isolation; native playback below the admission
// gate is deliberately outside these cancellation/queue-edit tests.
function playerEntries() {
  const source = readFileSync(new URL("../src/lib/music/player.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile("player.ts", source, ts.ScriptTarget.Latest, true);
  const entryPoints = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ["playMusic", "enqueueMusic", "setMusicQueue"].includes(node.name?.text ?? ""));
  const module = { exports: {} }, initialized = deferred();
  const current = track("Current", 1), next = track("Next", 2);
  const state = { current, queue: [current, next], queueIndex: 0, volume: .5, recents: [], likedIds: [], likedTracks: [] };
  const sourceReady = deferred();
  const declarations = `let explicitSource=null, playRequest=0, observedPause=null, resumeAt=null, recoverPlayback=null, audioReady=null, enginePrimed=false, pendingSpeakerDevice=null, returningToComputer=false, speakerTransfer=false; const autoSkipped=new Set();`;
  const code = ts.transpileModule(declarations + entryPoints.map(node => node.getText(tree)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const scope = { ...automation, state, initializeMusic: () => initialized.promise, queueTrackKey,
    filterBlockedTracks: (tracks: MusicTrack[]) => tracks, publish: (patch: unknown) => Object.assign(state, patch),
    invoke: async () => {}, insertIntoQueue, markManuallyQueued, queueInsertIndex,
    readMusicPreference: () => null, beginMusicQueue: () => {}, resetMusicOrder: () => {},
    shouldResolvePreferredSource: () => false, clampMusicVolume: (v: number) => v,
    sourcesFor: async (t: MusicTrack) => { await sourceReady.promise; return [{ connectorId: "local", track: { ...t, id: `resolved:${t.id}`, connectorId: "local" } }]; },
    rankByExplicitness: (v: unknown) => v, explicitnessOf: () => null, adoptRequestedIdentity,
    stopCastOwner: async () => {}, ensureNativeEvents: async () => {}, updateMediaSession: () => {},
    likedIdsFor: () => [], isMusicLiked: () => false, getMusicSpeakerState: () => ({ active: false }),
    skipUnavailableTrack: () => false,
    deckAdoption: { deck: () => 0 }, require: () => ({ unhideMusicRecent: () => {} }),
  };
  new Function(...Object.keys(scope), "exports", code)(...Object.values(scope), module.exports);
  return { player: module.exports as Pick<typeof import("../src/lib/music/player"), "playMusic" | "setMusicQueue" | "enqueueMusic">, state, initialized, sourceReady };
}

test("the actual player rejects stale automation before initialization and before queue mutation", async () => {
  const h = playerEntries(), before = h.state.queue;
  const owner = automation.ownMusicQueueAutomation(() => {});
  const pending = h.player.playMusic(track("Late discovery", 3), [], new Set(), false, true, false, owner);
  automation.cancelMusicQueueAutomation(); h.initialized.resolve(); await pending;
  h.player.setMusicQueue([track("Late refill", 4)], owner);
  assert.equal(h.state.queue, before);
});

test("actual manual enqueue preserves a pending user's queue and replaces an active automated tail", () => {
  const h = playerEntries(), manual = track("Manual", 3), oldTail = h.state.queue[1];
  automation.ownMusicQueueAutomation(() => {}); h.player.enqueueMusic(manual);
  assert.ok(h.state.queue.includes(oldTail), "pending recommendations have not taken ownership of the queue");
  const owner = automation.ownMusicQueueAutomation(() => {}); automation.markMusicQueueAutomationStarted(owner);
  const chosen = track("My choice", 4); h.player.enqueueMusic(chosen);
  assert.deepEqual(h.state.queue, [h.state.current, chosen]); assert.ok(!automation.ownsMusicQueueAutomation(owner));
});

test("an explicit play request cancels recommendations before its own asynchronous initialization", () => {
  const h = playerEntries(), owner = automation.ownMusicQueueAutomation(() => {});
  void h.player.playMusic(track("My album", 6));
  assert.ok(!automation.ownsMusicQueueAutomation(owner));
});

test("a late source resolution preserves a queue edited after Surprise playback was admitted", async () => {
  const h = playerEntries(), first = track("Surprise", 8), tail = track("Automatic tail", 9);
  const owner = automation.ownMusicQueueAutomation(() => {});
  const pending = h.player.playMusic(first, [first, tail], new Set(), false, true, false, owner);
  h.initialized.resolve(); await tick();
  assert.ok(automation.musicQueueAutomationStarted(owner));
  h.player.setMusicQueue([first]); h.sourceReady.resolve(); await pending;
  assert.equal(h.state.queue.length, 1); assert.equal(h.state.queue[0].title, first.title);
  assert.equal(h.state.current.id, `resolved:${first.id}`);
});
