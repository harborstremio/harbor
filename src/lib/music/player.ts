import { compatibleVocalVersion, shouldResolvePreferredSource } from "./source-version";
import { cancelMusicQueueAutomation, markMusicQueueAutomationStarted, ownsMusicQueueAutomation } from "./queue-automation";
import { activeProfileId, activeProfileIsPrimary } from "@/lib/active-profile-id";
import { hydrateListeningAffinity, observeMusicListening } from "./listening-affinity";
import { filterBlockedTracks, hydrateArtistBlockStore } from "./artist-blocks";
import { isMusicLiked, likedIdsFor, withoutLiked } from "./liked";
import { hydrateLikedArtistStore } from "./liked-artists";
import { dedupeMusicTracks, sameMusicTrack } from "./track-identity";
import {
  answerDeckRequests,
  broadcastDeckState,
  isDeckWindow,
  sendDeckAdopted,
  sendDeckCommand,
  serveDeckCommands,
} from "./deck-sync";
import { createDeckAdoption } from "./deck-primary";
import { insertIntoQueue, markManuallyQueued, queueInsertIndex } from "./queue-insert";
import { queueTrackKey } from "./queue-order";
import { adoptRequestedIdentity } from "./queue-source";
import { explicitnessOf, rankByExplicitness } from "./explicit-preference";
import {
  loadPinnedSources,
  peekPinnedSource,
  pinSourceFor,
  unpinSourceFor,
} from "./pinned-sources";
import { musicAdvance, musicPrevious, musicWarmTargets, resetMusicOrder } from "./transport";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import {
  clampMusicVolume,
  initializeMusicAudioSettings,
  subscribeMusicAudioSettings,
} from "./audio-settings";
import {
  newerCheckpoint,
  readCheckpointFromDb,
  usableCheckpointPosition,
  writeCheckpointToDb,
  type MusicCheckpoint,
} from "./session-checkpoint";
import { beginMusicQueue, getMusicPlaybackOrigin, restoreMusicPlaybackOrigin } from "./playback-origin";
import { hydrateMusicContextTracks, hydrateMusicRecentContexts } from "./recent-context";
import { hydrateMusicDestinations } from "./recent-destinations";
import { hydrateMusicSourceConsent } from "./source-consent";
import type {
  MusicAudioQuality,
  MusicPlayerState,
  MusicTrack,
  MusicSourceCandidate,
} from "./types";
import type { CastDeviceInfo } from "@/lib/cast";
import { stopCastOwner } from "@/lib/cast-ownership";
import { isWindowsDesktop } from "@/lib/platform";
import {
  getMusicSpeakerState,
  loadMusicOnSpeaker,
  pauseMusicSpeaker,
  playMusicSpeaker,
  refreshMusicSpeakerStatus,
  seekMusicSpeaker,
  stopMusicSpeaker,
  subscribeMusicSpeakerState,
} from "./casting";

const LIKED_KEY = "harbor.music.liked.v1";
const RECENTS_KEY = "harbor.music.recents.v1";
const QUEUE_KEY = "harbor.music.queue.v1";
const SESSION_KEY = "harbor.music.session.v1";
let lastSessionWrite = 0;
const VOLUME_KEY = "harbor.music.volume.v1";
const listeners = new Set<() => void>();
let playRequest = 0;
let nativeEventsReady: Promise<void> | null = null;
let endHandledAt = 0;
let enginePrimed = false;
const autoSkipped = new Set<string>();
let recoverPlayback: ((message?: string) => void) | null = null;
let activeProfile = "";
let audioReady: {
  request: number;
  id: string;
  connectorId?: string;
  done: Promise<boolean>;
} | null = null;
let speakerTransfer = false;
let pendingSpeakerDevice: CastDeviceInfo | null = null;
let returningToComputer = false;
let speakerPoll: ReturnType<typeof setTimeout> | null = null;
let speakerWasActive = false;
let resumeAt: { key: string; position: number } | null = null;
// The pause the engine last reported for the load now opening. It arrives while the phase is
// still "resolving", which is too early to be a phase of its own, so it is kept until the file
// opens.
let observedPause: boolean | null = null;
const queuedSources = new Map<
  string,
  { until: number; promise: Promise<MusicSourceCandidate[]> }
>();
const SOURCE_TTL_MS = 120_000;
const PRELOAD_TTL_MS = 1_200_000;
const SOURCE_CACHE_MAX = 16;
function sourcesFor(
  track: MusicTrack,
  ttlMs: number = SOURCE_TTL_MS,
  fresh = false,
): Promise<MusicSourceCandidate[]> {
  const key = `${track.connectorId}:${track.id}:${track.title}:${track.artist}`;
  if (fresh) queuedSources.delete(key);
  const saved = queuedSources.get(key);
  if (saved && saved.until > Date.now()) return saved.promise;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("music.source.none")), 12000);
  });
  const promise = Promise.race([
    invoke<MusicSourceCandidate[]>("music_source_candidates", { track }),
    timeout,
  ])
    .then((value) => (Array.isArray(value) ? value.filter(candidate => compatibleVocalVersion(track, candidate.track)) : []))
    .catch((error) => {
      queuedSources.delete(key);
      throw error;
    })
    .finally(() => clearTimeout(timer));
  queuedSources.set(key, { until: Date.now() + ttlMs, promise });
  while (queuedSources.size > SOURCE_CACHE_MAX)
    queuedSources.delete(queuedSources.keys().next().value!);
  return promise;
}

const warmed = new Map<string, number>();
const WARM_AGAIN_MS = 600_000;
const NEAR_END_MS = 45_000;
let warmTimer: ReturnType<typeof setTimeout> | null = null;
let nearEndKey: string | null = null;

function warmNeighbours(): void {
  if (warmTimer) return;
  warmTimer = setTimeout(() => {
    warmTimer = null;
    const around = musicWarmTargets(state.queue, state.queueIndex, 3);
    const now = Date.now();
    for (const track of around) {
      if (!track) continue;
      const key = `${track.connectorId ?? ""}:${track.id}`;
      const last = warmed.get(key);
      if (last !== undefined && now - last < WARM_AGAIN_MS) continue;
      warmed.set(key, now);
      if (warmed.size > 24) warmed.delete(warmed.keys().next().value!);
      void invoke("music_prewarm_track", { track }).catch(() => {});
      void sourcesFor(track, PRELOAD_TTL_MS).catch(() => {});
    }
  }, 400);
}

function warmBeforeEnd(): void {
  const total = state.duration;
  if (!total || total <= 0 || !state.current) return;
  if ((total - state.currentTime) * 1000 > NEAR_END_MS) return;
  const key = `${state.current.connectorId ?? ""}:${state.current.id}`;
  if (nearEndKey === key) return;
  nearEndKey = key;
  warmNeighbours();
}

export function musicSourceCandidates(track: MusicTrack): Promise<MusicSourceCandidate[]> {
  return sourcesFor(track).catch(() => [] as MusicSourceCandidate[]);
}

type LegacyMusicMigration = {
  likedIds: string[] | null;
  recents: MusicTrack[] | null;
  queue: MusicTrack[] | null;
};

type NativeMusicBootstrap = {
  likedIds: string[];
  likedTracks: MusicTrack[];
  recents: MusicTrack[];
  queue: MusicTrack[];
};

let initialization: Promise<void> | null = null;

type MpvEvent =
  | { event: "property-change"; name: string; data: unknown }
  | { event: "end-file"; reason?: string }
  | { event: "file-loaded" }
  | { event: string; [key: string]: unknown };

type LastFmEvent = {
  status: "scrobbled" | "error";
  message?: string;
};

function readOptionalArray<T>(key: string): T[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // An unreadable legacy key must not replace existing SQLite data with an empty array.
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readVolume(): number {
  const parsed = Number(readMusicPreference(VOLUME_KEY) ?? "0.82");
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.82;
}

let state: MusicPlayerState = {
  phase: "idle",
  current: null,
  queue: [],
  queueIndex: -1,
  currentTime: 0,
  duration: 0,
  volume: readVolume(),
  error: null,
  scrobbleError: null,
  likedIds: [],
  likedTracks: [],
  recents: [],
};

function currentCheckpoint(): MusicCheckpoint | null {
  const current = state.current;
  if (!current) return null;
  return {
    key: queueTrackKey(current),
    sourceKey: `${current.connectorId ?? ""}:${current.id}`,
    position: state.currentTime,
    origin: getMusicPlaybackOrigin(),
    savedAt: Date.now(),
  };
}

/** Written to both stores: IndexedDB survives a full localStorage, localStorage survives an unload. */
function saveMusicCheckpoint(): void {
  const checkpoint = currentCheckpoint();
  writeCheckpointToDb(checkpoint);
  writeMusicPreference(SESSION_KEY, JSON.stringify(checkpoint));
}

if (typeof window !== "undefined") {
  // A throttled checkpoint can be up to two seconds stale, so closing flushes the exact position.
  const flush = () => {
    if (state.current) saveMusicCheckpoint();
  };
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flush();
  });
}

function publish(patch: Partial<MusicPlayerState>): void {
  state = { ...state, ...patch };
  if (patch.currentTime !== undefined || patch.current !== undefined || patch.phase !== undefined) {
    observeMusicListening(state, `${activeProfile}:${playRequest}`, activeProfile);
  }
  if (
    patch.current !== undefined ||
    patch.phase === "paused" ||
    (patch.currentTime !== undefined && Date.now() - lastSessionWrite > 2000)
  ) {
    lastSessionWrite = Date.now();
    saveMusicCheckpoint();
  }
  broadcastDeckState(state);
  if (patch.current !== undefined || patch.queueIndex !== undefined || patch.queue !== undefined) {
    nearEndKey = null;
    warmNeighbours();
  }
  if (patch.currentTime !== undefined) warmBeforeEnd();
  for (const listener of listeners) listener();
}

function readLegacyMigration(): LegacyMusicMigration | null {
  const migration = {
    likedIds: readOptionalArray<string>(LIKED_KEY),
    recents: readOptionalArray<MusicTrack>(RECENTS_KEY),
    queue: readOptionalArray<MusicTrack>(QUEUE_KEY),
  };
  return migration.likedIds === null && migration.recents === null && migration.queue === null
    ? null
    : migration;
}

function clearLegacyMigration(migration: LegacyMusicMigration | null): void {
  if (!migration) return;
  const migratedKeys = [
    migration.likedIds !== null ? LIKED_KEY : null,
    migration.recents !== null ? RECENTS_KEY : null,
    migration.queue !== null ? QUEUE_KEY : null,
  ];
  for (const key of migratedKeys) {
    if (key === null) continue;
    try {
      localStorage.removeItem(key);
    } catch {
      // SQLite initialization succeeded; unavailable legacy storage must not hide that result.
    }
  }
}

export function resetMusicForProfile(): void {
  if (!initialization && activeProfile === activeProfileId()) return;
  cancelMusicQueueAutomation();
  activeProfile = activeProfileId();
  initialization = null;
  enginePrimed = false;
  audioReady = null;
  recoverPlayback = null;
  publish({
    current: null,
    queue: [],
    queueIndex: -1,
    currentTime: 0,
    duration: 0,
    phase: "idle",
    error: null,
    scrobbleError: null,
    likedIds: [],
    likedTracks: [],
    recents: [],
  });
  void initializeMusic();
}

export function initializeMusic(): Promise<void> {
  void initializeMusicAudioSettings();
  if (initialization) return initialization;
  activeProfile = activeProfileId();
  const migration = readLegacyMigration();
  void hydrateListeningAffinity(activeProfile).catch(() => {});
  void hydrateMusicContextTracks().catch(() => {});
  void hydrateMusicRecentContexts().catch(() => {});
  void hydrateMusicDestinations().catch(() => {});
  void hydrateLikedArtistStore().catch(() => {});
  void hydrateArtistBlockStore().catch(() => {});
  void hydrateMusicSourceConsent().catch(() => {});
  void loadPinnedSources();
  initialization = Promise.all([
    invoke<NativeMusicBootstrap>("music_db_init", {
      migration,
      profile: activeProfileIsPrimary() ? null : activeProfile,
    }),
    readCheckpointFromDb().catch(() => null),
  ])
    .then(([bootstrap, stored]) => {
      clearLegacyMigration(migration);
      let mirrored: MusicCheckpoint | null = null;
      try {
        mirrored = JSON.parse(readMusicPreference(SESSION_KEY) ?? "null");
      } catch {
        /* A corrupt checkpoint does not block the library. */
      }
      const saved = newerCheckpoint(stored, mirrored);
      if (saved?.origin) restoreMusicPlaybackOrigin(saved.origin);
      const restoredIndex = saved?.key
        ? bootstrap.queue.findIndex(
            (track) =>
              queueTrackKey(track) === saved?.key ||
              `${track.connectorId ?? ""}:${track.id}` === saved?.sourceKey,
          )
        : -1;
      const index = restoredIndex >= 0 ? restoredIndex : 0;
      const current = bootstrap.queue[index] ?? null;
      const position =
        restoredIndex >= 0
          ? usableCheckpointPosition(saved?.position, current?.durationSeconds)
          : 0;
      publish({
        phase: current ? "paused" : "idle",
        current,
        queue: bootstrap.queue,
        queueIndex: current ? index : -1,
        currentTime: position,
        duration: current?.durationSeconds ?? 0,
        error: null,
        likedIds: completeLikedIds(bootstrap.likedIds, bootstrap.likedTracks),
        likedTracks: bootstrap.likedTracks,
        recents: dedupeMusicTracks(bootstrap.recents),
      });
    })
    .catch((error) => {
      initialization = null;
      publish({
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return initialization;
}

function updateMediaSession(track: MusicTrack): void {
  // Windows uses the shared native session, including its focus/ownership rules.
  if (isWindowsDesktop()) return;
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album ?? "Harbor Music",
    artwork: track.artwork ? [{ src: track.artwork, sizes: "544x544" }] : [],
  });
}

const deckAdoption = createDeckAdoption({
  read: getMusicState,
  publish,
  announce: updateMediaSession,
  ended: () => {
    if (Date.now() - endHandledAt <= 1200) return;
    endHandledAt = Date.now();
    nextMusic(true);
  },
});

function handlePlaybackEvent(payload: MpvEvent): void {
  if (
    "trackId" in payload &&
    payload.trackId &&
    (payload.trackId !== state.current?.id ||
      ("connectorId" in payload && payload.connectorId !== (state.current?.connectorId ?? null)))
  )
    return;
  if (payload.event === "audio-quality") {
    const current = state.current;
    if (
      !current ||
      payload.trackId !== current.id ||
      payload.connectorId !== (current.connectorId ?? null) ||
      !payload.quality ||
      typeof payload.quality !== "object" ||
      Array.isArray(payload.quality)
    )
      return;
    const measured = payload.quality as Record<string, unknown>;
    const quality: MusicAudioQuality = {};
    if (typeof measured.codec === "string" && measured.codec.length <= 80)
      quality.codec = measured.codec;
    for (const key of ["sampleRateHz", "bitDepth", "bitrateKbps"] as const) {
      const value = measured[key];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) quality[key] = value;
    }
    const update = (track: MusicTrack): MusicTrack =>
      track.id === current.id && (track.connectorId ?? null) === (current.connectorId ?? null)
        ? { ...track, quality }
        : track;
    publish({
      current: update(current),
      queue: state.queue.map(update),
      recents: state.recents.map(update),
      likedTracks: state.likedTracks.map(update),
    });
    return;
  }
  if (payload.event === "property-change") {
    if (payload.name === "time-pos" && typeof payload.data === "number") {
      if (payload.data >= 2 && state.phase === "playing") autoSkipped.clear();
      publish({ currentTime: payload.data });
    }
    if (payload.name === "duration" && typeof payload.data === "number")
      publish({ duration: payload.data });
    if (payload.name === "pause" && typeof payload.data === "boolean") {
      observedPause = payload.data;
      if (state.phase === "playing" || state.phase === "paused")
        publish({ phase: payload.data ? "paused" : "playing" });
    }
    if (payload.name === "volume" && typeof payload.data === "number")
      publish({ volume: payload.data / 100 });
    return;
  }
  if (payload.event === "file-loaded") {
    publish({ phase: observedPause ? "paused" : "playing", error: null });
    if (resumeAt && state.current && resumeAt.key === queueTrackKey(state.current)) {
      const position = resumeAt.position;
      resumeAt = null;
      seekMusic(position);
    }
    return;
  }
  if (payload.event === "player-failure") {
    if (!ownsMusicVideo() && recoverPlayback) {
      recoverPlayback(typeof payload.reason === "string" ? payload.reason : undefined);
      return;
    }
    enginePrimed = false;
    publish({
      phase: "error",
      error:
        typeof payload.reason === "string" ? payload.reason : "Music playback could not start.",
    });
    return;
  }
  if (payload.event === "end-file" && payload.reason === "error") {
    if (!ownsMusicVideo() && recoverPlayback) recoverPlayback();
    else publish({ phase: "error", error: "Music playback could not start." });
    return;
  }
  if (
    payload.event === "end-file" &&
    payload.reason === "eof" &&
    state.phase !== "resolving" &&
    state.current !== null &&
    Date.now() - endHandledAt > 1200
  ) {
    endHandledAt = Date.now();
    nextMusic(true);
  }
}

function ensureNativeEvents(): Promise<void> {
  if (nativeEventsReady) return nativeEventsReady;
  nativeEventsReady = (async () => {
    const unlistenMusic = await listen<MpvEvent>("music://event", ({ payload }) => {
      if (!ownsMusicVideo() && !speakerTransfer && !getMusicSpeakerState().active)
        handlePlaybackEvent(payload);
    });
    try {
      await listen<LastFmEvent>("music://lastfm", ({ payload }) => {
        if (payload.status === "error") {
          publish({ scrobbleError: payload.message ?? "Last.fm scrobble failed." });
        }
      });
    } catch (error) {
      unlistenMusic();
      throw error;
    }
  })().catch((error) => {
    nativeEventsReady = null;
    throw error;
  });
  return nativeEventsReady;
}

let videoTarget: { token: symbol; trackId: string } | null = null;
let videoActivation = 0;
function ownsMusicVideo(): boolean {
  return videoTarget !== null && videoTarget.trackId === state.current?.id;
}

export function isMusicVideoActive(): boolean {
  return ownsMusicVideo();
}

export type MusicVideoController = {
  setPaused: (paused: boolean) => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
};

export type MusicVideoReport = {
  phase?: "playing" | "paused";
  currentTime?: number;
  duration?: number;
  ended?: boolean;
  error?: string;
};

let videoController: MusicVideoController | null = null;

export function setMusicVideoController(controller: MusicVideoController | null): () => void {
  if (controller === null) {
    videoController = null;
    return () => {};
  }
  videoController = controller;
  return () => {
    if (videoController === controller) videoController = null;
  };
}

export function reportMusicVideoPlayback(report: MusicVideoReport): void {
  if (!ownsMusicVideo() || speakerTransfer || getMusicSpeakerState().active) return;
  if (report.error) {
    publish({ phase: "error", error: report.error });
    return;
  }
  if (report.ended) {
    if (Date.now() - endHandledAt <= 1200) return;
    endHandledAt = Date.now();
    nextMusic(true);
    return;
  }
  const patch: Partial<MusicPlayerState> = {};
  if (report.phase && report.phase !== state.phase) patch.phase = report.phase;
  if (typeof report.currentTime === "number" && Number.isFinite(report.currentTime))
    patch.currentTime = Math.max(0, report.currentTime);
  if (
    typeof report.duration === "number" &&
    Number.isFinite(report.duration) &&
    report.duration > 0
  )
    patch.duration = report.duration;
  if (state.error && patch.phase) patch.error = null;
  if (Object.keys(patch).length > 0) publish(patch);
}

/** Wait for the matching native audio load before a video can take ownership. */
export async function waitForMusicAudioReady(track: MusicTrack): Promise<boolean> {
  const loading = audioReady;
  if (!loading || loading.id !== track.id || loading.connectorId !== track.connectorId)
    return false;
  return (
    (await loading.done) &&
    loading.request === playRequest &&
    state.current?.id === track.id &&
    state.current.connectorId === track.connectorId
  );
}

/** Temporarily route the persistent dock to the music video's media elements. */
export async function activateMusicVideo(trackId: string) {
  const activation = ++videoActivation;
  observedPause = null;
  const token = Symbol("music video controls");
  const audioRequest = playRequest;
  let released = false;
  const audio = { phase: state.phase, currentTime: state.currentTime, duration: state.duration };
  const volume = state.volume;
  if (activation === videoActivation) {
    videoTarget = { token, trackId };
    if (ownsMusicVideo()) publish({ phase: "resolving", currentTime: audio.currentTime });
  }
  await invoke("music_engine_pause", { paused: true }).catch(() => {});
  return {
    volume,
    position: audio.currentTime,
    paused: audio.phase === "paused",
    async release() {
      if (released) return;
      released = true;
      if (videoTarget?.token !== token) return;
      const current = () =>
        videoTarget?.token === token && ownsMusicVideo() && audioRequest === playRequest;
      if (!current()) {
        videoTarget = null;
        return;
      }
      const phase =
        state.phase === "playing" || state.phase === "paused"
          ? state.phase
          : audio.phase === "playing"
            ? "playing"
            : "paused";
      const position =
        state.phase === "playing" || state.phase === "paused"
          ? state.currentTime
          : audio.currentTime;
      const nextTime = Math.max(
        0,
        Math.min(position, audio.duration > 0 ? audio.duration : position),
      );
      publish({ phase: "resolving" });
      try {
        await invoke("music_engine_seek", { position: nextTime });
        if (!current()) return;
        await invoke("music_engine_pause", { paused: phase !== "playing" });
        if (current()) publish({ ...audio, currentTime: nextTime, phase });
      } catch (error) {
        if (current())
          publish({
            phase: "error",
            error: error instanceof Error ? error.message : String(error),
          });
      } finally {
        if (videoTarget?.token === token) videoTarget = null;
      }
    },
  };
}

function skipUnavailableTrack(track: MusicTrack, queue: MusicTrack[]): boolean {
  autoSkipped.add(queueTrackKey(track));
  let index = queue.findIndex((item) => queueTrackKey(item) === queueTrackKey(track));
  for (let attempt = 0; attempt < queue.length; attempt++) {
    const next = musicAdvance(queue, index, false);
    if (!next) return false;
    index = queue.findIndex((item) => queueTrackKey(item) === queueTrackKey(next));
    if (autoSkipped.has(queueTrackKey(next))) continue;
    void playMusic(next, queue, new Set(), true, true).catch(() => {});
    return true;
  }
  return false;
}

const SOURCE_ATTEMPT_CEILING = 6;
// A source the listener picked by hand is a decision, not a guess: if it fails, say so rather
// than quietly playing something else under the same name.
let explicitSource: string | null = null;

async function recoverySources(track: MusicTrack): Promise<MusicSourceCandidate[]> {
  const cached = await sourcesFor(track).catch(() => null);
  if (cached && cached.length > 0) return cached;
  return await sourcesFor(track, SOURCE_TTL_MS, true).catch(() => []);
}

async function nextPlayableSource(
  attemptTrack: MusicTrack,
  failedAttempts: Set<string>,
): Promise<MusicTrack | null> {
  if (attemptTrack.mediaKind === "video") return null;
  if (failedAttempts.size >= SOURCE_ATTEMPT_CEILING) return null;
  const candidates = await recoverySources(attemptTrack);
  const usable = candidates.filter(
    (candidate) =>
      candidate.health !== "offline" &&
      candidate.track.connectorId !== "catalog" &&
      !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`),
  );
  const want = readMusicPreference("harbor.music.preferred-source.v1");
  return (usable.find((candidate) => candidate.connectorId === want) ?? usable[0])?.track ?? null;
}

export async function playMusic(
  track: MusicTrack,
  queue = [track],
  failedAttempts = new Set<string>(),
  continuing = false,
  skipUnavailable = false,
  explicit = false,
  automationOwner?: symbol,
): Promise<void> {
  if (automationOwner && !ownsMusicQueueAutomation(automationOwner)) return;
  if (!continuing && !failedAttempts.size && !automationOwner) cancelMusicQueueAutomation();
  await initializeMusic();
  if (automationOwner && !ownsMusicQueueAutomation(automationOwner)) return;
  if (automationOwner) markMusicQueueAutomationStarted(automationOwner);
  if (!continuing) explicitSource = explicit ? (track.connectorId ?? null) : null;
  if (explicit) pinSourceFor(track);
  const chosenByHand = explicitSource !== null && track.connectorId === explicitSource;
  const request = ++playRequest;
  // Once admitted, this is the current song. Stopping recommendations leaves it playing;
  // starting a different song still supersedes every asynchronous step via playRequest.
  const ownsRequest = () => request === playRequest;
  observedPause = null;
  if (!continuing && !failedAttempts.size) {
    beginMusicQueue(queue, state.queue);
    resetMusicOrder();
    resumeAt = null;
    autoSkipped.clear();
  }
  recoverPlayback = null;
  const catalog = track.connectorId === "catalog" && !track.playbackUrl;
  const preferredSource = readMusicPreference("harbor.music.preferred-source.v1");
  const resolvePreferred = shouldResolvePreferredSource(track, preferredSource, explicitSource !== null, failedAttempts.size > 0);
  const workingSource = state.current?.connectorId;
  let alternatives: MusicTrack[] = [];
  let searchedAlternatives = catalog || resolvePreferred;
  let finishAudio!: (ready: boolean) => void;
  audioReady = {
    request,
    id: track.id,
    connectorId: track.connectorId,
    done: new Promise((resolve) => {
      finishAudio = resolve;
    }),
  };
  if (!queue.some((item) => queueTrackKey(item) === queueTrackKey(track)))
    queue = [track, ...queue];
  const queueIndex = queue.findIndex((item) => queueTrackKey(item) === queueTrackKey(track));
  publish({
    phase: "resolving",
    current: track,
    volume: clampMusicVolume(state.volume, track.connectorId),
    queue,
    queueIndex,
    currentTime: 0,
    duration: track.durationSeconds,
    error: null,
  });
  try {
    if (catalog || resolvePreferred) {
      const candidates = await sourcesFor(track).catch(error => {
        if (catalog) throw error;
        return [{ connectorId: track.connectorId ?? "", connectorName: "", health: "healthy" as const, track }];
      });
      if (!ownsRequest()) return;
      const playable = candidates.filter(
        (candidate) =>
          candidate.health !== "offline" &&
          candidate.track.connectorId !== "catalog" &&
          !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`),
      );
      if (!catalog && !playable.some(candidate => candidate.track.connectorId === track.connectorId && candidate.track.id === track.id)) {
        playable.push({ connectorId: track.connectorId ?? "", connectorName: "", health: "healthy", track });
      }
      const preferred = readMusicPreference("harbor.music.preferred-source.v1");
      const ranked = rankByExplicitness(playable, explicitnessOf(track));
      const pinned = peekPinnedSource(track);
      const match =
        (pinned &&
          (ranked.find(
            (candidate) =>
              candidate.connectorId === pinned.connectorId && candidate.track.id === pinned.id,
          ) ??
            ranked.find((candidate) => candidate.connectorId === pinned.connectorId))) ??
        ranked.find((candidate) => candidate.connectorId === preferred) ??
        ranked.find((candidate) => candidate.connectorId === workingSource) ??
        ranked[0];
      if (!match) throw new Error("music.source.none");
      const original = track;
      alternatives = ranked
        .filter((candidate) => candidate !== match)
        .slice(0, 2)
        .map((candidate) => adoptRequestedIdentity(candidate.track, original));
      track = adoptRequestedIdentity(match.track, original);
      // A manual queue edit or stopping a station can happen during source lookup.
      // Resolve the current recording inside the live queue, preserving that edit.
      queue = state.queue.map((item) =>
        item.id === original.id && item.connectorId === original.connectorId ? track : item,
      );
      if (audioReady?.request === request) {
        audioReady.id = track.id;
        audioReady.connectorId = track.connectorId;
      }
      publish({
        current: track,
        queue,
        duration: track.durationSeconds,
        volume: clampMusicVolume(state.volume, track.connectorId),
      });
    }
    await stopCastOwner("video");
    if (!ownsRequest()) return;
    await ensureNativeEvents();
    if (!ownsRequest()) return;
    queue = state.queue;
    void invoke("music_set_queue", { tracks: queue }).catch(() => {});
    updateMediaSession(track);
    const recents = [track, ...state.recents.filter((item) => !sameMusicTrack(item, track))].slice(
      0,
      50,
    );
    // Playback refreshes metadata; only saving a song changes the Saved list's order.
    const playedIds = new Set(likedIdsFor(track));
    const likedTracks = isMusicLiked(state.likedIds, track)
      ? state.likedTracks.map((item) =>
          likedIdsFor(item).some((id) => playedIds.has(id)) ? track : item,
        )
      : state.likedTracks;
    void import("./hidden-recents").then(({ unhideMusicRecent }) => unhideMusicRecent(track.id));
    void invoke("music_add_recent", { track }).catch(() => {});
    if (!ownsRequest()) return;
    publish({ recents, likedTracks });
    const speaker = getMusicSpeakerState();
    const target = pendingSpeakerDevice ?? (speaker.active ? speaker.device : null);
    if (returningToComputer) {
      await stopMusicSpeaker();
      if (!ownsRequest()) return;
      speakerTransfer = false;
    }
    for (let attempt = 0; ; attempt++) {
      if (!ownsRequest()) return;
      const attemptTrack = track;
      let recovering = false;
      recoverPlayback = (message) => {
        if (recovering || !ownsRequest()) return;
        recovering = true;
        failedAttempts.add(`${attemptTrack.connectorId}:${attemptTrack.id}`);
        publish({ phase: "resolving", error: null });
        void (async () => {
          const candidates =
            chosenByHand || attemptTrack.mediaKind === "video"
              ? []
              : await recoverySources(attemptTrack);
          if (!ownsRequest()) return;
          const usable = candidates.filter(
            (candidate) =>
              candidate.health !== "offline" &&
              candidate.track.connectorId !== "catalog" &&
              !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`),
          );
          const want = readMusicPreference("harbor.music.preferred-source.v1");
          const replacement =
            !chosenByHand && failedAttempts.size < SOURCE_ATTEMPT_CEILING
              ? (usable.find((candidate) => candidate.connectorId === want) ?? usable[0])?.track
              : undefined;
          if (!replacement) {
            enginePrimed = false;
            recoverPlayback = null;
            if (skipUnavailable && skipUnavailableTrack(attemptTrack, queue)) return;
            publish({ phase: "error", error: message ?? "music.source.none" });
            if (!skipUnavailable && typeof window !== "undefined")
              window.dispatchEvent(new Event("harbor:music-playback-source-required"));
            return;
          }
          const next = adoptRequestedIdentity(replacement, attemptTrack);
          await playMusic(
            next,
            state.queue.map((item) =>
              item.id === attemptTrack.id && item.connectorId === attemptTrack.connectorId
                ? next
                : item,
            ),
            failedAttempts,
            true,
            skipUnavailable,
          ).catch(() => {});
        })();
      };
      try {
        if (target && !returningToComputer) await loadMusicOnSpeaker(track, target);
        else await invoke("music_play_track", { track, volume: state.volume });
        break;
      } catch (error) {
        if (!ownsRequest()) return;
        failedAttempts.add(`${track.connectorId}:${track.id}`);
        const errorKey =
          error && typeof error === "object" && "key" in error ? String(error.key) : String(error);
        if (chosenByHand || /STOP_UNCONFIRMED|stopUnconfirmed/i.test(errorKey)) throw error;
        if (!searchedAlternatives && track.mediaKind !== "video") {
          searchedAlternatives = true;
          const failedTrack = track;
          const candidates = await sourcesFor(track).catch(() => []);
          if (!ownsRequest()) return;
          alternatives = candidates
            .filter(
              (candidate) =>
                candidate.health !== "offline" &&
                candidate.track.connectorId !== "catalog" &&
                !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`) &&
                !(
                  candidate.track.id === failedTrack.id &&
                  candidate.track.connectorId === failedTrack.connectorId
                ),
            )
            .slice(0, 2)
            .map((candidate) => adoptRequestedIdentity(candidate.track, failedTrack));
        }
        const alternative = alternatives[attempt];
        if (!alternative) throw error;
        const previous = track;
        track = alternative;
        queue = state.queue.map((item) =>
          item.id === previous.id && item.connectorId === previous.connectorId ? track : item,
        );
        if (audioReady?.request === request) {
          audioReady.id = track.id;
          audioReady.connectorId = track.connectorId;
        }
        publish({
          current: track,
          queue,
          duration: track.durationSeconds,
          currentTime: 0,
          error: null,
          phase: "resolving",
        });
        await invoke("music_set_queue", { tracks: queue });
        if (!ownsRequest()) return;
        updateMediaSession(track);
        await invoke("music_add_recent", { track });
        if (!ownsRequest()) return;
        publish({
          recents: [
            track,
            ...state.recents.filter(
              (item) => !sameMusicTrack(item, track) && !sameMusicTrack(item, previous),
            ),
          ].slice(0, 50),
        });
      }
    }
    if (!ownsRequest()) return;
    enginePrimed = true;
    if (deckAdoption.deck() !== 0 && !getMusicSpeakerState().active)
      publish({ phase: "playing", error: null });
    const upcoming = queue[queueIndex + 1];
    if (upcoming?.connectorId === "catalog" && !upcoming.playbackUrl)
      void sourcesFor(upcoming).catch(() => {});
  } catch (error) {
    if (!ownsRequest()) return;
    enginePrimed = false;
    const message =
      error &&
      typeof error === "object" &&
      "key" in error &&
      typeof error.key === "string" &&
      error.key.startsWith("music.cast.")
        ? error.key
        : error instanceof Error
          ? error.message
          : String(error);
    if (
      skipUnavailable &&
      !/STOP_UNCONFIRMED|stopUnconfirmed/i.test(message) &&
      skipUnavailableTrack(track, queue)
    )
      return;
    const attemptKey = `${track.connectorId}:${track.id}`;
    if (!chosenByHand && !skipUnavailable && !failedAttempts.has(attemptKey)) {
      failedAttempts.add(attemptKey);
      publish({ phase: "resolving", error: null });
      try {
        await playMusic(track, queue, failedAttempts, true, skipUnavailable);
        return;
      } catch {
        /* the retry failed too; fall through to another source */
      }
    }
    if (!chosenByHand && !skipUnavailable) {
      const next = await nextPlayableSource(track, failedAttempts);
      if (next && ownsRequest()) {
        publish({ phase: "resolving", error: null });
        try {
          await playMusic(
            adoptRequestedIdentity(next, track),
            queue,
            failedAttempts,
            true,
            skipUnavailable,
          );
          return;
        } catch {
          /* exhausted; the picker below is the last resort */
        }
      }
    }
    publish({ phase: "error", error: message });
    if (!skipUnavailable && searchedAlternatives && typeof window !== "undefined")
      window.dispatchEvent(new Event("harbor:music-playback-source-required"));
    throw error instanceof Error ? error : new Error(message);
  } finally {
    finishAudio(ownsRequest() && enginePrimed);
    if (request === playRequest) {
      speakerTransfer = false;
      pendingSpeakerDevice = null;
      returningToComputer = false;
    }
  }
}

export function toggleMusicPlayback(): void {
  const current = state.current;
  if (!current || state.phase === "resolving") return;
  if (getMusicSpeakerState().active) {
    void (state.phase === "playing" ? pauseMusicSpeaker() : playMusicSpeaker())
      .then(() => refreshMusicSpeakerStatus())
      .catch(() => {});
    return;
  }
  if (ownsMusicVideo()) {
    videoController?.setPaused(state.phase === "playing");
    return;
  }
  if (!enginePrimed || state.phase === "error") {
    resumeAt =
      !enginePrimed &&
      state.phase === "paused" &&
      state.currentTime > 0 &&
      state.currentTime < state.duration - 2
        ? { key: queueTrackKey(current), position: state.currentTime }
        : null;
    void playMusic(current, state.queue.length ? state.queue : [current], new Set(), true).catch(
      () => {},
    );
    return;
  }
  void invoke("music_engine_pause", { paused: state.phase === "playing" }).catch(() => {});
}

export function setMusicQueue(input: MusicTrack[], automationOwner?: symbol): void {
  if (automationOwner && !ownsMusicQueueAutomation(automationOwner)) return;
  if (!automationOwner) cancelMusicQueueAutomation();
  const current = state.current;
  const kept = filterBlockedTracks(input, "play");
  const tracks = kept.length > 0 ? kept : input;
  const queueIndex = current
    ? tracks.findIndex((item) => queueTrackKey(item) === queueTrackKey(current))
    : -1;
  publish({ queue: tracks, queueIndex });
  void invoke("music_set_queue", { tracks }).catch((error) =>
    publish({ error: error instanceof Error ? error.message : String(error) }),
  );
}

export function loopMusic(start: number | null, end: number | null): void {
  if (getMusicSpeakerState().active || ownsMusicVideo()) return;
  void invoke("music_deck_loop", { start, end }).catch(() => {});
}

export function seekMusic(position: number): void {
  if (!Number.isFinite(position)) return;
  if (getMusicSpeakerState().active) {
    void seekMusicSpeaker(position)
      .then(() => refreshMusicSpeakerStatus())
      .catch(() => {});
    return;
  }
  if (ownsMusicVideo()) {
    videoController?.seek(Math.max(0, position));
    return;
  }
  void invoke("music_engine_seek", { position: Math.max(0, position) }).catch(() => {});
}

/** Queues after what is playing, ahead of the rest of the collection, without disturbing playback. */
export function enqueueMusic(track: MusicTrack): void {
  const automated = cancelMusicQueueAutomation();
  const queue = automated ? state.queue.slice(0, state.queueIndex + 1) : state.queue;
  if (queue.some((item) => queueTrackKey(item) === queueTrackKey(track))) {
    if (automated) setMusicQueue(queue);
    return;
  }
  const at = queueInsertIndex(queue, state.queueIndex);
  markManuallyQueued(track);
  setMusicQueue(insertIntoQueue(queue, track, at));
}

/**
 * The station built around a track. It returns the tracks rather than playing them: a
 * catalog track carries no playbackUrl, so the caller has to hand them to the source picker
 * to be resolved to a connector that can play them.
 */
export function musicRadioTracks(track: MusicTrack): Promise<MusicTrack[]> {
  return import("./radio").then(({ loadTrackRadio }) => loadTrackRadio(track));
}

export function musicSimilarTracks(track: MusicTrack): Promise<MusicTrack[]> {
  return import("./radio").then(({ loadSimilarTracks }) => loadSimilarTracks(track));
}

export function setMusicVolume(volume: number): void {
  if (getMusicSpeakerState().active) return;
  const next = clampMusicVolume(volume, state.current?.connectorId);
  if (isDeckWindow()) {
    sendDeckCommand({ kind: "volume", value: next });
    return;
  }
  writeMusicPreference(VOLUME_KEY, String(next));
  publish({ volume: next });
  if (ownsMusicVideo()) videoController?.setVolume(next);
  void invoke("music_engine_set_volume", { volume: next }).catch(() => {});
  void invoke("music_deck_volume", { deck: 1, volume: next }).catch(() => {});
}

export function nextMusic(auto = false): void {
  if (!state.current) return;
  if (!auto) autoSkipped.clear();
  const next = musicAdvance(state.queue, state.queueIndex, auto);
  if (next) void playMusic(next, state.queue, new Set(), true, auto).catch(() => {});
  else {
    if (auto) enginePrimed = false;
    if (!auto) {
      if (getMusicSpeakerState().active) void pauseMusicSpeaker().catch(() => {});
      else if (ownsMusicVideo()) videoController?.setPaused(true);
      else void invoke("music_engine_pause", { paused: true }).catch(() => {});
    }
    publish({ phase: "paused", currentTime: auto ? state.duration : state.currentTime });
  }
}

export function previousMusic(): void {
  if (state.currentTime > 5) {
    seekMusic(0);
    return;
  }
  const previous = musicPrevious(state.queue, state.queueIndex);
  if (previous) void playMusic(previous, state.queue, new Set(), true).catch(() => {});
}

/** Saved songs once recorded only the id they played under, so one saved before a substitute
 *  was swapped in no longer matched itself. Re-add each saved track's full identity on load. */
function completeLikedIds(likedIds: string[], likedTracks: MusicTrack[]): string[] {
  const ids = new Set(likedIds);
  for (const track of likedTracks) for (const id of likedIdsFor(track)) ids.add(id);
  return ids.size === likedIds.length ? likedIds : [...ids];
}

export function toggleMusicLiked(track = state.current): void {
  if (!track) return;
  const liked = !isMusicLiked(state.likedIds, track);
  const drop = new Set(likedIdsFor(track));
  const likedIds = liked
    ? [...withoutLiked(state.likedIds, track), ...likedIdsFor(track)]
    : withoutLiked(state.likedIds, track);
  const likedTracks = liked
    ? [track, ...state.likedTracks.filter((item) => !drop.has(item.id))]
    : state.likedTracks.filter((item) => !drop.has(item.id));
  // Saving a song saves the source it was playing from, so opening it later is the same recording.
  if (liked) pinSourceFor(track);
  else unpinSourceFor(track);
  publish({ likedIds, likedTracks });
  void initializeMusic()
    .then(() => invoke("music_set_liked", { track, liked }))
    .catch((error) => publish({ error: error instanceof Error ? error.message : String(error) }));
}

export function clearMusicError(): void {
  publish({
    error: null,
    phase: state.phase === "error" ? (state.current ? "paused" : "idle") : state.phase,
  });
}

/** End playback before removing its controls, including an owned network receiver. */
export async function closeMusicPlayer(): Promise<void> {
  cancelMusicQueueAutomation();
  const request = ++playRequest;
  recoverPlayback = null;
  speakerTransfer = true;
  try {
    if (getMusicSpeakerState().active) await stopMusicSpeaker();
    if (request !== playRequest) return;
    if (ownsMusicVideo()) {
      videoController?.setPaused(true);
      videoTarget = null;
    }
    if (request !== playRequest) return;
    await invoke("music_engine_stop", { unpause: false });
    void invoke("music_deck_primary", { deck: 0 }).catch(() => {});
    if (request !== playRequest) return;
    await invoke("music_set_queue", { tracks: [] });
    if (request !== playRequest) return;
    enginePrimed = false;
    audioReady = null;
    resetMusicOrder();
    publish({
      current: null,
      queue: [],
      queueIndex: -1,
      phase: "idle",
      currentTime: 0,
      duration: 0,
      error: null,
    });
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("harbor:music-player-closed"));
  } catch (error) {
    if (request === playRequest)
      publish({ error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (request === playRequest) {
      speakerTransfer = false;
      pendingSpeakerDevice = null;
    }
  }
}

export function getMusicState(): MusicPlayerState {
  return state;
}

export function subscribeMusic(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMusicPlayer(): MusicPlayerState {
  return useSyncExternalStore(subscribeMusic, getMusicState, getMusicState);
}

subscribeMusicAudioSettings(() => {
  if (isDeckWindow()) return;
  const next = clampMusicVolume(state.volume, state.current?.connectorId);
  if (next !== state.volume) setMusicVolume(next);
});

/** Transfer only after the user selects a receiver. Never apply PC gain to a speaker. */
export async function playMusicOnSpeaker(device: CastDeviceInfo): Promise<void> {
  const track = state.current;
  if (!track) return;
  const previousPhase = state.phase;
  const video = ownsMusicVideo();
  const request = ++playRequest;
  speakerTransfer = true;
  pendingSpeakerDevice = device;
  returningToComputer = false;
  try {
    if (!getMusicSpeakerState().active) {
      if (video) videoController?.setPaused(true);
      else await invoke("music_engine_pause", { paused: true });
    }
    if (request !== playRequest) return;
    await loadMusicOnSpeaker(track, device, state.currentTime);
    if (request !== playRequest) return;
    enginePrimed = false;
    await refreshMusicSpeakerStatus();
  } catch (error) {
    if (request !== playRequest) return;
    if (!getMusicSpeakerState().active) {
      if (video) videoController?.setPaused(previousPhase !== "playing");
      else
        await invoke("music_engine_pause", { paused: previousPhase !== "playing" }).catch(() => {});
      publish({ phase: previousPhase });
    }
    throw error;
  } finally {
    if (request === playRequest) {
      speakerTransfer = false;
      pendingSpeakerDevice = null;
    }
  }
}

export async function returnMusicToComputer(): Promise<void> {
  const track = state.current;
  const position = getMusicSpeakerState().positionSec;
  const request = ++playRequest;
  returningToComputer = true;
  pendingSpeakerDevice = null;
  speakerTransfer = true;
  try {
    await stopMusicSpeaker();
  } catch (error) {
    if (request === playRequest) {
      returningToComputer = false;
      speakerTransfer = false;
      throw error;
    }
    return;
  }
  if (request !== playRequest) return;
  returningToComputer = false;
  speakerTransfer = false;
  if (!track) return;
  resumeAt = { key: queueTrackKey(track), position };
  await playMusic(track, state.queue, new Set(), true);
}

export async function stopMusicCasting(): Promise<void> {
  const request = ++playRequest;
  returningToComputer = true;
  pendingSpeakerDevice = null;
  speakerTransfer = true;
  try {
    await stopMusicSpeaker();
  } catch (error) {
    if (request === playRequest) {
      returningToComputer = false;
      speakerTransfer = false;
      throw error;
    }
    return;
  }
  if (request !== playRequest) return;
  returningToComputer = false;
  speakerTransfer = false;
  enginePrimed = false;
  publish({ phase: state.current ? "paused" : "idle", error: null });
}

subscribeMusicSpeakerState(() => {
  const speaker = getMusicSpeakerState();
  if (speakerPoll) {
    clearTimeout(speakerPoll);
    speakerPoll = null;
  }
  if (speaker.active) {
    speakerWasActive = true;
    if (speaker.track?.id === state.current?.id) {
      const ended =
        speaker.phase === "stopped" &&
        state.phase === "playing" &&
        state.duration > 0 &&
        Math.max(state.currentTime, speaker.positionSec) >= state.duration - 3;
      const phase =
        speaker.phase === "playing"
          ? "playing"
          : speaker.phase === "paused" || speaker.phase === "stopped"
            ? "paused"
            : speaker.phase === "error"
              ? "error"
              : "resolving";
      publish({ phase, currentTime: speaker.positionSec, error: speaker.errorKey });
      if (ended) nextMusic(true);
    }
    speakerPoll = setTimeout(() => {
      void refreshMusicSpeakerStatus().catch(() => {});
    }, 2000);
  } else if (speakerWasActive) {
    speakerWasActive = false;
    enginePrimed = false;
    if (speaker.errorKey) publish({ phase: "error", error: speaker.errorKey });
  }
});

if (typeof navigator !== "undefined" && "mediaSession" in navigator && !isWindowsDesktop()) {
  navigator.mediaSession.setActionHandler("play", () => {
    if (state.phase !== "playing") toggleMusicPlayback();
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    if (state.phase === "playing") toggleMusicPlayback();
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => nextMusic());
  navigator.mediaSession.setActionHandler("previoustrack", () => previousMusic());
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (details.seekTime !== undefined) seekMusic(details.seekTime);
  });
}

answerDeckRequests(getMusicState);
serveDeckCommands((command) => {
  if (command.kind === "toggle") toggleMusicPlayback();
  else if (command.kind === "next") void nextMusic();
  else if (command.kind === "previous") void previousMusic();
  else if (command.kind === "seek") seekMusic(command.seconds);
  else if (command.kind === "loop") loopMusic(command.start, command.end);
  else if (command.kind === "volume") setMusicVolume(command.value);
  else if (command.kind === "like") toggleMusicLiked();
  else if (command.kind === "dismissError") clearMusicError();
  else if (command.kind === "adopt")
    sendDeckAdopted({
      nonce: command.nonce,
      deck: command.deck,
      landed: deckAdoption.adopt(command),
    });
  else if (command.kind === "retry") {
    const track = state.current;
    if (track) void playMusic(track, state.queue).catch(() => {});
  }
});
