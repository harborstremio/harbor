import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, mocks) {
  const source = readFileSync(new URL(`../src/lib/music/${file}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "navigator", outputText)((name) => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
    return mocks[name];
  }, module, module.exports, {});
  return module.exports;
}

const saved = Array.from({ length: 10 }, (_, index) => ({
  id: `song-${index + 1}`, connectorId: "local", title: `Song ${index + 1}`, artist: "Artist",
  artwork: "", durationSeconds: 180, durationLabel: "3:00", sourceId: `C:/Music/${index + 1}.flac`,
}));

function fixture({ preferred = null, candidates = [] } = {}) {
  const events = new Map();
  const calls = [];
  const noop = () => {};
  const react = { useSyncExternalStore: (_subscribe, read) => read() };
  const sourceRequest = load("source-request", {
    react,
    "./now-playing-key": load("now-playing-key", {}),
  });
  const player = load("player", {
    "@/lib/active-profile-id": { activeProfileId: () => "test", activeProfileIsPrimary: () => true },
    "./listening-affinity": { observeMusicListening: noop, hydrateListeningAffinity: async () => {} },
    "./artist-blocks": { filterBlockedTracks: tracks => tracks, hydrateArtistBlockStore: async () => {} },
    "./liked-artists": { hydrateLikedArtistStore: async () => {} },
    "./recent-context": { hydrateMusicContextTracks: async () => {}, hydrateMusicRecentContexts: async () => {} },
    "./recent-destinations": { hydrateMusicDestinations: async () => {} },
    "./source-consent": { hydrateMusicSourceConsent: async () => {} },
    "./source-version": load("source-version", {}),
    "./queue-source": load("queue-source", {}),
    "./transport": { resetMusicOrder: noop, musicWarmTargets: () => [], musicAdvance: () => null, musicPrevious: () => null },
    "./liked": load("liked", {}),
    "./track-identity": {
      sameMusicTrack: (a, b) => a.id === b.id,
      dedupeMusicTracks: tracks => tracks,
    },
    "./queue-order": load("queue-order", {}),
    "./deck-sync": {
      answerDeckRequests: noop, broadcastDeckState: noop, isDeckWindow: () => false,
      sendDeckAdopted: noop, sendDeckCommand: noop, serveDeckCommands: noop,
    },
    "./deck-primary": { createDeckAdoption: () => ({ deck: () => 0, adopt: () => false }) },
    "./queue-insert": {},
    "@tauri-apps/api/core": { invoke: async (command, args) => {
      calls.push({ command, args });
      if (command === "music_db_init") return {
        likedIds: saved.map(track => track.id), likedTracks: saved, recents: [], queue: [],
      };
      if (command === "music_source_candidates") return candidates;
    } },
    "@tauri-apps/api/event": { listen: async (name, callback) => {
      events.set(name, callback);
      return noop;
    } },
    react,
    "./preferences": { readMusicPreference: key => key === "harbor.music.preferred-source.v1" ? preferred : null, writeMusicPreference: noop },
    "./audio-settings": {
      clampMusicVolume: volume => volume, initializeMusicAudioSettings: async () => {},
      subscribeMusicAudioSettings: noop,
    },
    "./session-checkpoint": {
      newerCheckpoint: () => null, readCheckpointFromDb: async () => null,
      usableCheckpointPosition: () => 0, writeCheckpointToDb: noop,
    },
    "./playback-origin": {
      beginMusicQueue: noop, getMusicPlaybackOrigin: () => null, restoreMusicPlaybackOrigin: noop,
    },
    "@/lib/cast-ownership": { stopCastOwner: async () => {} },
    "./casting": { getMusicSpeakerState: () => ({ active: false }), subscribeMusicSpeakerState: noop },
    "./hidden-recents": { unhideMusicRecent: noop },
  });
  const hook = load("use-collection-playback", {
    "./source-request": sourceRequest,
    "./player": player,
    "@/components/music/music-queue": { useMusicTransport: () => ({ shuffle: false }) },
  });
  return {
    player, calls, sourceRequest,
    collection: tracks => hook.useCollectionPlayback(tracks, () => {}),
    controls: () => hook.useCollectionPlayback(player.getMusicState().likedTracks, () => {
      assert.fail("The active Saved collection must toggle playback, not start a new queue");
    }),
    event: payload => events.get("music://event")?.({ payload }),
  };
}

test("playing the eighth saved song preserves its position while refreshing its metadata", async () => {
  const { player } = fixture();
  const refreshed = { ...saved[7], artwork: "https://example.test/refreshed.jpg" };
  await player.playMusic(refreshed, saved);
  const state = player.getMusicState();
  assert.equal(state.error, null);
  assert.deepEqual(state.likedTracks.map(track => track.id), saved.map(track => track.id));
  assert.equal(state.likedTracks[7].artwork, refreshed.artwork);
  assert.equal(state.queueIndex, 7);
  assert.equal(state.recents[0].id, saved[7].id);
});

test("Saved controls recognize a row-started queue and pause/resume without restarting", async () => {
  const { player, controls, event, calls } = fixture();
  await player.playMusic({ ...saved[7], collectionOrigin: { id: saved[7].id, connectorId: "local" } }, saved);
  assert.equal(controls().busy, true);
  event({ event: "file-loaded" });
  assert.equal(controls().playing, true);
  controls().play();
  event({ event: "property-change", name: "pause", data: true });
  assert.equal(controls().playing, false);
  controls().play();
  assert.equal(player.getMusicState().current.id, saved[7].id);
  assert.equal(player.getMusicState().queueIndex, 7);
  assert.equal(calls.filter(call => call.command === "music_engine_pause").length, 2);
});

test("collection controls become busy immediately during source lookup and clear on cancellation", () => {
  const { collection, sourceRequest } = fixture();
  const finish = sourceRequest.beginMusicSourceRequest(saved[7]);
  assert.equal(collection(saved).busy, true);
  assert.equal(collection(saved.slice(0, 3)).busy, false);
  const newer = sourceRequest.beginMusicSourceRequest(saved[1]);
  finish();
  assert.equal(collection(saved.slice(0, 3)).busy, true);
  newer();
  assert.equal(collection(saved).busy, false);
});

const requested = { ...saved[0], id: "soundcloud:original", connectorId: "soundcloud", sourceId: "original", title: "KEEP GOING", artist: "DJ Khaled", artwork: "original-cover.jpg" };
const candidate = (id, title, connectorId = "youtube", health = "healthy") => ({
  connectorId, connectorName: connectorId, health,
  track: { ...requested, id, sourceId: id, connectorId, title, artist: "Uploader", artwork: "upload.jpg" },
});

test("provider playback chooses the preferred vocal recording and preserves the requested song credit", async () => {
  const { player, calls } = fixture({ preferred: "youtube", candidates: [
    candidate("backing", "KEEP GOING (Instrumental)"),
    candidate("karaoke", "KEEP GOING (Karaoke)"),
    candidate("other", "KEEP GOING", "tidal"),
    candidate("vocal", "DJ Khaled - KEEP GOING (Official Audio)"),
  ] });
  await player.playMusic(requested);
  assert.equal(player.getMusicState().error, null);
  const playing = player.getMusicState().current;
  assert.equal(playing.id, "vocal");
  assert.equal(playing.connectorId, "youtube");
  assert.equal(playing.title, requested.title);
  assert.equal(playing.artist, requested.artist);
  assert.equal(playing.artwork, requested.artwork);
  assert.equal(playing.collectionOrigin.id, requested.id);
  assert.equal(player.getMusicState().queue[0].id, "vocal");
  assert.ok(calls.some(call => call.command === "music_play_track" && call.args.track.id === "vocal"));
});

test("unavailable preferred vocals do not replace an existing song with an instrumental", async () => {
  const { player } = fixture({ preferred: "youtube", candidates: [
    candidate("backing", "KEEP GOING - Instrumental"),
    candidate("offline", "KEEP GOING", "youtube", "offline"),
  ] });
  await player.playMusic(requested);
  assert.equal(player.getMusicState().error, null);
  assert.equal(player.getMusicState().current.id, requested.id);
});

test("an explicit source choice bypasses the automatic preference", async () => {
  const { player, calls } = fixture({ preferred: "youtube", candidates: [candidate("vocal", "KEEP GOING")] });
  await player.playMusic(requested, [requested], new Set(), false, false, true);
  assert.equal(player.getMusicState().current.id, requested.id);
  assert.equal(calls.filter(call => call.command === "music_source_candidates").length, 0);
});
