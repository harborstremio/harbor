import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { readMusicPreference, writeMusicPreference } from "../src/lib/music/preferences.ts";
import { MusicQueueOrder, queueTrackKey } from "../src/lib/music/queue-order.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

type Preferences = typeof import("../src/lib/music/preferences.ts");
type Player = typeof import("../src/lib/music/player.ts");
type Transport = typeof import("../src/components/music/music-queue.tsx");

// Exercise the real stores with native and React boundaries stubbed, as in updater tests.
function load<T>(
  path: string,
  mocks: Record<string, unknown>,
  globals: Record<string, unknown>,
): T {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  const require = (name: string) => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
    return mocks[name];
  };
  new Function("require", "module", "exports", ...Object.keys(globals), outputText)(
    require,
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports as T;
}

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const removed: string[] = [];
  return {
    values,
    removed,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      removed.push(key);
      values.delete(key);
    },
  };
}

function preferences(localStorage: unknown) {
  return load<Preferences>("src/lib/music/preferences.ts", {}, { localStorage });
}

const track: MusicTrack = {
  id: "saved-track",
  title: "Saved track",
  artist: "Artist",
  artwork: "",
  durationSeconds: 120,
  durationLabel: "2:00",
};

function player(localStorage: unknown) {
  const calls: { command: string; args: any }[] = [];
  const bootstrap = {
    likedIds: [track.id],
    likedTracks: [track],
    recents: [track],
    queue: [track],
  };
  const prefs = preferences(localStorage);
  const store = load<Player>(
    "src/lib/music/player.ts",
    {
      "@/lib/cast-ownership": { stopCastOwner: async () => {} },
      "@tauri-apps/api/core": {
        invoke: async (command: string, args: any) => {
          calls.push({ command, args });
          if (command === "music_db_init") return bootstrap;
        },
      },
      "@tauri-apps/api/event": { listen: async () => () => {} },
      react: {},
      "./catalog": {},
      "./queue-order": { MusicQueueOrder, queueTrackKey },
      "./liked": {
        isMusicLiked: (ids: readonly string[], t: any) => !!t && ids.includes(t.id),
        likedIdsFor: (t: any) => (t ? [t.id] : []),
        withoutLiked: (ids: readonly string[], t: any) => ids.filter((id: string) => id !== t.id),
      },
      "./source-consent": { musicSourceAllowed: () => true, requestMusicSourceConsent: () => {} },
      "./queue-insert": {
        insertIntoQueue: (q: unknown[], t: unknown, at: number) => [
          ...q.slice(0, at),
          t,
          ...q.slice(at),
        ],
        markManuallyQueued: () => {},
        queueInsertIndex: (q: unknown[], i: number) => (i < 0 ? 0 : i + 1),
      },
      "./session-checkpoint": {
        newerCheckpoint: () => null,
        readCheckpointFromDb: async () => null,
        usableCheckpointPosition: () => 0,
        writeCheckpointToDb: () => {},
      },
      "./playback-origin": {
        getMusicPlaybackOrigin: () => null,
        restoreMusicPlaybackOrigin: () => {},
      },
      "./preferences": prefs,
      "./hidden-recents": { unhideMusicRecent: () => {} },
      "./audio-settings": {
        initializeMusicAudioSettings: async () => {},
        clampMusicVolume: (value: number) => Math.max(0, Math.min(1, value)),
        subscribeMusicAudioSettings: () => () => {},
      },
      "./casting": {
        getMusicSpeakerState: () => ({ active: false }),
        subscribeMusicSpeakerState: () => () => {},
      },
    },
    {
      localStorage,
      navigator: {},
      window: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      },
      document: { addEventListener: () => {}, hidden: false },
    },
  );
  return { store, calls, prefs };
}

test("quota failure retains the latest source preference without deleting user data", () => {
  const key = "harbor.music.preferred-source.v1";
  const browser = storage({ [key]: "youtube", "harbor.history": "keep" });
  browser.setItem = () => {
    throw new DOMException("Full", "QuotaExceededError");
  };
  const prefs = preferences(browser);
  assert.equal(prefs.readMusicPreference(key), "youtube");
  assert.doesNotThrow(() => prefs.writeMusicPreference(key, "spotify"));
  assert.equal(prefs.readMusicPreference(key), "spotify");
  assert.equal(browser.values.get(key), "youtube");
  assert.equal(browser.values.get("harbor.history"), "keep");
  assert.deepEqual(browser.removed, []);

  browser.setItem = (name, value) => {
    browser.values.set(name, value);
  };
  prefs.writeMusicPreference(key, "local");
  assert.equal(browser.values.get(key), "local");
  assert.equal(prefs.readMusicPreference(key), "local");
});

test("a denied localStorage getter still supports preferences for this session", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  try {
    const key = "harbor.music.denied-test";
    assert.equal(readMusicPreference(key), null);
    assert.doesNotThrow(() => writeMusicPreference(key, "spotify"));
    assert.equal(readMusicPreference(key), "spotify");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("preferences retain the last readable value when reads become blocked", () => {
  const browser = storage({ repeat: "all" });
  const prefs = preferences(browser);
  assert.equal(prefs.readMusicPreference("repeat"), "all");
  browser.getItem = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  assert.equal(prefs.readMusicPreference("repeat"), "all");
  assert.equal(prefs.readMusicPreference("missing"), null);
  assert.equal(preferences(undefined).readMusicPreference("missing"), null);
});

test("denied reads preserve SQLite data and allow playback with the default volume", async () => {
  const browser = storage();
  browser.getItem = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  const { store, calls } = player(browser);
  assert.equal(store.getMusicState().volume, 0.82);
  await store.initializeMusic();
  assert.deepEqual(calls[0], { command: "music_db_init", args: { migration: null } });
  assert.deepEqual(store.getMusicState().likedIds, [track.id]);
  assert.deepEqual(store.getMusicState().recents, [track]);
  assert.deepEqual(store.getMusicState().queue, [track]);
  await store.playMusic(track);
  assert.ok(calls.some(({ command }) => command === "music_play_track"));
  assert.equal(store.getMusicState().error, null);
  assert.deepEqual(browser.removed, []);
});

test("quota failure still publishes volume and sends it to the native music engine", () => {
  const browser = storage({ "harbor.music.volume.v1": "0.4" });
  browser.setItem = () => {
    throw new DOMException("Full", "QuotaExceededError");
  };
  const { store, calls, prefs } = player(browser);
  let updates = 0;
  store.subscribeMusic(() => {
    updates += 1;
  });
  assert.equal(store.getMusicState().volume, 0.4);
  assert.doesNotThrow(() => store.setMusicVolume(0.65));
  assert.equal(store.getMusicState().volume, 0.65);
  assert.equal(updates, 1);
  assert.equal(prefs.readMusicPreference("harbor.music.volume.v1"), "0.65");
  assert.deepEqual(calls, [{ command: "music_engine_set_volume", args: { volume: 0.65 } }]);
});

test("failed legacy cleanup cannot suppress a successful SQLite bootstrap", async () => {
  const browser = storage({ "harbor.music.liked.v1": JSON.stringify([track.id]) });
  browser.removeItem = (key) => {
    browser.removed.push(key);
    throw new DOMException("Blocked", "SecurityError");
  };
  const { store, calls } = player(browser);
  await store.initializeMusic();
  assert.deepEqual(calls[0].args.migration, { likedIds: [track.id], recents: null, queue: null });
  assert.deepEqual(browser.removed, ["harbor.music.liked.v1"]);
  assert.equal(store.getMusicState().phase, "paused");
  assert.equal(store.getMusicState().error, null);
  assert.deepEqual(store.getMusicState().queue, [track]);
});

test("shuffle and repeat notify controls and guide queue advancement when storage is blocked", () => {
  const browser = storage();
  browser.getItem = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  browser.setItem = () => {
    throw new DOMException("Full", "QuotaExceededError");
  };
  const prefs = preferences(browser);
  const listeners = new Set<() => void>();
  let advance: Parameters<Player["setMusicAdvance"]>[0];
  const transport = load<Transport>(
    "src/components/music/music-queue.tsx",
    {
      react: {
        useSyncExternalStore: (
          subscribe: (listener: () => void) => () => void,
          get: () => unknown,
        ) => {
          subscribe(() => {
            for (const listener of listeners) listener();
          });
          return get();
        },
      },
      "react/jsx-runtime": {},
      "react-dom": {},
      "lucide-react": {},
      "@/components/poster": {},
      "./music-service-logo": {},
      "./music-track-labels": {},
      "./music-queue.css": {},
      "@/lib/i18n": {},
      "@/lib/music/player": {
        setMusicAdvance: (next: typeof advance) => {
          advance = next;
        },
      },
      "@/lib/music/queue-order": { MusicQueueOrder, queueTrackKey },
      "@/lib/music/preferences": prefs,
      "@/lib/music/sources": { getMusicSourceCandidates: () => Promise.resolve([]) },
      "@/lib/music/queue-source": {
        replaceQueueTrack: (queue: unknown) => queue,
        selectableSources: () => [],
      },
    },
    {},
  );
  assert.deepEqual(transport.useMusicTransport(), { shuffle: false, repeat: "off" });
  let updates = 0;
  listeners.add(() => {
    updates += 1;
  });
  assert.doesNotThrow(() => transport.toggleMusicShuffle());
  assert.doesNotThrow(() => transport.cycleMusicRepeat());
  assert.equal(updates, 2);
  assert.deepEqual(transport.useMusicTransport(), { shuffle: true, repeat: "all" });
  assert.equal(prefs.readMusicPreference("harbor.music.shuffle.v1"), "1");
  assert.equal(prefs.readMusicPreference("harbor.music.repeat.v1"), "all");
  const next = { ...track, id: "next" };
  assert.equal(advance!([track, next], 0, true), next);
  transport.cycleMusicRepeat();
  assert.equal(advance!([track, next], 0, true), track);
  assert.deepEqual(browser.removed, []);
});
