import { isMusicLiked, likedIdsFor, withoutLiked } from "./liked";
import { insertIntoQueue, markManuallyQueued, queueInsertIndex } from "./queue-insert";
import { queueTrackKey } from "./queue-order";
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
import { getMusicPlaybackOrigin, restoreMusicPlaybackOrigin } from "./playback-origin";
import type {
  MusicAudioQuality,
  MusicPlayerState,
  MusicTrack,
  MusicSourceCandidate,
} from "./types";
import type { CastDeviceInfo } from "@/lib/cast";
import { stopCastOwner } from "@/lib/cast-ownership";
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
function sourcesFor(track: MusicTrack): Promise<MusicSourceCandidate[]> {
  const key = `${track.connectorId}:${track.id}:${track.title}:${track.artist}`;
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
    .then((value) => (Array.isArray(value) ? value : []))
    .catch((error) => {
      queuedSources.delete(key);
      throw error;
    })
    .finally(() => clearTimeout(timer));
  queuedSources.set(key, { until: Date.now() + 120_000, promise });
  while (queuedSources.size > 8) queuedSources.delete(queuedSources.keys().next().value!);
  return promise;
}

export type MusicAdvance = (queue: MusicTrack[], index: number, auto: boolean) => MusicTrack | null;

const sequentialAdvance: MusicAdvance = (queue, index) => queue[index + 1] ?? null;
let advance: MusicAdvance = sequentialAdvance;

let goPrevious = (queue: MusicTrack[], index: number): MusicTrack | null =>
  queue[index - 1] ?? null;
let resetOrder = () => {};
export function setMusicAdvance(
  next: MusicAdvance | null,
  previous?: typeof goPrevious,
  reset?: () => void,
): void {
  advance = next ?? sequentialAdvance;
  goPrevious = previous ?? ((queue, index) => queue[index - 1] ?? null);
  resetOrder = reset ?? (() => {});
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
  if (
    patch.current !== undefined ||
    patch.phase === "paused" ||
    (patch.currentTime !== undefined && Date.now() - lastSessionWrite > 2000)
  ) {
    lastSessionWrite = Date.now();
    saveMusicCheckpoint();
  }
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

export function initializeMusic(): Promise<void> {
  void initializeMusicAudioSettings();
  if (initialization) return initialization;
  const migration = readLegacyMigration();
  initialization = Promise.all([
    invoke<NativeMusicBootstrap>("music_db_init", { migration }),
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
        likedIds: bootstrap.likedIds,
        likedTracks: bootstrap.likedTracks,
        recents: bootstrap.recents,
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
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album ?? "Harbor Music",
    artwork: track.artwork ? [{ src: track.artwork, sizes: "544x544" }] : [],
  });
}

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
          publish({ error: payload.message ?? "Last.fm scrobble failed." });
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
    const next = advance(queue, index, false);
    if (!next) return false;
    index = queue.findIndex((item) => queueTrackKey(item) === queueTrackKey(next));
    if (autoSkipped.has(queueTrackKey(next))) continue;
    void playMusic(next, queue, new Set(), true, true).catch(() => {});
    return true;
  }
  return false;
}

export async function playMusic(
  track: MusicTrack,
  queue = [track],
  failedAttempts = new Set<string>(),
  continuing = false,
  skipUnavailable = false,
): Promise<void> {
  await initializeMusic();
  const request = ++playRequest;
  observedPause = null;
  if (!continuing && !failedAttempts.size) {
    resetOrder();
    resumeAt = null;
    autoSkipped.clear();
  }
  recoverPlayback = null;
  const catalog = track.connectorId === "catalog" && !track.playbackUrl;
  const workingSource = state.current?.connectorId;
  let alternatives: MusicTrack[] = [];
  let searchedAlternatives = catalog;
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
    if (catalog) {
      const candidates = await sourcesFor(track);
      if (request !== playRequest) return;
      const playable = candidates.filter(
        (candidate) =>
          candidate.health !== "offline" &&
          candidate.track.connectorId !== "catalog" &&
          !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`),
      );
      const preferred = readMusicPreference("harbor.music.preferred-source.v1");
      const match =
        playable.find((candidate) => candidate.connectorId === workingSource) ??
        playable.find((candidate) => candidate.connectorId === preferred) ??
        playable[0];
      if (!match) throw new Error("music.source.none");
      const original = track;
      alternatives = playable
        .filter((candidate) => candidate !== match)
        .slice(0, 2)
        .map((candidate) => ({
          ...candidate.track,
          collectionOrigin: original.collectionOrigin ?? {
            id: original.id,
            connectorId: original.connectorId,
          },
        }));
      track = {
        ...match.track,
        collectionOrigin: original.collectionOrigin ?? {
          id: original.id,
          connectorId: original.connectorId,
        },
      };
      queue = queue.map((item) =>
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
    if (request !== playRequest) return;
    await ensureNativeEvents();
    if (request !== playRequest) return;
    void invoke("music_set_queue", { tracks: queue }).catch(() => {});
    updateMediaSession(track);
    const recents = [track, ...state.recents.filter((item) => item.id !== track.id)].slice(0, 50);
    const likedTracks = state.likedIds.includes(track.id)
      ? [track, ...state.likedTracks.filter((item) => item.id !== track.id)]
      : state.likedTracks;
    void import("./hidden-recents").then(({ unhideMusicRecent }) => unhideMusicRecent(track.id));
    void invoke("music_add_recent", { track }).catch(() => {});
    if (request !== playRequest) return;
    publish({ recents, likedTracks });
    const speaker = getMusicSpeakerState();
    const target = pendingSpeakerDevice ?? (speaker.active ? speaker.device : null);
    if (returningToComputer) {
      await stopMusicSpeaker();
      if (request !== playRequest) return;
      speakerTransfer = false;
    }
    for (let attempt = 0; ; attempt++) {
      if (request !== playRequest) return;
      const attemptTrack = track;
      let recovering = false;
      recoverPlayback = (message) => {
        if (recovering || request !== playRequest) return;
        recovering = true;
        failedAttempts.add(`${attemptTrack.connectorId}:${attemptTrack.id}`);
        publish({ phase: "resolving", error: null });
        void (async () => {
          const candidates =
            attemptTrack.mediaKind === "video"
              ? []
              : await sourcesFor(attemptTrack).catch(() => []);
          if (request !== playRequest) return;
          const replacement =
            failedAttempts.size < 3
              ? candidates.find(
                  (candidate) =>
                    candidate.health !== "offline" &&
                    candidate.track.connectorId !== "catalog" &&
                    !failedAttempts.has(`${candidate.track.connectorId}:${candidate.track.id}`),
                )?.track
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
          const next = {
            ...replacement,
            collectionOrigin: attemptTrack.collectionOrigin ?? {
              id: attemptTrack.id,
              connectorId: attemptTrack.connectorId,
            },
          };
          await playMusic(
            next,
            queue.map((item) =>
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
        if (request !== playRequest) return;
        failedAttempts.add(`${track.connectorId}:${track.id}`);
        const errorKey =
          error && typeof error === "object" && "key" in error ? String(error.key) : String(error);
        if (/STOP_UNCONFIRMED|stopUnconfirmed/i.test(errorKey)) throw error;
        if (!searchedAlternatives && track.mediaKind !== "video") {
          searchedAlternatives = true;
          const failedTrack = track;
          const candidates = await sourcesFor(track).catch(() => []);
          if (request !== playRequest) return;
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
            .map((candidate) => ({
              ...candidate.track,
              collectionOrigin: failedTrack.collectionOrigin ?? {
                id: failedTrack.id,
                connectorId: failedTrack.connectorId,
              },
            }));
        }
        const alternative = alternatives[attempt];
        if (!alternative) throw error;
        const previous = track;
        track = alternative;
        queue = queue.map((item) =>
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
        if (request !== playRequest) return;
        updateMediaSession(track);
        await invoke("music_add_recent", { track });
        if (request !== playRequest) return;
        publish({
          recents: [
            track,
            ...state.recents.filter((item) => item.id !== track.id && item.id !== previous.id),
          ].slice(0, 50),
        });
      }
    }
    if (request !== playRequest) return;
    enginePrimed = true;
    const upcoming = queue[queueIndex + 1];
    if (upcoming?.connectorId === "catalog" && !upcoming.playbackUrl)
      void sourcesFor(upcoming).catch(() => {});
  } catch (error) {
    if (request !== playRequest) return;
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
    publish({ phase: "error", error: message });
    if (!skipUnavailable && searchedAlternatives && typeof window !== "undefined")
      window.dispatchEvent(new Event("harbor:music-playback-source-required"));
    throw error instanceof Error ? error : new Error(message);
  } finally {
    finishAudio(request === playRequest && enginePrimed);
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

export function setMusicQueue(tracks: MusicTrack[]): void {
  const current = state.current;
  const queueIndex = current
    ? tracks.findIndex((item) => queueTrackKey(item) === queueTrackKey(current))
    : -1;
  publish({ queue: tracks, queueIndex });
  void invoke("music_set_queue", { tracks }).catch((error) =>
    publish({ error: error instanceof Error ? error.message : String(error) }),
  );
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
  if (state.queue.some((item) => queueTrackKey(item) === queueTrackKey(track))) return;
  const at = queueInsertIndex(state.queue, state.queueIndex);
  markManuallyQueued(track);
  setMusicQueue(insertIntoQueue(state.queue, track, at));
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
  writeMusicPreference(VOLUME_KEY, String(next));
  publish({ volume: next });
  if (ownsMusicVideo()) videoController?.setVolume(next);
  void invoke("music_engine_set_volume", { volume: next }).catch(() => {});
}

export function nextMusic(auto = false): void {
  if (!state.current) return;
  if (!auto) autoSkipped.clear();
  const next = advance(state.queue, state.queueIndex, auto);
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
  const previous = goPrevious(state.queue, state.queueIndex);
  if (previous) void playMusic(previous, state.queue, new Set(), true).catch(() => {});
}

export function toggleMusicLiked(track = state.current): void {
  if (!track) return;
  const liked = !isMusicLiked(state.likedIds, track);
  const drop = new Set(likedIdsFor(track));
  const likedIds = liked
    ? [...withoutLiked(state.likedIds, track), track.id]
    : withoutLiked(state.likedIds, track);
  const likedTracks = liked
    ? [track, ...state.likedTracks.filter((item) => !drop.has(item.id))]
    : state.likedTracks.filter((item) => !drop.has(item.id));
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
    if (request !== playRequest) return;
    await invoke("music_set_queue", { tracks: [] });
    if (request !== playRequest) return;
    enginePrimed = false;
    audioReady = null;
    resetOrder();
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

if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
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
